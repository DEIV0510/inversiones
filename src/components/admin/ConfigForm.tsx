"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SiteSettings } from "@/lib/settings";

const inputCls =
  "min-h-12 w-full rounded-xl border border-line bg-well px-4 text-base text-fg placeholder:text-fg-soft/70 focus:border-brand focus:outline-none";
const labelCls = "mb-1.5 block text-sm font-semibold text-fg";
const helpCls = "mt-1 text-xs text-fg-soft";

export default function ConfigForm({ settings }: { settings: SiteSettings }) {
  const router = useRouter();
  const [form, setForm] = useState({ ...settings });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function set<K extends keyof SiteSettings>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error || "No fue posible guardar" });
        return;
      }
      setMessage({ ok: true, text: "Cambios guardados y publicados." });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Error de conexión. Intenta de nuevo." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
        <div>
          <label htmlFor="c-name" className={labelCls}>
            Nombre de la empresa
          </label>
          <input
            id="c-name"
            type="text"
            required
            minLength={2}
            value={form.company_name}
            onChange={(e) => set("company_name", e.target.value)}
            className={inputCls}
            maxLength={120}
          />
        </div>
        <div>
          <label htmlFor="c-wa" className={labelCls}>
            Número de WhatsApp
          </label>
          <input
            id="c-wa"
            type="tel"
            inputMode="numeric"
            required
            minLength={10}
            value={form.whatsapp_number}
            onChange={(e) => set("whatsapp_number", e.target.value)}
            className={inputCls}
            placeholder="3106930187"
          />
          <p className={helpCls}>
            Se acepta 3106930187 o 573106930187: todos los botones de la página
            usarán este número.
          </p>
        </div>
        <div>
          <label htmlFor="c-wad" className={labelCls}>
            WhatsApp visible (texto)
          </label>
          <input
            id="c-wad"
            type="text"
            required
            minLength={7}
            value={form.whatsapp_display}
            onChange={(e) => set("whatsapp_display", e.target.value)}
            className={inputCls}
            placeholder="310 693 0187"
            maxLength={30}
          />
        </div>
        <div>
          <label htmlFor="c-loc" className={labelCls}>
            Ubicación
          </label>
          <input
            id="c-loc"
            type="text"
            required
            minLength={2}
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            className={inputCls}
            maxLength={160}
          />
          <p className={helpCls}>
            Formato “Ciudad, Departamento, País”. Este campo no puede quedar
            vacío.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
        <p className="text-sm font-bold uppercase tracking-wide text-fg-soft">
          Redes sociales (opcional)
        </p>
        <div>
          <label htmlFor="c-fb" className={labelCls}>
            Facebook
          </label>
          <input
            id="c-fb"
            type="url"
            value={form.facebook_url}
            onChange={(e) => set("facebook_url", e.target.value)}
            className={inputCls}
            placeholder="https://facebook.com/…"
          />
        </div>
        <div>
          <label htmlFor="c-ig" className={labelCls}>
            Instagram
          </label>
          <input
            id="c-ig"
            type="url"
            value={form.instagram_url}
            onChange={(e) => set("instagram_url", e.target.value)}
            className={inputCls}
            placeholder="https://instagram.com/…"
          />
        </div>
        <div>
          <label htmlFor="c-tt" className={labelCls}>
            TikTok
          </label>
          <input
            id="c-tt"
            type="url"
            value={form.tiktok_url}
            onChange={(e) => set("tiktok_url", e.target.value)}
            className={inputCls}
            placeholder="https://tiktok.com/@…"
          />
        </div>
        <p className={helpCls}>
          Si dejas una red vacía, simplemente no se muestra en la página.
        </p>
      </div>

      {message ? (
        <p
          role="alert"
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            message.ok
              ? "border border-wa/40 bg-wa/10 text-wa-dark"
              : "border border-brand/30 bg-brand/5 text-error"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex min-h-13 items-center justify-center rounded-xl bg-brand px-5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
      >
        {saving ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
