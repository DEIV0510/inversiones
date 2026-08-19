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
  órdenes 10/10min + 300 global · búsqueda de número 60/min + 2000 ·
  sugerencias 30/min + 1000 · verificación de pago 20/min + 500 ·
  "¿quién ganó?" 20/10min + 400 · login 8/10min + 40.
- **"Mis boletas" con UN solo dato** (celular, correo, cédula o código de
  8 caracteres): el dueño lo pidió así, como en las plataformas de rifas.
  Al bajar de credencial doble a dato único, el riesgo se acota con: doble
  ventana de intentos (8/10min **y** 25/hora, +150/+600 globales), respuesta
  literalmente IDÉNTICA en todos los casos sin resultado (no revela si el
  dato existe, si está mal escrito o si no se supo interpretar) y proyección
  mínima: se devuelven nombre y pedidos, nunca el teléfono, el correo ni la
  cédula del comprador.
- **Números ocultos hasta el pago**: los números de un pedido no salen del
  servidor mientras la orden no esté PAGADA — ni en la respuesta que crea la
  orden, ni en "Mis boletas", ni en la página del pedido, ni en el mensaje de
  WhatsApp. Solo viaja la cantidad, para pintar las fichas tapadas.
- **/ganador (dueño de un número)**: solo responde por números VENDIDOS y con
  la orden PAGADA; devuelve el nombre abreviado ("Wilson A. T.") y el
  teléfono enmascarado ("310 *** 0187"), nunca correo ni cédula. Un número
  libre, apartado o bloqueado devuelve lo mismo (null) sin distinguir entre
  esos casos: eso es inventario y al público no se le informa.
- La regla "solo porcentaje": la capa pública (`src/lib/public.ts`) nunca
  proyecta cantidades vendidas; los conteos reales solo existen en
  endpoints admin protegidos. La compra mínima/máxima por pedido SÍ es
  pública a propósito: es una condición de compra, no inventario.
- El dinero lo decide el servidor: precio por número, compra mínima y
  descuento por paquete se leen de la rifa (`parseTicketPacks`), nunca del
  cuerpo de la petición.

## Pagos

- Firma de integridad en el checkout (el monto no puede alterarse).
- Webhook verificado criptográficamente + verificación de respaldo
  consultando el API de Wompi server-side. El navegador JAMÁS confirma un
  pago.
- Idempotencia por `providerTxId` único.

## Datos

- Sin datos de tarjetas (viven en Wompi). Participantes: nombre y teléfono
  (obligatorios) + correo y cédula OPCIONALES. La cédula se pide solo para
  que el comprador encuentre sus boletas si no recuerda el código ni con qué
  teléfono compró; nunca se publica ni se devuelve en ninguna consulta
  pública. Está declarada en /privacidad.
- SQL injection: Prisma parametriza todo; el único `$queryRaw` usa
  parámetros tipados.
- XSS: React escapa por defecto. El único `dangerouslySetInnerHTML` con datos
  editables es el JSON-LD de la portada, y pasa por `jsonLdSeguro`
  (`src/lib/jsonld.ts`), que convierte `< > &` en secuencias `\uXXXX`: sin
  eso, un `</script>` escrito en Configuración cerraría la etiqueta y
  ejecutaría código en la web pública.
- Imágenes subidas: re-procesadas SIEMPRE con sharp (nunca se sirve el
  archivo original), límite 10 MB verificado antes de bufferizar.
- CSRF: mutaciones con JSON + SameSite Lax; sin formularios cross-site.
- Secretos solo en variables de entorno (nunca en el repo ni en el cliente).

## Cabeceras HTTP

Definidas en `next.config.ts` para todas las rutas:

- `X-Frame-Options: DENY` + `Content-Security-Policy: frame-ancestors 'none'`:
  nadie puede meter el panel en un iframe y hacer que el administrador pulse
  sin querer "confirmar pago" o "eliminar rifa" (clickjacking).
- `X-Content-Type-Options: nosniff`: el navegador no adivina el tipo de un
  archivo servido.
- `Referrer-Policy: strict-origin-when-cross-origin`: el código del pedido va
  en la URL de `/pedido/[code]` y no debe viajar en el Referer a terceros.
- `Permissions-Policy`: cámara, micrófono y ubicación apagados.

## Auditoría

Acciones críticas registradas en `AuditLog` (actor, rol, acción, entidad,
detalle, fecha): cambios de precio/total/estado/porcentaje de rifas,
bloqueos de números, confirmaciones y cancelaciones de pago, ganadores,
usuarios, configuración y logins. Visible en el panel (Auditoría) para
SUPER_ADMIN/ADMIN. No hay modificaciones silenciosas.

## Mejoras recomendadas a futuro

- Rate limiting distribuido (Upstash Redis) si el tráfico crece.
- 2FA para el panel (TOTP).
- CSP completa (`script-src` con nonce), no solo `frame-ancestors`.
- Cerrar las sesiones abiertas al cambiar la contraseña de un usuario (hoy el
  token anterior sigue siendo válido hasta que caduca o se desactiva la
  cuenta).
