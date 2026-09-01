import type { ProgramCategory } from "@generated/prisma";

export interface CategoryUsage {
  programCount: number;
  activeProgramCount: number;
  reportCount: number;
  participationCount: number;
  historyCount: number;
}

export interface CategoryLocks {
  capability: boolean;
  deletion: boolean;
}

export type CategoryWithStats = ProgramCategory & {
  usage: CategoryUsage;
  locks: CategoryLocks;
  totalProgram: number;
  totalActive: number;
};
