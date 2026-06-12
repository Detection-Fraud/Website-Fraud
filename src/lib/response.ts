import { z } from "zod";

export type ActionResponse<T = any> = {
  status: number;
  error: boolean;
  message: string;
  data: T | null;
  errors?: any;
};

export function successResponse<T>(
  data: T,
  message: string = "Success",
  status: number = 200,
): ActionResponse<T> {
  return {
    status,
    error: false,
    message,
    data,
  };
}

export function errorResponse<T>(
  message: string = "Failed",
  status: number = 400,
  errors?: any,
): ActionResponse<T> {
  return {
    status,
    error: true,
    message,
    data: null,
    errors,
  };
}

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(", ");
}
