import { UserRole } from "@/generated/prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      apellido?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
      personalId?: string | null;
    };
  }

  interface User {
    role: UserRole;
    apellido?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    apellido?: string | null;
    personalId?: string | null;
  }
}
