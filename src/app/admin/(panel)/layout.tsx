import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: {
    default: "Panel administrativo",
    template: "%s | Panel D y S",
  },
  robots: { index: false, follow: false },
};

export default function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // La autenticación se verifica en CADA página (requirePanelAuth):
  // los layouts no se re-ejecutan en navegaciones suaves.
  return <AdminShell>{children}</AdminShell>;
}
