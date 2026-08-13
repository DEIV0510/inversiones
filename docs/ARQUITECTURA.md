# Arquitectura — Plataforma de rifas INVERSIONES D Y S

## Visión general

```
Navegador (público)          Navegador (admin)
      │                            │
      ▼                            ▼
┌─────────────────────────────────────────────┐
│           Next.js 16 (App Router)           │
│                                             │
│  Páginas públicas   Panel admin (RBAC)      │
│  /  /sorteo/[slug]  /admin/* (12 módulos)   │
│  /pedido/[code]                             │
│  /boletas                                   │
│                                             │
│  API pública        API admin               │
│  /api/public/*      /api/admin/*            │
│                                             │
│  /api/webhooks/wompi   /api/cron/*          │
│                                             │
│  Motor (src/lib/engine): claims + orders    │
└──────────────┬──────────────┬───────────────┘
               │              │
        Neon Postgres    Vercel Blob
        (Prisma)         (imágenes)
```

- **Hosting**: Vercel (serverless). Deploy automático con cada push a `main`.
- **Base de datos**: Neon Postgres (pooled para runtime, directa para migraciones).
- **Storage**: Vercel Blob para imágenes subidas desde el panel (respaldo a
  disco local en desarrollo).
- **Jobs**: Vercel Cron diario (`/api/cron/maintenance`) + expiración
  perezosa en el motor (la corrección NO depende del cron).

## El motor de números (decisión central)

Para soportar 10.000 / 100.000 / 1.000.000+ números por rifa:

**Asignación perezosa.** Nunca se crean N filas por rifa ni se envía el
universo de números al navegador. Solo existe fila en `RaffleNumber` para
números TOMADOS (`RESERVED`, `PAID`, `BLOCKED`). Un número está disponible
cuando no tiene fila (o su reserva expiró).

- `UNIQUE(raffleId, number)`: Postgres es el árbitro final de concurrencia.
  Dos compras simultáneas del mismo número → una gana, la otra recibe
  conflicto. Verificado con prueba de integración (scripts/test-engine.ts).
- Búsqueda de un número: `findUnique` por índice único → O(1) a cualquier
  escala.
- Aleatorios: rondas de candidatos aleatorios filtrados contra la base +
  respaldo con `generate_series` por ventanas para rifas casi llenas.
- Conteos: contador atómico `paidCount` en la rifa (mantenido en la misma
  transacción del pago) + `groupBy` para el panel.

## Ciclo de vida de una compra

```
Selección → POST /api/public/orders
  └─ TX: upsert Participant + create Order + claimNumbers()
       claimNumbers: DELETE reservas expiradas del rango
                     INSERT ... ON CONFLICT DO NOTHING (skipDuplicates)
                     count < esperado → rollback + conflicto 409
Reserva activa (reservedUntil = ahora + reservationMinutes)
  ├─ Pago Wompi → webhook firmado → confirmOrderPayment() [idempotente]
  ├─ Pago manual → admin confirma en el panel → mismo motor
  └─ Sin pago → expira: barrido del cron O liberación perezosa
confirmOrderPayment:
  RESERVED→PAID de las filas propias; re-reclama las perdidas si siguen
  libres; si otro las compró → orden REJECTED (gestión manual), JAMÁS se
  duplica un número. paidCount += cantidad; SOLD_OUT automático.
```

## Módulos del panel

Dashboard · Sorteos (CRUD + duplicar) · Números (consulta puntual, lista
paginada, bloqueo por rango) · Pedidos (+confirmación/cancelación manual) ·
Reservas · Pagos · Participantes · Ganadores · Reportes (+CSV) ·
Configuración · Usuarios (roles) · Auditoría.

## RBAC

4 roles (SUPER_ADMIN, ADMIN, SOPORTE, FINANZAS) con matriz central en
`src/lib/rbac.ts`. Cada página llama `requirePanelAuth(permiso)` y cada
endpoint `requireAdminApi(permiso)` — los layouts NO son barrera de
seguridad en App Router.

## Escalabilidad

- Filas solo para números tomados → una rifa de 1M con 10k vendidos = 10k filas.
- Todas las listas del panel paginadas (max 100/página).
- Índices: `(raffleId, number)` único, `(raffleId, status)`,
  `(status, reservedUntil)`, `(orderId)`, órdenes por `(raffleId, status)`.
- Rate limiting en endpoints públicos (por IP + tope global).
- Pooling de conexiones vía Neon PgBouncer (`POSTGRES_PRISMA_URL`).
