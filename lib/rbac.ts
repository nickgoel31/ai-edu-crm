import { Role } from "@/types";
import { Session } from "next-auth";

/**
 * RBAC Helper utilities
 * - ADMIN: full access to all modules and settings, never restricted by
 *   per-user moduleAccess (see below).
 * - COUNSELOR: full access to Leads/Students/Agents/Reports by default,
 *   no access to Settings or user management. An admin can additionally
 *   restrict a specific counselor's access to a subset of those modules
 *   via User.moduleAccess (e.g. a counselor who only handles the Voice
 *   track and shouldn't see Reports).
 * - READONLY: view-only across all modules, no create/edit/delete. Also
 *   subject to moduleAccess restriction.
 */

export type AppModule = "leads" | "students" | "agents" | "reports";
export const APP_MODULES: AppModule[] = ["leads", "students", "agents", "reports"];

export type ModuleAccessMap = Partial<Record<AppModule, boolean>>;

/** Parses User.moduleAccess (JSON string, already-parsed object, or null) safely. */
export function parseModuleAccess(raw: string | ModuleAccessMap | null | undefined): ModuleAccessMap {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function canAccessSettings(role?: Role | null): boolean {
  return role === "ADMIN";
}

/**
 * Single source of truth for "is this pathname admin-only". Used by
 * middleware.ts to gate navigation, and safe to reuse from client
 * components (sidebar/topbar) so the rule never drifts between them.
 */
export function isAdminOnlyPath(pathname: string): boolean {
  return pathname === "/settings" || pathname.startsWith("/settings/");
}

/** Maps a pathname to the AppModule it belongs to, or null if none applies. */
export function moduleForPath(pathname: string): AppModule | null {
  for (const m of APP_MODULES) {
    if (pathname === `/${m}` || pathname.startsWith(`/${m}/`)) return m;
  }
  return null;
}

export function canMutate(role?: Role | null): boolean {
  return role === "ADMIN" || role === "COUNSELOR";
}

/**
 * Whether this session can access a given module, honoring a per-user
 * moduleAccess override. ADMIN is always allowed. An unset (undefined) or
 * true entry in moduleAccess means allowed — only an explicit `false`
 * restricts a COUNSELOR/READONLY user, so every existing user (with no
 * moduleAccess set) keeps today's full-access behavior unchanged.
 */
export function canAccessModule(
  role: Role | undefined | null,
  moduleName: string,
  moduleAccess?: ModuleAccessMap | null
): boolean {
  if (!role) return false;

  const normalized = moduleName.toLowerCase();
  if (normalized === "settings" || normalized.startsWith("settings/")) {
    return role === "ADMIN";
  }

  if (role === "ADMIN") return true;

  const mod = normalized as AppModule;
  if (APP_MODULES.includes(mod) && moduleAccess && moduleAccess[mod] === false) {
    return false;
  }

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

/** Throws if this session's role/moduleAccess doesn't permit the given module. */
export function assertModuleAccess(session: Session | null, moduleName: AppModule): void {
  if (!session?.user) {
    throw new Error("Unauthorized: Authentication required.");
  }
  if (!canAccessModule(session.user.role, moduleName, session.user.moduleAccess)) {
    throw new Error(`Forbidden: Your account does not have access to the ${moduleName} module.`);
  }
}
