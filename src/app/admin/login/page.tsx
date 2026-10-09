import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { getVerifiedSession } from "@/lib/auth";
import LoginForm from "@/components/admin/LoginForm";

export const metadata: Metadata = {
  title: "Acceso administrativo",
  robots: { index: false, follow: false },
};

// Como el panel: oscuro siempre, también la barra del navegador.
export const viewport: Viewport = {
  themeColor: "#07060f",
};

export default async function LoginPage() {
  if (await getVerifiedSession()) redirect("/admin");
  return <LoginForm />;
}
