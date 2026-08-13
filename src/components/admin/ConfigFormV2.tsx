"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SiteSettings } from "@/lib/settings";
import { btnPrimary, helpCls, inputCls, labelCls } from "./ui";

export default function ConfigFormV2({ initial }: { initial: SiteSettings }) {
  const router = useRouter();

  const [companyName, setCompanyName] = useState(initial.company_name);
  const [whatsappNumber, setWhatsappNumber] = useState(initial.whatsapp_number);
  const [whatsappDisplay, setWhatsappDisplay] = useState(
    initial.whatsapp_display
  );
  const [location, setLocation] = useState(initial.location);
  const [facebookUrl, setFacebookUrl] = useState(initial.facebook_url);
  const [instagramUrl, setInstagramUrl] = useState(initial.instagram_url);
  const [tiktokUrl, setTiktokUrl] = useState(initial.tiktok_url);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  async function save() {
    setError("");
    setOk(false);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName.trim(),
          whatsapp_number: whatsappNumber.trim(),
          whatsapp_display: whatsappDisplay.trim(),
          location: location.trim(),
          facebook_url: facebookUrl.trim(),
          instagram_url: instagramUrl.trim(),
          tiktok_url: tiktokUrl.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No fue posible guardar los cambios");
        return;
      }
      setOk(true);
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
        <div>
          <label htmlFor="cf-name" className={labelCls}>
            Nombre de la empresa *
          </label>
          <input
            id="cf-name"
            type="text"
            required
            minLength={2}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className={inputCls}
            maxLength={120}
          />
        </div>
        <div>
          <label htmlFor="cf-wa" className={labelCls}>
            Número de WhatsApp *
          </label>
          <input
            id="cf-wa"
            type="tel"
            required
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            className={inputCls}
            maxLength={20}
          />
          <p className={helpCls}>
            3106930187 o 573106930187; todos los botones del sitio usan este
            número.
          </p>
        </div>
        <div>
          <label htmlFor="cf-wadisp" className={labelCls}>
            WhatsApp visible *
          </label>
          <input
            id="cf-wadisp"
            type="text"
            required
            value={whatsappDisplay}
            onChange={(e) => setWhatsappDisplay(e.target.value)}
            className={inputCls}
            placeholder="310 693 0187"
            maxLength={30}
          />
          <p className={helpCls}>
            Así se muestra el número en el sitio (con espacios).
          </p>
        </div>
        <div>
          <label htmlFor="cf-loc" className={labelCls}>
            Ubicación *
          </label>
          <input
            id="cf-loc"
            type="text"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={inputCls}
            maxLength={160}
          />
          <p className={helpCls}>Ciudad, Departamento, País</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
        <div>
          <label htmlFor="cf-fb" className={labelCls}>
            Facebook (URL)
          </label>
          <input
            id="cf-fb"
            type="url"
            value={facebookUrl}
            onChange={(e) => setFacebookUrl(e.target.value)}
            className={inputCls}
            placeholder="https://facebook.com/..."
            maxLength={300}
          />
        </div>
        <div>
          <label htmlFor="cf-ig" className={labelCls}>
            Instagram (URL)
          </label>
          <input
            id="cf-ig"
            type="url"
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            className={inputCls}
            placeholder="https://instagram.com/..."
            maxLength={300}
          />
        </div>
        <div>
          <label htmlFor="cf-tk" className={labelCls}>
            TikTok (URL)
          </label>
          <input
            id="cf-tk"
            type="url"
            value={tiktokUrl}
            onChange={(e) => setTiktokUrl(e.target.value)}
            className={inputCls}
            placeholder="https://tiktok.com/@..."
            maxLength={300}
          />
        </div>
        <p className={helpCls}>
          Las redes son opcionales; déjalas vacías para no mostrarlas.
        </p>
      </div>

      {ok ? (
        <p
          role="status"
          className="rounded-xl border border-wa/30 bg-wa/10 px-4 py-3 text-sm font-medium text-wa"
        >
          Cambios guardados y publicados.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm font-medium text-error"
        >
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={saving} className={`${btnPrimary} min-h-13`}>
        {saving ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
