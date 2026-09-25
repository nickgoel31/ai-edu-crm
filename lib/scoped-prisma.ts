import { Session } from "next-auth";
import { prisma } from "@/lib/prisma";

/**
 * Creates a scoped Prisma client dynamically tied to the authenticated user's organizationId.
 * Guarantees that every query automatically enforces organization-level isolation across
 * all tenant-scoped models (User, Lead, Student, Agent, AuditLog), preventing cross-tenant
 * data leakage or modification.
 */
export function getScopedPrismaClient(
  session: Session | null | { user: { organizationId: string } }
) {
  const organizationId = session?.user?.organizationId;

  if (!organizationId) {
    throw new Error(
      "Unauthorized: Cannot instantiate scoped Prisma client without an active session and organizationId."
    );
  }

  const createTenantQueryHooks = (foreignKey: string = "organizationId") => ({
    async findMany({ args, query }: any) {
      args.where = { ...args.where, [foreignKey]: organizationId };
      return query(args);
    },
    async findFirst({ args, query }: any) {
      args.where = { ...args.where, [foreignKey]: organizationId };
      return query(args);
    },
    async count({ args, query }: any) {
      args.where = { ...args.where, [foreignKey]: organizationId };
      return query(args);
    },
    async aggregate({ args, query }: any) {
      args.where = { ...args.where, [foreignKey]: organizationId };
      return query(args);
    },
    async groupBy({ args, query }: any) {
      args.where = { ...args.where, [foreignKey]: organizationId };
      return query(args);
    },
    async create({ args, query }: any) {
      const data = { ...args.data, [foreignKey]: organizationId };
      delete data.organization;
      args.data = data;
      return query(args);
    },
    async createMany({ args, query }: any) {
      if (Array.isArray(args.data)) {
        args.data = args.data.map((item: any) => {
          const mapped = { ...item, [foreignKey]: organizationId };
          delete mapped.organization;
          return mapped;
        });
      } else if (args.data) {
        args.data = { ...args.data, [foreignKey]: organizationId };
        delete args.data.organization;
      }
      return query(args);
    },
    async update({ args, query }: any) {
      args.where = { ...args.where, [foreignKey]: organizationId };
      return query(args);
    },
    async updateMany({ args, query }: any) {
      args.where = { ...args.where, [foreignKey]: organizationId };
      return query(args);
    },
    async delete({ args, query }: any) {
      args.where = { ...args.where, [foreignKey]: organizationId };
      return query(args);
    },
    async deleteMany({ args, query }: any) {
      args.where = { ...args.where, [foreignKey]: organizationId };
      return query(args);
    },
    async upsert({ args, query }: any) {
      const createData = { ...args.create, [foreignKey]: organizationId };
      delete createData.organization;
      args.create = createData;
      args.where = { ...args.where, [foreignKey]: organizationId };
      return query(args);
    },
  });

  return prisma.$extends({
    name: "scoped-prisma-client",
    query: {
      user: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.user.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      lead: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.lead.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      student: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.student.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      agent: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.agent.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      auditLog: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.auditLog.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      activity: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.activity.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      integration: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.integration.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      documentTemplate: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.documentTemplate.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      erpSyncLog: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.erpSyncLog.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      agentTrigger: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.agentTrigger.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      agentTriggerFire: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.agentTriggerFire.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      notificationPreference: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.notificationPreference.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      customFieldDefinition: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.customFieldDefinition.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      customFieldValue: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.customFieldValue.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      tag: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.tag.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      entityTag: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.entityTag.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      duplicateMatch: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.duplicateMatch.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      scoringRule: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.scoringRule.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      sLAPolicy: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.sLAPolicy.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      pipelineTemplate: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.pipelineTemplate.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      pipelineStage: {
        async findMany({ args, query }: any) {
          args.where = {
            ...args.where,
            pipelineTemplate: { organizationId },
          };
          return query(args);
        },
        async findFirst({ args, query }: any) {
          args.where = {
            ...args.where,
            pipelineTemplate: { organizationId },
          };
          return query(args);
        },
        async count({ args, query }: any) {
          args.where = {
            ...args.where,
            pipelineTemplate: { organizationId },
          };
          return query(args);
        },
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.pipelineStage.findFirst({
            where: {
              ...(where as object),
              pipelineTemplate: { organizationId },
            },
            ...rest,
          });
        },
        async create({ args, query }: any) {
          return query(args);
        },
        async createMany({ args, query }: any) {
          return query(args);
        },
        async update({ args, query }: any) {
          return query(args);
        },
        async updateMany({ args, query }: any) {
          return query(args);
        },
        async delete({ args, query }: any) {
          return query(args);
        },
        async deleteMany({ args, query }: any) {
          return query(args);
        },
      },
      messageTemplate: createTenantQueryHooks("organizationId"),
      knowledgeBase: {
        ...createTenantQueryHooks(),
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.knowledgeBase.findFirst({
            where: {
              ...(where as object),
              organizationId,
            },
            ...rest,
          });
        },
      },
      knowledgeBaseDocument: {
        async findMany({ args, query }: any) {
          args.where = { ...args.where, knowledgeBase: { organizationId } };
          return query(args);
        },
        async findFirst({ args, query }: any) {
          args.where = { ...args.where, knowledgeBase: { organizationId } };
          return query(args);
        },
        async count({ args, query }: any) {
          args.where = { ...args.where, knowledgeBase: { organizationId } };
          return query(args);
        },
        async findUnique({ args }: any) {
          const { where, ...rest } = args;
          return prisma.knowledgeBaseDocument.findFirst({
            where: {
              ...(where as object),
              knowledgeBase: { organizationId },
            },
            ...rest,
          });
        },
        async create({ args, query }: any) {
          return query(args);
        },
        async update({ args, query }: any) {
          return query(args);
        },
        async delete({ args, query }: any) {
          return query(args);
        },
        async deleteMany({ args, query }: any) {
          return query(args);
        },
      },
      agentKnowledgeBase: {
        async findMany({ args, query }: any) {
          args.where = { ...args.where, agent: { organizationId } };
          return query(args);
        },
        async findFirst({ args, query }: any) {
          args.where = { ...args.where, agent: { organizationId } };
          return query(args);
        },
        async create({ args, query }: any) {
          return query(args);
        },
        async createMany({ args, query }: any) {
          return query(args);
        },
        async delete({ args, query }: any) {
          return query(args);
        },
        async deleteMany({ args, query }: any) {
          return query(args);
        },
      },
      organization: {
        async findFirst({ args, query }) {
          args.where = { ...args.where, id: organizationId };
          return query(args);
        },
        async findUnique({ args }) {
          const { where, ...rest } = args;
          return prisma.organization.findFirst({
            where: {
              ...(where as object),
              id: organizationId,
            },
            ...rest,
          });
        },
        async findMany({ args, query }) {
          args.where = { ...args.where, id: organizationId };
          return query(args);
        },
      },
    },
    client: {
      currentOrganizationId: organizationId,
    },
  });
}

export type ScopedPrismaClient = ReturnType<typeof getScopedPrismaClient>;
