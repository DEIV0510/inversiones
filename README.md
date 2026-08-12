# INVERSIONES D Y S — Plataforma de Sorteos

Plataforma web de sorteos (dinero en efectivo y motocicletas) para
**Inversiones D y S** (Sincelejo, Sucre, Colombia), con experiencia dark
premium tipo app y panel administrativo gestionable 100% desde el celular.

## Qué incluye

- **Landing pública** (`/`): sorteo destacado a pantalla completa, cards de
  sorteos con estado y **porcentaje de avance** (nunca se muestran cantidades
  de números), modal "Quiero participar" (nombre + WhatsApp → conversación
  directa), premios, cómo participar, confianza, ganadores, FAQ, condiciones
  y barra de acción inferior en móvil (Inicio · Sorteos · Mis boletas ·
  WhatsApp).
- **Panel administrativo** (`/admin`): login privado, dashboard, CRUD de
  rifas (imagen desde la galería del celular, título, premio, precio, fecha,
  slider de porcentaje, estado, orden, visible/oculta, vista previa antes de
  publicar), ganadores y ajustes (WhatsApp, ubicación, redes).
- **WhatsApp como canal de conversión**: todos los botones generan mensajes
  dinámicos con el nombre del sorteo. El número se cambia desde el panel.
- **"Mis boletas"** queda preparado para la fase de numeración automática
  (hoy dirige la consulta a WhatsApp).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Prisma + SQLite ·
sharp (optimización de imágenes a WebP) · jose + bcryptjs (sesión JWT en
cookie httpOnly).

## Puesta en marcha

```bash
npm install
copy .env.example .env   # y completa los valores (ver abajo)
npm run setup            # crea la base de datos y datos de ejemplo
npm run dev              # http://localhost:5236
```

### Variables de entorno (.env)

| Variable | Descripción |
| --- | --- |
| `DATABASE_URL` | `file:./dev.db` (SQLite local) |
| `AUTH_SECRET` | Secreto aleatorio de 64+ caracteres para firmar la sesión |
| `ADMIN_EMAIL` | Correo del administrador |
| `ADMIN_PASSWORD_HASH` | Hash bcrypt **en base64** — genera con `npm run hash-password -- "TuContraseña"` |
| `NEXT_PUBLIC_SITE_URL` | URL pública del sitio (SEO/Open Graph) |

> El hash se guarda en base64 porque bcrypt contiene `$` y el cargador de
> variables de entorno de Next lo corrompería. El comando `hash-password`
> ya entrega el valor listo para pegar.

## Estructura de datos

- `Raffle`: título, descripción, premio, imagen, precio (COP), fecha (texto
  flexible), `progressPct` (0–100, lo único visible al público),
  estado (`active | coming_soon | finished | sold_out`), orden,
  `isPublished`, `totalNumbers` (**interno**, preparado para la fase de
  numeración; jamás se expone) y notas.
- `Winner`: nombre, premio, sorteo, foto, fecha, `isDemo`, `isPublished`.
- `Setting`: nombre de empresa, WhatsApp, ubicación y redes.

Las rifas se leen de la base de datos: el administrador cambia información →
se publica → la landing se actualiza (revalidación on-demand + respaldo cada
5 minutos). No se edita código para operar el sitio.

## Seguridad

- Panel y API protegidos por sesión JWT (cookie httpOnly, SameSite lax).
- Contraseña con bcrypt (12 rondas), comparación a tiempo constante y
  limitador de intentos por IP.
- Validación de entradas con Zod; imágenes validadas y reprocesadas con
  sharp (nunca se sirve el archivo original).
- `/admin` y `/api` excluidos de robots.

## Despliegue

Pensado para un VPS/Node con disco persistente (SQLite + carpeta
`public/uploads`). Para plataformas serverless (Vercel) se debe migrar la
base a Postgres/Turso y las imágenes a un storage (S3/Blob) — la
arquitectura ya separa datos, storage y presentación para ese cambio.

## Evolución (fases siguientes)

Numeración automática de boletas, selección/reserva de números, registro de
compradores, pasarela de pagos, confirmaciones automáticas y estadísticas.
El modelo de datos y la sección "Mis boletas" ya lo contemplan.
