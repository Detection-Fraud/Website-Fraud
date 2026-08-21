import { Metadata } from "next";
import LoginView from "./_components/LoginView";

export const metadata: Metadata = {
  title: "Masuk ke DICE BULOG",
  description: "Digital Culture & Engagement Center - Masuk ke akun Anda",
};

export default function LoginPage() {
  return <LoginView />;
}
