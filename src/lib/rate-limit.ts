/**
 * Limitador de intentos en memoria (por instancia serverless). Suficiente
 * como fricción anti-abuso en endpoints públicos; el límite GLOBAL protege
 * incluso si la cabecera de IP es falsificada. Para límites distribuidos
 * duros, ver docs/SEGURIDAD.md (Upstash/Redis).
 */

type Bucket = { count: number; resetAt: number };

const stores = new Map<string, Map<string, Bucket>>();
const globals = new Map<string, Bucket>();

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const hops = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
  // Último salto: agregado por el proxy propio, no falsificable por el cliente.
  return hops[hops.length - 1] || "local";
}

export function isRateLimited(
  scope: string,
  key: string,
  opts: { max: number; windowMs: number; globalMax?: number }
): boolean {
  const now = Date.now();

  if (opts.globalMax) {
    let g = globals.get(scope);
    if (!g || now > g.resetAt) {
      g = { count: 0, resetAt: now + opts.windowMs };
      globals.set(scope, g);
    }
    g.count += 1;
    if (g.count > opts.globalMax) return true;
  }

  let store = stores.get(scope);
  if (!store) {
    store = new Map();
    stores.set(scope, store);
  }
  // Poda para acotar memoria.
  if (store.size > 5000) {
    for (const [k, b] of store) if (now > b.resetAt) store.delete(k);
  }

  const bucket = store.get(key);
  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > opts.max;
}
