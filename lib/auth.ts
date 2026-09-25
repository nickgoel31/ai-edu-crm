import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { decryptField } from "@/lib/crypto";
import { verifyTotpCode, consumeBackupCode } from "@/lib/totp";

// In-memory brute-force lockout, keyed by normalized email. This is a
// best-effort guard against credential stuffing on the login form; it
// intentionally mirrors the in-memory-Map pattern already used by
// lib/rate-limiter.ts rather than pulling in a new dependency.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const failedLoginAttempts = new Map<string, { count: number; firstFailureAt: number }>();

function isLockedOut(email: string): boolean {
  const record = failedLoginAttempts.get(email);
  if (!record) return false;
  if (Date.now() - record.firstFailureAt > LOCKOUT_WINDOW_MS) {
    failedLoginAttempts.delete(email);
    return false;
  }
  return record.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailedAttempt(email: string): void {
  const record = failedLoginAttempts.get(email);
  if (!record || Date.now() - record.firstFailureAt > LOCKOUT_WINDOW_MS) {
    failedLoginAttempts.set(email, { count: 1, firstFailureAt: Date.now() });
    return;
  }
  record.count += 1;
}

function clearFailedAttempts(email: string): void {
  failedLoginAttempts.delete(email);
}

if (!process.env.NEXTAUTH_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXTAUTH_SECRET is not set. Refusing to start with an insecure fallback secret in production."
    );
  }
  console.warn(
    "[auth] NEXTAUTH_SECRET is not set — using an insecure development-only fallback. Set NEXTAUTH_SECRET in .env before deploying."
  );
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totp: { label: "Two-factor code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Please enter your email and password.");
        }

        const email = credentials.email.trim().toLowerCase();

        if (isLockedOut(email)) {
          throw new Error(
            "Too many failed login attempts. Please wait 15 minutes before trying again."
          );
        }

        const user = await prisma.user.findFirst({
          where: { email },
          include: {
            organization: true,
          },
        });

        if (!user || !user.password) {
          recordFailedAttempt(email);
          throw new Error("Invalid email or password.");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          recordFailedAttempt(email);
          throw new Error("Invalid email or password.");
        }

        if (user.twoFactorEnabled) {
          const code = credentials.totp?.trim();
          if (!code) {
            // Distinct, machine-checkable error the login page uses to
            // switch to a "enter your 6-digit code" step instead of
            // showing a generic failure.
            throw new Error("2FA_REQUIRED");
          }

          const secret = decryptField(user.twoFactorSecret);
          let verified = secret ? verifyTotpCode(secret, code) : false;

          if (!verified && user.twoFactorBackupCodes) {
            const hashedCodes: string[] = JSON.parse(user.twoFactorBackupCodes);
            const usedIndex = await consumeBackupCode(hashedCodes, code);
            if (usedIndex >= 0) {
              verified = true;
              hashedCodes.splice(usedIndex, 1);
              await prisma.user.update({
                where: { id: user.id },
                data: { twoFactorBackupCodes: JSON.stringify(hashedCodes) },
              });
            }
          }

          if (!verified) {
            recordFailedAttempt(email);
            throw new Error("Invalid two-factor code.");
          }
        }

        clearFailedAttempts(email);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as any,
          organizationId: user.organizationId,
          organizationName: user.organization.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.organizationName = user.organizationName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.organizationId = token.organizationId;
        session.user.organizationName = token.organizationName;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "dev-only-insecure-fallback-secret-32ch",
};
