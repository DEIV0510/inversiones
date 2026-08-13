# Seguridad

## Autenticación y autorización

- Panel: sesión JWT (HS256, `AUTH_SECRET`) en cookie `httpOnly` + `SameSite
  Lax` + `Secure` en producción, 7 días.
- Usuarios admin en base de datos con bcrypt (12 rondas). Un usuario
  desactivado pierde acceso al instante (verificación contra DB en cada
  página/endpoint).
- **RBAC**: matriz central (`src/lib/rbac.ts`) con 4 roles. Guards:
  `requirePanelAuth(permiso)` en CADA página del panel y
  `requireAdminApi(permiso)` en CADA endpoint admin. Los layouts no son
  barrera (no se re-ejecutan en navegaciones suaves).
- Protecciones de cuenta: nadie se degrada/desactiva a sí mismo; siempre
  queda al menos un SUPER_ADMIN activo.

## Endpoints públicos

- Validación de entrada con Zod en todos los bodies/params.
- Rate limiting por IP (último salto de x-forwarded-for, no falsificable)
  + tope GLOBAL por ventana (protege aunque la IP se falsifique):
  órdenes 10/10min, búsquedas 60/min, lookup de boletas 10/10min, login
  8/10min + 40 global.
- "Mis boletas": credencial DOBLE (teléfono + código de 8 caracteres de
  ~40 bits). Respuesta idéntica si falla cualquiera de los dos (no se
  filtra cuál). Jamás se expone información solo con el teléfono.
- La regla "solo porcentaje": la capa pública (`src/lib/public.ts`) nunca
  proyecta cantidades vendidas; los conteos reales solo existen en
  endpoints admin protegidos.

## Pagos

- Firma de integridad en el checkout (el monto no puede alterarse).
- Webhook verificado criptográficamente + verificación de respaldo
  consultando el API de Wompi server-side. El navegador JAMÁS confirma un
  pago.
- Idempotencia por `providerTxId` único.

## Datos

- Sin datos de tarjetas (viven en Wompi). Participantes: solo nombre,
  teléfono y email opcional (minimización).
- SQL injection: Prisma parametriza todo; el único `$queryRaw` usa
  parámetros tipados.
- XSS: React escapa por defecto; no hay `dangerouslySetInnerHTML` con datos
  de usuarios (solo JSON-LD generado por el servidor).
- Imágenes subidas: re-procesadas SIEMPRE con sharp (nunca se sirve el
  archivo original), límite 10 MB verificado antes de bufferizar.
- CSRF: mutaciones con JSON + SameSite Lax; sin formularios cross-site.
- Secretos solo en variables de entorno (nunca en el repo ni en el cliente).

## Auditoría

Acciones críticas registradas en `AuditLog` (actor, rol, acción, entidad,
detalle, fecha): cambios de precio/total/estado/porcentaje de rifas,
bloqueos de números, confirmaciones y cancelaciones de pago, ganadores,
usuarios, configuración y logins. Visible en el panel (Auditoría) para
SUPER_ADMIN/ADMIN. No hay modificaciones silenciosas.

## Mejoras recomendadas a futuro

- Rate limiting distribuido (Upstash Redis) si el tráfico crece.
- 2FA para el panel (TOTP).
- CSP estricta vía headers en next.config.
