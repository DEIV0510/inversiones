# API

Todas las respuestas son JSON (salvo el CSV de exportación). Errores:
`{ "error": "mensaje en español" }` con el status HTTP correspondiente.

## Pública (sin autenticación, con rate limiting)

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/api/public/orders` | Crea orden + reserva atómica. Body: `{raffleSlug, name, phone, email?, numbers?: int[], randomCount?: int}`. 201 → `{code, reservedUntil, total, quantity, numbers}`. 409 con `conflicting: int[]` si otros tomaron números. |
| GET | `/api/public/raffles/[slug]/number-status?n=00042` | Estado de un número: `{number, value, status: DISPONIBLE\|RESERVADO\|VENDIDO\|BLOQUEADO}` |
| GET | `/api/public/raffles/[slug]/suggestions?count=24` | Números disponibles sugeridos (candidatos, no reservas) |
| POST | `/api/public/lookup` | Mis boletas. Body `{phone, code}` → participaciones del comprador |
| POST | `/api/public/orders/[code]/verify` | Verifica el pago contra Wompi (server-side) y confirma si está aprobado |

## Webhooks y cron

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/api/webhooks/wompi` | Eventos de Wompi (firma verificada, idempotente) |
| GET | `/api/cron/maintenance` | Barrido de reservas vencidas. Header `Authorization: Bearer CRON_SECRET` |

## Admin (sesión + permiso RBAC por endpoint)

| Método | Ruta | Permiso |
| --- | --- | --- |
| POST | `/api/admin/login` · `/api/admin/logout` | — |
| GET/POST | `/api/admin/raffles` | numbers.view / raffles.manage |
| GET/PATCH/DELETE | `/api/admin/raffles/[id]` | raffles.manage |
| POST | `/api/admin/raffles/[id]/duplicate` | raffles.manage |
| GET | `/api/admin/numbers?raffleId=&status=&page=&n=` | numbers.view |
| POST | `/api/admin/numbers/block` `{raffleId, from, to?, action}` | numbers.block |
| GET | `/api/admin/orders?page=&status=&q=&raffleId=` | orders.view |
| POST | `/api/admin/orders/[id]/confirm` | orders.confirm |
| POST | `/api/admin/orders/[id]/cancel` | orders.cancel |
| GET | `/api/admin/reservations` | reservations.view |
| GET | `/api/admin/payments` | payments.view |
| GET | `/api/admin/participants?q=&page=` | participants.view |
| GET/POST | `/api/admin/winners` · PATCH/DELETE `[id]` | winners.manage |
| GET | `/api/admin/reports/export?raffleId=&status=` (CSV) | reports.view |
| PATCH | `/api/admin/settings` | settings.manage |
| GET/POST | `/api/admin/users` · PATCH/DELETE `[id]` | users.manage |
| GET | `/api/admin/audit?entity=&action=&page=` | audit.view |
| POST | `/api/admin/upload` (multipart, ≤10 MB → WebP en Blob) | raffles.manage |

Paginación estándar: `?page=1&perPage=25` → `{total, page, perPage, items}`.
