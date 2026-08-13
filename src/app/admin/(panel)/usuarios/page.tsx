import type { Metadata } from "next";
import { requirePanelAuth } from "@/lib/auth";
import UsersModule from "@/components/admin/UsersModule";

export const metadata: Metadata = { title: "Usuarios" };
export const dynamic = "force-dynamic";

export default async function AdminUsuariosPage() {
  const session = await requirePanelAuth("users.manage");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Usuarios
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Cuentas con acceso al panel y sus roles.
        </p>
      </div>
      <UsersModule selfId={session.userId} />
    </div>
  );
}
