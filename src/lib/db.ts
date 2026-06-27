import type { PrismaClient } from "@prisma/client";

type PrismaClientConstructor = new () => PrismaClient;

// The portable drive does not support the junction Turbopack creates for
// statically imported server packages, so resolve Prisma from node_modules at runtime.
const runtimeRequire = eval("require") as NodeRequire;
const { PrismaClient: RuntimePrismaClient } = runtimeRequire("@prisma/client") as {
  PrismaClient: PrismaClientConstructor;
};

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function getDb() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new RuntimePrismaClient();
  }

  return globalForPrisma.prisma;
}
