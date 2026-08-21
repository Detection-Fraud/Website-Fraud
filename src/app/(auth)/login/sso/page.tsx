import { Metadata } from "next";
import SSOCallbackView from "./_components/SSOCallbackView";

export const metadata: Metadata = {
  title: "Memproses Autentikasi SSO",
  description: "Memverifikasi token login Single Sign-On DICE BULOG",
};

export default function SSOCallbackPage() {
  return <SSOCallbackView />;
}
