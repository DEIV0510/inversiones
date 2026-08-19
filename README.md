# INVERSIONES D Y S — Plataforma de Rifas y Sorteos

Plataforma transaccional completa para **Inversiones D y S** (Sincelejo,
Sucre, Colombia): venta de números con reservas en tiempo real, pagos,
comprobantes, consulta de boletas y panel administrativo con roles —
preparada para rifas de **10.000, 100.000 o 1.000.000+ números**.

## Qué incluye

**Público** (dark premium, mobile-first, sensación de app):
- Landing con sorteo destacado y cards de sorteos con porcentaje de avance
  (regla de negocio: el público JAMÁS ve cantidades, solo el porcentaje).
- Página de cada sorteo con **selección de números escalable**: paquetes de
  cantidad (con etiqueta y descuento opcional), buscador puntual (O(1) a
  cualquier escala) y cuadrícula de números sugeridos. Al comprador nunca se
  le nombra "manual" ni "aleatorio": elige cuántos quiere o busca el suyo.
  Compra mínima por rifa, avisada antes de elegir nada.
- Checkout de 3 pasos con los **números guardados** un tiempo configurable
  (countdown), pago en línea (Wompi) y/o coordinación por WhatsApp según lo
  que tenga encendido cada rifa, y **comprobante digital** descargable con
  código de participación.
- **Los números no se ven hasta que el pago está confirmado**: antes solo se
  muestran fichas tapadas, la cantidad y el total.
- **Mis boletas** con un solo dato (celular, correo, cédula o código) y
  **Consultar número ganador**, que devuelve el nombre abreviado y el celular
  enmascarado del dueño de un número vendido.

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
| [docs/PAGOS.md](docs/PAGOS.md) | Wompi, cobro por WhatsApp y cálculo del total |
| [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) | Infraestructura, variables, backups |
| [docs/SEGURIDAD.md](docs/SEGURIDAD.md) | Auth, RBAC, rate limiting, auditoría |
| [docs/CORREO.md](docs/CORREO.md) | Envío de los números por correo (Resend) |

## Legal

/terminos y /privacidad describen lo que el sistema hace de verdad: qué se
guarda (nombre, celular, correo y cédula opcionales), cuánto tiempo se
apartan los números, cuándo se revelan, qué se publica de un ganador y qué
derechos tiene el comprador. El reglamento detallado de los sorteos y la
política completa de la Ley 1581 de 2012 siguen marcados como
`[PENDIENTE DE CONFIGURAR]`: los aporta el propietario con su asesor legal —
no se afirma ninguna autorización que no exista.
