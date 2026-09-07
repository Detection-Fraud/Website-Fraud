import { Prisma, PrismaClient } from "@generated/prisma/client";
import { ApiError } from "@/lib/api/auth-guard";
import { isPicEligible } from "@/lib/employee-eligibility";
import { prisma } from "@/lib/prisma";

const userSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  name: true,
  username: true,
  role: true,
  authProvider: true,
  unitId: true,
  isActive: true,
  createdAt: true,
  unit: {
    select: {
      id: true,
      name: true,
      type: true,
    },
  },
});

const employeeSelect = Prisma.validator<Prisma.EmployeeSelect>()({
  id: true,
  nip: true,
  name: true,
  jenjang: true,
  kodeStatpeg: true,
  statKepeg: true,
  unitId: true,
  isPresentInSource: true,
  unit: {
    select: {
      id: true,
      name: true,
      type: true,
    },
  },
  user: {
    select: userSelect,
  },
});

type Db = PrismaClient;

type UserResult = Prisma.UserGetPayload<{
  select: typeof userSelect;
}>;

type EmployeeResult = Prisma.EmployeeGetPayload<{
  select: typeof employeeSelect;
}>;

export class UserManagementError extends ApiError {}

function rejectLocalOperationalMutation(authProvider: string): void {
  if (authProvider === "LOCAL") {
    throw new UserManagementError(
      "Akun LOCAL/debug tidak dikelola melalui operasi PIC operasional",
      409,
    );
  }
}

function boundedPage(
  value: number | undefined,
  fallback: number,
  maximum: number,
) {
  return Math.min(
    maximum,
    Math.max(
      1,
      Number.isFinite(value) ? Math.floor(value as number) : fallback,
    ),
  );
}

function requireEmployeeAssignment(employee: EmployeeResult, unitId: string) {
  if (!employee.unitId || employee.unitId !== unitId) {
    throw new UserManagementError(
      "Employee saat ini berada di unit berbeda",
      409,
    );
  }

  if (!isPicEligible(employee)) {
    throw new UserManagementError(
      "Employee tidak memenuhi syarat PIC saat ini",
      422,
    );
  }
}

async function resolveEmployee(
  tx: Prisma.TransactionClient,
  identifier: string,
) {
  const linkedUser = await tx.user.findUnique({
    where: { id: identifier },
    select: {
      id: true,
      employeeId: true,
    },
  });

  if (linkedUser?.employeeId) {
    return tx.employee.findUnique({
      where: { id: linkedUser.employeeId },
      select: employeeSelect,
    });
  }

  return tx.employee.findUnique({
    where: { id: identifier },
    select: employeeSelect,
  });
}

export async function listPicUsers(
  input: {
    unitId?: string;
    search?: string;
    page?: number;
    limit?: number;
  },
  db: Db = prisma,
) {
  const page = boundedPage(input.page, 1, 10_000);
  const limit = boundedPage(input.limit, 10, 100);
  const search = input.search?.trim() ?? "";

  const where: Prisma.UserWhereInput = {
    role: "PIC",
    authProvider: "SSO",
    ...(input.unitId && input.unitId !== "ALL" ? { unitId: input.unitId } : {}),
    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              username: {
                contains: search,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: "asc" },
      select: userSelect,
    }),
    db.user.count({ where }),
  ]);

  return {
    users,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function searchPicCandidates(
  input: {
    query: string;
    unitId?: string;
  },
  db: Db = prisma,
) {
  const query = input.query.trim();

  if (query.length < 2) {
    throw new UserManagementError("Query minimal 2 karakter", 400);
  }

  const employees = await db.employee.findMany({
    where: {
      unitId:
        input.unitId && input.unitId !== "ALL" ? input.unitId : { not: null },
      isPresentInSource: true,
      OR: [
        {
          name: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          nip: {
            contains: query,
            mode: "insensitive",
          },
        },
      ],
    },
    take: 50,
    orderBy: { name: "asc" },
    select: employeeSelect,
  });

  return employees
    .filter(
      (employee) =>
        isPicEligible(employee) &&
        (!employee.user || employee.user.authProvider === "SSO"),
    )
    .map((employee) => ({
      id: employee.user?.id ?? employee.id,
      employeeId: employee.id,
      name: employee.name,
      username: employee.nip,
      unitId: employee.unitId,
      unit: employee.unit,
      user: employee.user
        ? {
            id: employee.user.id,
            role: employee.user.role,
            isActive: employee.user.isActive,
          }
        : null,
    }))
    .slice(0, 10);
}

export async function searchActivePics(
  input: {
    query: string;
    unitId?: string;
  },
  db: Db = prisma,
) {
  const query = input.query.trim();

  if (query.length < 2) {
    throw new UserManagementError("Query minimal 2 karakter", 400);
  }

  return db.user.findMany({
    where: {
      role: "PIC",
      authProvider: "SSO",
      isActive: true,
      unitId:
        input.unitId && input.unitId !== "ALL" ? input.unitId : { not: null },
      name: {
        contains: query,
        mode: "insensitive",
      },
    },
    take: 10,
    orderBy: { name: "asc" },
    select: userSelect,
  });
}

export async function createOrLinkUser(
  input: {
    employeeId: string;
    unitId: string;
    role: "PIC" | "VIEWER";
  },
  db: Db = prisma,
) {
  return db.$transaction(
    async (tx) => {
      const employee = await tx.employee.findUnique({
        where: { id: input.employeeId },
        select: employeeSelect,
      });

      if (!employee) {
        throw new UserManagementError("Employee tidak ditemukan", 404);
      }

      if (input.role === "PIC") {
        requireEmployeeAssignment(employee, input.unitId);
      } else if (employee.unitId !== input.unitId) {
        throw new UserManagementError(
          "Employee saat ini berada di unit berbeda",
          409,
        );
      }

      if (employee.user) {
        throw new UserManagementError("Employee sudah memiliki User", 409);
      }

      const legacyUser = await tx.user.findUnique({
        where: { username: employee.nip },
        select: {
          id: true,
          employeeId: true,
          authProvider: true,
        },
      });

      if (legacyUser?.authProvider === "LOCAL") {
        throw new UserManagementError(
          "Akun LOCAL/debug tidak dapat digunakan sebagai akun PIC operasional",
          409,
        );
      }

      if (legacyUser?.employeeId) {
        throw new UserManagementError("NIP sudah tertaut ke User lain", 409);
      }

      const data = {
        username: employee.nip,
        samlNameId: employee.nip,
        name: employee.name,
        authProvider: "SSO" as const,
        role: input.role,
        isActive: true,
        unit: {
          connect: { id: input.unitId },
        },
        employee: {
          connect: { id: employee.id },
        },
      };

      return legacyUser
        ? tx.user.update({
            where: { id: legacyUser.id },
            data,
            select: userSelect,
          })
        : tx.user.create({
            data,
            select: userSelect,
          });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export async function assignPic(
  identifier: string,
  unitId: string,
  db: Db = prisma,
) {
  return db.$transaction(
    async (tx) => {
      const employee = await resolveEmployee(tx, identifier);

      if (!employee) {
        throw new UserManagementError("Employee/User tidak ditemukan", 404);
      }

      requireEmployeeAssignment(employee, unitId);

      let user: UserResult | null = employee.user;

      if (user?.authProvider === "LOCAL") {
        throw new UserManagementError(
          "Akun LOCAL/debug tidak dapat digunakan sebagai akun PIC operasional",
          409,
        );
      }

      if (user?.role === "ADMIN") {
        throw new UserManagementError(
          "Admin tidak dapat ditetapkan sebagai PIC",
          409,
        );
      }

      if (!user) {
        const byNip = await tx.user.findUnique({
          where: { username: employee.nip },
          select: {
            id: true,
            employeeId: true,
            role: true,
            authProvider: true,
          },
        });

        if (byNip?.authProvider === "LOCAL") {
          throw new UserManagementError(
            "Akun LOCAL/debug tidak dapat digunakan sebagai akun PIC operasional",
            409,
          );
        }

        if (byNip?.employeeId && byNip.employeeId !== employee.id) {
          throw new UserManagementError("NIP sudah tertaut ke User lain", 409);
        }

        user = byNip
          ? await tx.user.update({
              where: { id: byNip.id },
              data: {
                employeeId: employee.id,
                role: "PIC",
                unitId,
                isActive: true,
              },
              select: userSelect,
            })
          : await tx.user.create({
              data: {
                username: employee.nip,
                samlNameId: employee.nip,
                name: employee.name,
                authProvider: "SSO" as const,
                role: "PIC",
                isActive: true,
                unit: {
                  connect: { id: unitId },
                },
                employee: {
                  connect: { id: employee.id },
                },
              },
              select: userSelect,
            });
      } else {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            role: "PIC",
            unitId,
            isActive: true,
          },
          select: userSelect,
        });
      }

      return user;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export async function setUserStatus(
  userId: string,
  isActive: boolean,
  db: Db = prisma,
) {
  return db.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          authProvider: true,
          unitId: true,
          employee: {
            select: employeeSelect,
          },
        },
      });

      if (!user) {
        throw new UserManagementError("User tidak ditemukan", 404);
      }

      if (user.role !== "PIC") {
        throw new UserManagementError(
          "Hanya PIC yang dapat diubah statusnya",
          400,
        );
      }

      rejectLocalOperationalMutation(user.authProvider);

      if (isActive) {
        if (!user.employee) {
          throw new UserManagementError("PIC belum tertaut ke Employee", 409);
        }

        if (
          !user.employee.unitId ||
          user.unitId !== user.employee.unitId ||
          !isPicEligible(user.employee)
        ) {
          throw new UserManagementError(
            "PIC tidak memenuhi syarat reaktivasi",
            422,
          );
        }

        if (!user.employee.user || user.employee.user.id !== user.id) {
          throw new UserManagementError(
            "Tautan Employee/User tidak valid",
            409,
          );
        }
      }

      return tx.user.update({
        where: { id: userId },
        data: { isActive },
        select: userSelect,
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export async function demoteUser(userId: string, db: Db = prisma) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      authProvider: true,
    },
  });

  if (!user) {
    throw new UserManagementError("User tidak ditemukan", 404);
  }

  rejectLocalOperationalMutation(user.authProvider);

  return db.user.update({
    where: { id: userId },
    data: {
      role: "VIEWER",
      isActive: false,
    },
    select: userSelect,
  });
}
