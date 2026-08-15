"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [demoMode, setDemoMode] = useState(initial.demo_mode === "1");

  // Correo automático. Vive en Configuración pero no viaja en SiteSettings:
  // se pide al endpoint, que además dice si el entorno tiene la clave.
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailFrom, setEmailFrom] = useState("");
  const [proveedorListo, setProveedorListo] = useState<boolean | null>(null);
  // Si esa consulta no llegó, el formulario NO conoce la configuración real de
  // correo: guardar mandaría los valores por defecto y borraría el remitente
  // que el dueño tuviera puesto. Mientras no cargue, esas dos claves no viajan.
  const [correoCargado, setCorreoCargado] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let vigente = true;
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!vigente || !data) return;
        setEmailEnabled(data.email_enabled !== "0");
        setEmailFrom(typeof data.email_from === "string" ? data.email_from : "");
        setProveedorListo(Boolean(data.proveedorListo));
        setCorreoCargado(true);
      })
      .catch(() => {
        /* si no carga, el bloque queda en "comprobando" y no promete nada */
      });
    return () => {
      vigente = false;
    };
  }, []);

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
          demo_mode: demoMode ? "1" : "0",
          // Las claves que no viajan se quedan como están en la base.
          ...(correoCargado
            ? {
                email_enabled: emailEnabled ? "1" : "0",
                email_from: emailFrom.trim().toLowerCase(),
              }
            : {}),
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

      <div className="rounded-2xl border border-line bg-card p-4">
        <label className="flex cursor-pointer select-none items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-semibold text-fg">
              Modo demostración
            </span>
            <span className={helpCls}>
              Muestra un aviso en el sitio público: “los sorteos mostrados son
              de ejemplo”. Apágalo cuando publiques tu primer sorteo real.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={demoMode}
            aria-label={
              demoMode
                ? "Desactivar modo demostración"
                : "Activar modo demostración"
            }
            onClick={() => setDemoMode((v) => !v)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              demoMode ? "bg-brand" : "bg-line"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                demoMode ? "left-6" : "left-1"
              }`}
            />
          </button>
        </label>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
        <div className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-sm font-semibold text-fg">
              Números por correo
            </span>
            <span className={helpCls}>
              Al confirmarse el pago, el comprador recibe sus números y su
              código de participación en el correo que escribió al comprar. Si
              no dejó correo, no se envía nada.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={emailEnabled}
            aria-label={
              emailEnabled
                ? "Desactivar el envío de números por correo"
                : "Activar el envío de números por correo"
            }
            onClick={() => setEmailEnabled((v) => !v)}
            disabled={!correoCargado}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors before:absolute before:-inset-2.5 before:content-[''] disabled:opacity-50 ${
              emailEnabled ? "bg-brand" : "bg-line"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                emailEnabled ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>

        {proveedorListo === null ? (
          <p className="rounded-xl border border-line bg-well px-4 py-3 text-sm text-fg-faint">
            Comprobando el proveedor de correo…
          </p>
        ) : proveedorListo ? (
          <p className="rounded-xl border border-wa/30 bg-wa/10 px-4 py-3 text-sm font-medium text-wa">
            Proveedor de correo conectado: los correos salen de verdad.
          </p>
        ) : (
          <p
            role="alert"
            className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm leading-relaxed font-medium text-warn"
          >
            Falta la clave del proveedor de correo: pídesela a tu desarrollador.
            Mientras no esté configurada NO se envía ningún correo, aunque el
            interruptor esté encendido.
          </p>
        )}

        <div>
          <label htmlFor="cf-emailfrom" className={labelCls}>
            Correo remitente
          </label>
          <input
            id="cf-emailfrom"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={emailFrom}
            onChange={(e) => setEmailFrom(e.target.value)}
            disabled={!correoCargado}
            className={`${inputCls} disabled:opacity-50`}
            placeholder="sorteos@tudominio.com"
            maxLength={200}
          />
          <p className={helpCls}>
            Dirección desde la que llegan los correos. Debe pertenecer a un
            dominio verificado con el proveedor; si la dejas vacía se usa la
            dirección configurada en el servidor.
          </p>
        </div>
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
