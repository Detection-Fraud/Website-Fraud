import { Metadata } from "next";
import LoginView from "../_components/LoginView";

export const metadata: Metadata = {
  title: "Login Admin Lokal — DICE BULOG",
  description: "Login lokal untuk akun debug atau breakglass DICE BULOG.",
};

export default function AdminLoginPage() {
  return <LoginView mode="admin" />;
}
