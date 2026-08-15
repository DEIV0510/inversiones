"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconEye, IconEyeOff } from "@/components/icons";
import { btnPrimary, inputCls, labelCls } from "./ui";

/* Aviso de error: rosa sobre violeta, igual en todos los módulos. */
const alertCls =
  "rounded-xl border border-error/35 bg-error/10 px-4 py-3 text-sm font-medium text-error";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No fue posible iniciar sesión");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg px-4 py-10">
      <div className="dot-grid absolute inset-0" aria-hidden="true" />
      <div
        className="absolute -top-32 left-1/2 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-brand/25 blur-[130px]"
        aria-hidden="true"
      />
      <div className="neon-card relative w-full max-w-sm rounded-3xl bg-card p-7 sm:p-9">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/logo-mark.webp"
            alt="Logo de Inversiones D y S"
            width={48}
            height={48}
            className="h-12 w-12 rounded-full object-cover ring-1 ring-line"
          />
          <div>
            <p className="brand-gradient font-display text-base font-extrabold uppercase leading-tight tracking-[0.06em]">
              Inversiones D y S
            </p>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-violet">
              Panel administrativo
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4">
          <div>
            <label htmlFor="login-email" className={labelCls}>
              Correo
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="admin@ejemplo.com"
            />
          </div>
          <div>
            <label htmlFor="login-password" className={labelCls}>
              Contraseña
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputCls} pr-12`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-fg-soft transition-colors hover:text-brand"
              >
                {showPassword ? (
                  <IconEyeOff width={19} height={19} />
                ) : (
                  <IconEye width={19} height={19} />
                )}
              </button>
            </div>
          </div>

          {error ? (
            <p role="alert" className={alertCls}>
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className={`${btnPrimary} mt-1 w-full disabled:cursor-not-allowed`}
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-fg-soft">
          Acceso privado del administrador de Inversiones D y S.
        </p>
      </div>
    </main>
  );
}
