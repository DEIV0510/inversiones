import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { getVerifiedSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: {
    default: "Panel administrativo",
    template: "%s | Panel D y S",
  },
  robots: { index: false, follow: false },
};

export default async function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // El shell necesita el rol para filtrar el menú. La seguridad real está en
  // cada página (requirePanelAuth) y en cada endpoint (requireAdminApi):
  // los layouts no se re-ejecutan en navegaciones suaves.
  const session = await getVerifiedSession();
  if (!session) redirect("/admin/login");

  return (
    <AdminShell role={session.role} userName={session.name}>
      {children}
    </AdminShell>
  );
}
