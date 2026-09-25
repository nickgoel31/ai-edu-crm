import { Role } from "@/types";
import { ModuleAccessMap } from "@/lib/rbac";
import { DefaultSession, DefaultUser } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      organizationId: string;
      organizationName: string;
      moduleAccess: ModuleAccessMap;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
    role: Role;
    organizationId: string;
    organizationName: string;
    moduleAccess: ModuleAccessMap;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    organizationId: string;
    organizationName: string;
    moduleAccess: ModuleAccessMap;
  }
}
