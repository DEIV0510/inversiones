import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getVerifiedSession } from "@/lib/auth";
import LoginForm from "@/components/admin/LoginForm";

export const metadata: Metadata = {
  title: "Acceso administrativo",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  if (await getVerifiedSession()) redirect("/admin");
  return <LoginForm />;
}
