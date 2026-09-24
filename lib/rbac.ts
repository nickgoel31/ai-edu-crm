import { Role } from "@/types";
import { Session } from "next-auth";

/**
 * RBAC Helper utilities
 * - ADMIN: full access to all modules and settings
 * - COUNSELOR: full access to Leads/Students/Agents modules, no access to Settings or user management
 * - READONLY: view-only across all modules, no create/edit/delete
 */

export function canAccessSettings(role?: Role | null): boolean {
  return role === "ADMIN";
}

export function canMutate(role?: Role | null): boolean {
  return role === "ADMIN" || role === "COUNSELOR";
}

export function canAccessModule(role: Role | undefined | null, moduleName: string): boolean {
  if (!role) return false;

  const normalized = moduleName.toLowerCase();
  if (normalized === "settings" || normalized.startsWith("settings/")) {
    return role === "ADMIN";
  }

  // Leads, Students, Agents, Reports are accessible to all authenticated roles
  return true;
}

export function assertAdmin(session: Session | null): void {
  if (!session?.user) {
    throw new Error("Unauthorized: Authentication required.");
  }
  if (session.user.role !== "ADMIN") {
    throw new Error("Forbidden: Admin privileges required to access this resource.");
  }
}

export function assertCanMutate(session: Session | null): void {
  if (!session?.user) {
    throw new Error("Unauthorized: Authentication required.");
  }
  if (!canMutate(session.user.role)) {
    throw new Error("Forbidden: Read-only accounts cannot create, modify, or delete records.");
  }
}
