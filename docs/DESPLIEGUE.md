# Despliegue y operación

## Infraestructura (ya aprovisionada)

| Pieza | Recurso | Notas |
| --- | --- | --- |
| Hosting | Vercel, proyecto `inversiones` | Deploy automático al hacer push a `main` |
| Base de datos | Neon Postgres `inversiones-db` | Integración marketplace; inyecta `POSTGRES_*` |
| Base de datos DEV | Neon `inversiones-dev` | Para desarrollo local (no toca producción) |
| Imágenes | Vercel Blob `dys-media` (público) | Inyecta `BLOB_READ_WRITE_TOKEN` |
| Cron | Vercel Cron diario 6:00 UTC | `/api/cron/maintenance` con `CRON_SECRET` |

## Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `POSTGRES_PRISMA_URL` | ✔ | URL pooled de Neon (runtime) |
| `POSTGRES_URL_NON_POOLING` | ✔ | URL directa (migraciones/db push) |
| `AUTH_SECRET` | ✔ | 64+ chars aleatorios para la sesión JWT |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` | ✔ (seed) | Bootstrap del SUPER_ADMIN (hash bcrypt en base64) |
| `NEXT_PUBLIC_SITE_URL` | ✔ | URL pública (SEO, redirect de Wompi) |
| `BLOB_READ_WRITE_TOKEN` | prod | Lo inyecta la integración Blob |
| `CRON_SECRET` | ✔ prod | Autoriza el cron (Vercel lo envía como Bearer) |
| `WOMPI_PUBLIC_KEY` / `WOMPI_INTEGRITY_SECRET` / `WOMPI_EVENTS_SECRET` | opcional | Activan pago en línea (ver PAGOS.md) |

## Primer despliegue de una base nueva

```bash
vercel env pull .env.vercel --environment=production
# copiar POSTGRES_* al .env local
npx prisma db push        # crea el schema
npx tsx prisma/seed.ts    # settings + super admin + migración v1 si existe
```

## Desarrollo local

```bash
npm install
# .env → apuntar POSTGRES_* a la base DEV (inversiones-dev)
npm run dev               # http://localhost:5236
```

## Pruebas

```bash
npx vitest run                    # unitarias (motor puro, firmas, RBAC)
npx tsx scripts/test-engine.ts    # integración contra la DB del .env:
                                  # concurrencia, expiración, idempotencia
```

## Backups y recuperación

- Neon (plan free): restauración point-in-time de 24 h + branching para
  copias instantáneas. Para respaldos fríos:
  `pg_dump "$POSTGRES_URL_NON_POOLING" > backup.sql` (programable).
- Vercel Blob: las imágenes son públicas y re-subibles; el snapshot de datos
  guarda las URLs.
- Logs/monitoring: Vercel → Deployments → Functions (errores y latencias).
  La auditoría interna del negocio vive en la tabla `AuditLog` (panel →
  Auditoría).

## Checklist de salida a producción

1. `CRON_SECRET` configurado en Vercel.
2. Credenciales Wompi de PRODUCCIÓN (cuando el comercio esté aprobado).
3. `NEXT_PUBLIC_SITE_URL` con el dominio final.
4. Textos legales reales en /terminos y /privacidad (Ley 1581 de 2012).
5. Cambiar la contraseña del super admin desde Usuarios.
