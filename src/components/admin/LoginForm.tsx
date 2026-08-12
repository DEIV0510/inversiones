"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconEye, IconEyeOff } from "@/components/icons";

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
          <span className="glow-red-sm flex h-11 w-11 items-center justify-center rounded-xl bg-brand font-display text-base font-black text-white">
            DS
          </span>
          <div>
            <p className="font-display text-base font-extrabold uppercase leading-tight text-fg">
              Inversiones <span className="text-brand">D y S</span>
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-fg-soft">
              Panel administrativo
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4">
          <div>
            <label
              htmlFor="login-email"
              className="mb-1.5 block text-sm font-semibold text-fg"
            >
              Correo
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-12 w-full rounded-xl border border-line bg-well px-4 text-base text-fg focus:border-brand focus:outline-none"
              placeholder="admin@ejemplo.com"
            />
          </div>
          <div>
            <label
              htmlFor="login-password"
              className="mb-1.5 block text-sm font-semibold text-fg"
            >
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
                className="min-h-12 w-full rounded-xl border border-line bg-well px-4 pr-12 text-base text-fg focus:border-brand focus:outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-fg-soft hover:bg-card"
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
            <p
              role="alert"
              className="rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm font-medium text-error"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="glow-red-sm mt-1 inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
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
