import { prisma } from "@/lib/prisma";

const BASE_DELAY_MS = 30_000; // 30s
const MAX_DELAY_MS = 30 * 60_000; // 30min cap

function backoffMs(attempts: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** attempts, MAX_DELAY_MS);
}

export async function enqueueJob(
  type: string,
  payload: Record<string, any>,
  opts: { maxAttempts?: number; delayMs?: number } = {}
) {
  return prisma.job.create({
    data: {
      type,
      payload: JSON.stringify(payload),
      maxAttempts: opts.maxAttempts ?? 5,
      nextRunAt: new Date(Date.now() + (opts.delayMs ?? 0)),
    },
  });
}

export type JobHandler = (payload: any, jobId: string) => Promise<void>;

export interface ProcessJobsReport {
  processed: number;
  succeeded: number;
  retried: number;
  failedPermanently: number;
  skippedUnknownType: number;
}

/**
 * Claims and runs due jobs (status PENDING, nextRunAt <= now), one handler
 * lookup per job.type. A handler that throws causes the job to be
 * rescheduled with exponential backoff until maxAttempts is exhausted, at
 * which point it's marked FAILED and left for manual inspection.
 */
export async function processPendingJobs(
  handlers: Record<string, JobHandler>,
  opts: { batchSize?: number } = {}
): Promise<ProcessJobsReport> {
  const batchSize = opts.batchSize ?? 25;
  const report: ProcessJobsReport = {
    processed: 0,
    succeeded: 0,
    retried: 0,
    failedPermanently: 0,
    skippedUnknownType: 0,
  };

  const dueJobs = await prisma.job.findMany({
    where: { status: "PENDING", nextRunAt: { lte: new Date() } },
    orderBy: { nextRunAt: "asc" },
    take: batchSize,
  });

  for (const job of dueJobs) {
    report.processed++;

    const handler = handlers[job.type];
    if (!handler) {
      report.skippedUnknownType++;
      continue;
    }

    // Best-effort claim: mark PROCESSING first so a slow-running cron
    // invocation doesn't get double-picked-up by an overlapping run.
    const claimed = await prisma.job.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "PROCESSING" },
    });
    if (claimed.count === 0) continue; // another worker already took it

    try {
      const payload = JSON.parse(job.payload);
      await handler(payload, job.id);
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "SUCCEEDED" },
      });
      report.succeeded++;
    } catch (err: any) {
      const attempts = job.attempts + 1;
      const message = err?.message || String(err);

      if (attempts >= job.maxAttempts) {
        await prisma.job.update({
          where: { id: job.id },
          data: { status: "FAILED", attempts, lastError: message },
        });
        report.failedPermanently++;
      } else {
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: "PENDING",
            attempts,
            lastError: message,
            nextRunAt: new Date(Date.now() + backoffMs(attempts)),
          },
        });
        report.retried++;
      }
    }
  }

  return report;
}
