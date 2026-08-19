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
│  /boletas  /ganador                         │
│  /terminos /privacidad                      │
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
- **Correo**: Resend por HTTP (sin SDK). Solo en la transición real a PAGADA
  y solo si el comprador dejó correo — ver `docs/CORREO.md`.

### Render y caché de las páginas públicas

| Página | Estrategia | Por qué |
| --- | --- | --- |
| `/` (portada) | `revalidate = 60` + `revalidatePath("/")` | Al público solo se le muestra el PORCENTAJE de avance, que no necesita ser exacto al segundo. Cada endpoint del panel que toca algo visible aquí revalida la ruta, así que los cambios no esperan al minuto. |
| `/sorteo/[slug]` | `force-dynamic` | Con sesión de panel enseña BORRADORES en vista previa: cachearla filtraría rifas sin publicar. |
| `/pedido/[code]`, `/boletas`, `/ganador` | `force-dynamic` | Datos por comprador; además verifican el pago contra la pasarela. |

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
  └─ validación de cantidad contra la RIFA
       minNumbersPerOrder ≤ cantidad ≤ maxNumbersPerOrder → si no, 422
  └─ precio: unitPrice y total los calcula el SERVIDOR leyendo la rifa
       (pricePerNumber + descuento del paquete que coincida en
        ticketPacksJson). El cliente nunca manda importes.
  └─ TX: upsert Participant + create Order + claimNumbers()
       claimNumbers: DELETE reservas expiradas del rango
                     INSERT ... ON CONFLICT DO NOTHING (skipDuplicates)
                     count < esperado → rollback + conflicto 409
Números apartados (reservedUntil = ahora + reservationMinutes)
  └─ La respuesta NO devuelve los números: el comprador ve cuántos tiene,
     el total y su código. Se revelan solo al confirmarse el pago.
  ├─ Pago Wompi → webhook firmado → confirmOrderPayment() [idempotente]
  ├─ Pago manual → admin confirma en el panel → mismo motor
  └─ Sin pago → expira: barrido del cron O liberación perezosa
confirmOrderPayment:
  RESERVED→PAID de las filas propias; re-reclama las perdidas si siguen
  libres; si otro las compró → orden REJECTED (gestión manual), JAMÁS se
  duplica un número. paidCount += cantidad; SOLD_OUT automático.
  Fuera de la transacción: correo con los números (si hay dirección y el
  proveedor está configurado); un fallo del correo no toca el pago.
```

## Configuración por rifa que cambia lo que ve el comprador

Todo esto vive en `Raffle` y se proyecta en `src/lib/public.ts`:

- `selectionMode` (MANUAL / RANDOM / BOTH): cómo elige. Al comprador NUNCA se
  le nombra "manual" ni "aleatorio" — solo ve paquetes de cantidad y/o el
  buscador de su número.
- `whatsappCheckout`: si está apagado, WhatsApp no aparece **ni como texto**
  en la página de esa rifa, ni en su pedido, ni en su cabecera/pie/barra.
  Para las pantallas transversales (`/boletas`, `/ganador`) se usa
  `hayRifasConWhatsApp()`, que lo esconde si NINGUNA rifa pública lo usa.
- `ticketPacksJson`: paquetes de cantidad, con etiqueta y descuento opcional
  (`[{ "q": 55, "label": "Más vendido", "off": 10 }]`). `parseTicketPacks` es
  el ÚNICO lector: lo usan la página y el cálculo del total, así que lo que
  se enseña y lo que se cobra salen de la misma lectura. Admite la forma
  vieja (`[1,2,5,10]`).
- `minNumbersPerOrder` / `maxNumbersPerOrder`: compra mínima y máxima. La
  mínima es pública a propósito (es condición de compra, no inventario) y se
  avisa ARRIBA del selector, antes de elegir nada.
- `imageAspect` (`4/3` · `1/1` · `9/16`): proporción del flyer. La foto se
  pinta con `object-contain` y un duplicado desenfocado de fondo, para no
  recortar los premios anticipados ni el precio que trae el flyer.
- `showPrize` / `showDrawDate`: filas opcionales de la ficha del sorteo.
- `PrizedNumber`: números con premio instantáneo, publicados en la página del
  sorteo y marcados en verde en el comprobante del ganador.

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
