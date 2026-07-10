import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(3, "Nama minimal 3 karakter"),
  nip: z.string().min(5, "NIP minimal 5 karakter"),
  role: z.enum(["ADMIN", "PIC", "VIEWER"]),
  unitId: z.string().uuid("Unit ID tidak valid").optional(),
});

export const toggleUserStatusSchema = z.object({
  isActive: z.boolean({
    error: (issue) =>
      issue.input === undefined
        ? "Status (isActive) harus disertakan"
        : "Format status tidak valid",
  }),
});

export const promoteUserSchema = z.object({
  unitId: z.string().uuid("Format unit ID tidak valid"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ToggleUserStatusInput = z.infer<typeof toggleUserStatusSchema>;
export type PromoteUserInput = z.infer<typeof promoteUserSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password lama wajib diisi"),
    newPassword: z
      .string()
      .min(8, "Password baru minimal 8 karakter")
      .regex(/[A-Z]/, "Harus mengandung huruf besar")
      .regex(/[0-9]/, "Harus mengandung angka"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Password baru dan konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;


