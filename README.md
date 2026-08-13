# INVERSIONES D Y S — Plataforma de Rifas y Sorteos

Plataforma transaccional completa para **Inversiones D y S** (Sincelejo,
Sucre, Colombia): venta de números con reservas en tiempo real, pagos,
comprobantes, consulta de boletas y panel administrativo con roles —
preparada para rifas de **10.000, 100.000 o 1.000.000+ números**.

## Qué incluye

**Público** (dark premium, mobile-first, sensación de app):
- Landing con sorteo destacado y cards de sorteos con porcentaje de avance
  (regla de negocio: el público JAMÁS ve cantidades, solo el porcentaje).
- Página de cada sorteo con **selección de números escalable**: buscador
  puntual (O(1) a cualquier escala), cuadrícula de números disponibles
  sugeridos y modo "al azar" resuelto en el backend.
- Checkout de 3 pasos con **reserva temporal** (countdown configurable),
  pago en línea (Wompi) o coordinación por WhatsApp, **comprobante digital**
  con código de participación y **Mis boletas** (teléfono + código).

**Motor** (Postgres + Prisma):
- Asignación perezosa: solo existen filas para números tomados;
  `UNIQUE(raffleId, number)` arbitra la concurrencia a nivel de base de
  datos. Verificado: 6 compradores simultáneos del mismo número →
  exactamente 1 gana.
- Confirmación de pago **idempotente** (webhook repetido = sin efectos
  dobles) que jamás duplica un número.
- Expiración de reservas por barrido (cron) + liberación perezosa (la
  corrección no depende del cron).

**Panel admin** (RBAC con 4 roles: Super admin, Administrador, Soporte,
Finanzas): Dashboard con métricas e ingresos, Sorteos (CRUD completo,
duplicar, estados, imágenes desde el celular), Números (consulta, lista
paginada, bloqueo por rangos), Pedidos (confirmación manual de pagos),
Reservas, Pagos, Participantes, Ganadores, Reportes con exportación CSV,
Configuración, Usuarios y Auditoría de acciones críticas.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Prisma + **Neon
Postgres** · **Vercel Blob** · sharp · jose + bcryptjs · Wompi · Vercel
(hosting + cron).

## Empezar

```bash
npm install
copy .env.example .env    # completar valores (ver docs/DESPLIEGUE.md)
npm run setup             # prisma db push + seed (super admin + settings)
npm run dev               # http://localhost:5236
```

## Pruebas

```bash
npx vitest run                    # unitarias
npx tsx scripts/test-engine.ts    # integración: concurrencia, expiración,
                                  # idempotencia (contra la DB del .env)
```

## Documentación

| Doc | Contenido |
| --- | --- |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Diseño del sistema y del motor de números |
| [docs/API.md](docs/API.md) | Endpoints públicos y admin |
| [docs/PAGOS.md](docs/PAGOS.md) | Wompi: activación, webhook, sandbox |
| [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) | Infraestructura, variables, backups |
| [docs/SEGURIDAD.md](docs/SEGURIDAD.md) | Auth, RBAC, rate limiting, auditoría |

## Legal

La plataforma deja los espacios preparados (/terminos, /privacidad y
términos por sorteo). Los textos legales definitivos y la información de
autorización correspondiente deben ser aportados por el propietario — no se
afirma ninguna autorización que no exista.
