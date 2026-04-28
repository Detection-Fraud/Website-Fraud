"use server";

import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/response";
import { getDashboardByRole } from "@/lib/routes";
import { LoginSchema } from "@/schemas/auth";
import { AuthError } from "next-auth";
import { z } from "zod";

export async function loginAction(values: z.infer<typeof LoginSchema>) {
  const validatedFields = LoginSchema.safeParse(values);

  if (!validatedFields.success) {
    return errorResponse("Invalid fields", 400);
  }

  const { username, password } = validatedFields.data;

  // Look up the user's role so we can redirect to the correct dashboard
  const user = await prisma.user.findUnique({
    where: { username },
    select: { role: true },
  });

  const redirectTo = user ? getDashboardByRole(user.role) : "/login";

  try {
    await signIn("credentials", {
      username,
      password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return errorResponse("Invalid credentials", 401);
        default:
          return errorResponse("Something went wrong", 500);
      }
    }
    throw error;
  }
}
