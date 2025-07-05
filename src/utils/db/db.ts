import { PrismaClient } from "../../../generated/prisma";

export const db = new PrismaClient({
  log: ["error", "info", "query", "warn"],
});

export * from "../../../generated/prisma";
