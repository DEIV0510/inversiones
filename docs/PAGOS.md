# Pagos — Bold + Wompi + confirmación manual

## Estado actual

La plataforma cobra por DOS caminos, y cada rifa decide cuáles usa:

1. **WhatsApp (interruptor `whatsappCheckout`, encendido de fábrica)**: el
   comprador aparta sus números y coordina el pago por WhatsApp
   (Nequi/transferencia) con el CÓDIGO de su pedido. El administrador
   verifica el dinero y confirma el pedido en el panel (Pedidos → Confirmar
   pago). Pasa por el mismo motor idempotente que la pasarela. Apagado,
   WhatsApp desaparece de esa rifa incluso como texto.
2. **Pasarela de pago (interruptor `gatewayCheckout`, encendido de fábrica)**:
   pago en línea con tarjeta, PSE, Nequi y botón Bancolombia. Hacen falta las
   DOS cosas: llaves configuradas en el entorno **y** el interruptor de la
   rifa encendido. Sin llaves no se muestra nada (nada simulado); con llaves
   pero el interruptor apagado, esa rifa cobra solo por WhatsApp.

Los dos interruptores son gemelos y viven en cada rifa: el dueño decide, rifa
por rifa, si cobra a mano, con pasarela, o con las dos.

> ⚠️ **Una rifa necesita AL MENOS una forma de cobrar.** Con
> `whatsappCheckout` apagado y sin pasarela útil (o con `gatewayCheckout`
> apagado), el comprador llega a "Realiza el pago" con sus números apartados y
> sin un solo botón. Ya pasó en producción. Por eso el panel bloquea publicar
> así y el API responde 422. La comprobación vive en un solo sitio:
> `rifaTieneFormaDeCobro()` en `src/lib/pasarela.ts`. La pantalla de pedido
> muestra además un respaldo con los datos del organizador, pero eso es una
> red de seguridad, no una forma de cobrar.

> **Los números no se revelan hasta que el pago está confirmado.** Con el
> pedido PENDIENTE o EXPIRADO el comprador ve cuántos números tiene
> apartados (fichas tapadas), el total y su código, pero nunca los números:
> no salen de la página del pedido, ni de la respuesta del API que crea el
> pedido, ni del mensaje de WhatsApp, ni de "Mis boletas". Se muestran (y se
> envían por correo, si dejó dirección y el proveedor está configurado) al
> confirmarse el pago. Cierra el fraude de capturar los números sin pagar y
> reclamarlos después. El apartado NO cambia: los números se siguen guardando
> en el momento de comprar.

## Qué pasarela se usa

Puede haber dos configuradas a la vez. Nadie fuera de `src/lib/pasarela.ts`
debería preguntar "¿está Bold?" o "¿está Wompi?":

| Función (`src/lib/pasarela.ts`) | Para qué sirve |
| --- | --- |
| `pasarelaActiva()` | `"bold"`, `"wompi"` o `null`. **Si están las dos, gana Bold** (es la cuenta que el dueño tiene de verdad). |
| `hayPasarela()` | ¿Hay alguna pasarela útil en el entorno? |
| `pasarelaDeRifa(rifa)` | Lo que se le ofrece al comprador en ESA rifa (cuenta `gatewayCheckout`). |
| `rifaTieneFormaDeCobro(rifa)` | La regla de arriba: WhatsApp o pasarela, pero alguna. |

Wompi se mantiene aunque Bold sea la preferida: su webhook y su verificación
por referencia siguen vivos, así que los pagos hechos con Wompi se confirman
igual que siempre.

## Cuánto se cobra (lo decide el servidor)

`createOrder` calcula el importe leyendo la RIFA, nunca el cuerpo de la
petición:

1. Se comprueba la cantidad contra `minNumbersPerOrder` /
   `maxNumbersPerOrder` → 422 si no encaja.
2. `unitPrice` = `pricePerNumber` de la rifa. Se guarda el precio de LISTA a
   propósito, sin rebajar.
3. `total` = bruto menos el descuento del paquete cuya cantidad COINCIDE
   exactamente con la comprada (`ticketPacksJson`, campo `off`, 1-90 %).
   Se redondea con `Math.round` (el peso colombiano no tiene decimales).
4. Guardando el precio de lista en `unitPrice` y el rebajado en `total`, el
   comprobante puede mostrar los dos y cuánto se ahorró.

Un `ticketPacksJson` corrupto se lee como "sin paquetes": se cobra el precio
de lista. Ante la duda nunca se aplica un descuento inventado.

**Ese `total` guardado es el único monto que existe.** Es el que se firma
para cobrar y el que se compara al confirmar. Ni el navegador ni el webhook
pueden proponer otro.

---

# Bold

## Estado en producción (20 de agosto de 2026)

| Paso | Estado |
|---|---|
| `BOLD_IDENTITY_KEY` en Vercel (Production) | ✅ cargada |
| `BOLD_SECRET_KEY` en Vercel (Production, Sensitive) | ✅ cargada por el dueño |
| Despliegue con las llaves activas | ✅ |
| Botón renderizando en `/pedido/<código>` | ✅ verificado |
| Webhook registrado en el panel de Bold | ✅ (21/08/2026, producción, 4 eventos) |
| Consulta de comprobante como respaldo | ✅ (2026-08-21) |
| Aviso de vencidos con pago aprobado | ✅ (2026-08-21) |
| `RESEND_API_KEY` para el correo al comprador | ⬜ **falta: sin ella no sale ningún correo** |

Mientras el webhook no esté registrado, el cobro SÍ entra a la cuenta de Bold
pero la confirmación deja de ser instantánea. Hay tres caminos y conviene
saber qué da cada uno:

| Vía | Cuándo confirma | Hace falta |
|---|---|---|
| **Webhook firmado** | en segundos, solo | registrarlo en el panel de Bold |
| "Ya pagué — verificar" | cuando el comprador lo toca (~10 min después del pago) | nada, ya funciona |
| Barrido del cron | una vez al día | nada, ya funciona |

Los dos últimos usan la **consulta de comprobante** (ver abajo) y existen para
que el dueño no tenga que marcar pagos a mano. Pero el webhook sigue siendo lo
que hace que el comprador vea sus números al instante, que es lo que evita que
abandone el carrito. **Regístralo.**

## Consulta de comprobante (respaldo)

```
GET https://payments.api.bold.co/v2/payment-voucher/{orderId}
Authorization: x-api-key {LLAVE DE IDENTIDAD}
```

⚠️ En esa cabecera va la llave de **identidad**, no la secreta (con la secreta
responde 401). ⚠️ Bold avisa que la consulta puede tardar **~10 minutos** en
reflejar una venta: hasta entonces devuelve `NO_TRANSACTION_FOUND`. Por eso es
respaldo y no vía principal.

Estados: `APPROVED`, `REJECTED`, `FAILED`, `VOIDED`, `PROCESSING`, `PENDING`,
`NO_TRANSACTION_FOUND`. Solo `APPROVED` **y monto exacto** confirman
(`boldVoucherConfirmaOrden`). "No se pudo saber" (red caída, timeout, JSON
roto) jamás se traduce como pagado.

Lo usan `/api/public/orders/[code]/verify` (botón "Ya pagué — verificar") y
`src/lib/engine/barrido-bold.ts` (desde el cron diario, que corre ANTES de
vencer pedidos para no soltarle a otro los números de alguien que sí pagó).

## Por qué el Botón de Pagos y no un enlace de pago

Los enlaces de `checkout.bold.co/payment/LNK_...` son de **monto fijo**: sirven
para vender siempre lo mismo. En una rifa cada pedido vale distinto y hay que
saber CUÁL se pagó. Por eso se integra el **Botón de Pagos** (integración
manual), que lleva monto, referencia por pedido, firma de integridad y
webhook.

## Activar Bold

1. Cuenta en el **Panel de Comercios** de Bold (https://comercios.bold.co) con
   el comercio verificado.
2. **Integraciones → Llaves de integración**: copiar las dos llaves.
   - **Llave de identidad**: es pública, es la única que baja al navegador.
   - **Llave secreta**: firma el botón y valida el webhook. **Jamás** puede
     llegar al navegador ni subirse al repositorio.
3. Configurar en Vercel (Settings → Environment Variables) y en `.env`:

```
BOLD_IDENTITY_KEY="..."
BOLD_SECRET_KEY="..."
```

4. **Integraciones → Configurar webhook** (admite hasta 5 direcciones),
   registrar:

```
https://inversionesdys.co/api/webhooks/bold
```

5. Redeploy. El botón de pago aparece en la página del pedido de las rifas que
   tengan `gatewayCheckout` encendido.

Esos dos pasos (crear las llaves y registrar el webhook) los hace el DUEÑO en
su panel de Bold; desde el código no se pueden registrar.

## Cómo se cobra (firma de integridad)

El servidor arma los atributos del `<script data-bold-button>` con
`boldButtonConfig()` (`src/lib/bold.ts`):

| Atributo | Valor |
| --- | --- |
| `data-api-key` | llave de IDENTIDAD |
| `data-amount` | `order.total` (entero, sin decimales, mínimo $1.000) |
| `data-currency` | `COP` |
| `data-order-id` | `DYS-<código del pedido>` (único, máx. 60 caracteres) |
| `data-integrity-signature` | ver abajo |
| `data-redirection-url` | `/pedido/<código>` |
| `data-description` | 2 a 100 caracteres |
| `data-customer-data` | JSON opcional (email, fullName, phone) |

La firma es:

```
SHA256( {OrderId} + {Amount} + {Currency} + {LlaveSecreta} )   → hexadecimal
```

Se calcula **siempre en el servidor**. Lo que baja al navegador es solo el
hash, y ese hash ata el monto: si alguien edita el `data-amount` en el HTML,
la firma deja de cuadrar y Bold rechaza la operación.

Topes de Bold: **$1.000 mínimo**, tarjeta hasta $5.000.000, PSE hasta
$10.000.000 (`boldAmountSupported()`).

## Cómo se confirma un pago (nunca desde el navegador)

```
Bold aprueba el pago
   │
   ├─ Webhook POST /api/webhooks/bold          ← vía principal
   │    1. se lee el cuerpo CRUDO (req.text)
   │    2. firma verificada: HMAC-SHA256( base64(cuerpo), llave secreta )
   │       en hex, comparada en tiempo constante contra x-bold-signature
   │    3. solo SALE_APPROVED confirma; el resto responde 200 y se ignora
   │    4. la orden se busca por data.metadata.reference (= data-order-id)
   │    5. boldTransactionMatchesOrder: moneda COP y amount.total EXACTO
   │    6. confirmOrderPayment(provider "bold", providerTxId = payment_id)
   │
   └─ Redirect del comprador a /pedido/[code]
        Bold NO expone una consulta pública "estado de la referencia X",
        así que aquí no se consulta nada: /api/public/orders/[code]/verify
        solo RELEE el estado en la base y responde esperandoWebhook:true
        mientras siga pendiente. (Con Wompi sí se consulta su API.)
```

- **Idempotencia**: `providerTxId` es único en la tabla Payment y
  `confirmOrderPayment` bloquea la fila (`FOR UPDATE`); un webhook reintentado
  por Bold no duplica nada y responde 200.
- **Monto que no cuadra**: no se confirma. Queda un `Payment` en estado ERROR y
  un registro de auditoría `payment.amount_mismatch` con lo esperado y lo
  recibido, para gestión manual. Nuestro botón no habilita propina, así que
  `amount.total` tiene que ser el total del pedido, ni un peso más ni uno
  menos.
- **SALE_REJECTED**: se registra el intento fallido; la orden sigue PENDIENTE
  hasta que expire.
- **Firma inválida**: 401 y no se toca nada.
- **Pago tardío**: si la reserva expiró y otro compró los números, el pago
  queda registrado, la orden pasa a REJECTED y queda en auditoría para
  gestión manual (reembolso). Jamás se duplica un número.
- No se almacena ningún dato de tarjetas: todo ocurre en Bold.

## Probar Bold en sandbox

En el ambiente de PRUEBAS, Bold firma el webhook con la llave secreta **vacía**
(cadena vacía). Aceptar eso a ciegas sería un agujero enorme: cualquiera podría
firmar un "pago aprobado". Por eso hacen falta dos condiciones:

```
BOLD_ENV="test"          # y además NODE_ENV distinto de production
```

En un despliegue de producción esa firma **nunca** se acepta, aunque quedara
`BOLD_ENV=test` por descuido. Las pruebas de sandbox se hacen contra
`npm run dev` (con un túnel si hace falta que Bold alcance el equipo).

Para simular el webhook a mano:

```bash
CUERPO='{"type":"SALE_APPROVED","data":{"payment_id":"TEST1","amount":{"currency":"COP","total":20000},"metadata":{"reference":"DYS-ABC12345"}}}'
FIRMA=$(node -e "const c=require('crypto');const b=Buffer.from(process.argv[1],'utf8').toString('base64');console.log(c.createHmac('sha256',process.env.BOLD_SECRET_KEY||'').update(b).digest('hex'))" "$CUERPO")
curl -X POST http://localhost:5236/api/webhooks/bold \
  -H "Content-Type: application/json" -H "x-bold-signature: $FIRMA" \
  --data-raw "$CUERPO"
```

(El `--data-raw` es a propósito: la firma se calcula sobre esos bytes exactos.)

Las pruebas automáticas de todo esto están en `tests/bold.test.ts`
(`npx vitest run tests/bold.test.ts`), incluida la firma del ejemplo oficial de
Bold.

---

# Wompi (segunda pasarela)

## Activar Wompi

1. Crear cuenta en https://comercios.wompi.co y completar la verificación
   del comercio.
2. En el dashboard de Wompi copiar las llaves (sandbox para probar,
   producción al salir en vivo).
3. Configurar en Vercel (Settings → Environment Variables) y en `.env`:

```
WOMPI_PUBLIC_KEY="pub_prod_xxxx"        # o pub_test_xxxx en sandbox
WOMPI_INTEGRITY_SECRET="prod_integrity_xxxx"
WOMPI_EVENTS_SECRET="prod_events_xxxx"
```

4. En Wompi → Configuración → URL de eventos, registrar:

```
https://<tu-dominio>/api/webhooks/wompi
```

5. Redeploy. Si Bold NO está configurada, el botón "Pagar en línea (Nequi,
   PSE, tarjeta)" aparece automáticamente en la página de pedido.

## Cómo se confirma un pago

```
Wompi aprueba la transacción
   │
   ├─ Webhook /api/webhooks/wompi
   │    firma del evento verificada (SHA-256 con WOMPI_EVENTS_SECRET)
   │    → confirmOrderPayment() idempotente
   │
   └─ Redirect del comprador a /pedido/[code]
        el SERVIDOR consulta la transacción por referencia en el API de
        Wompi (nunca lee parámetros del navegador) → mismo motor
```

- **Integridad**: el checkout viaja firmado
  (`SHA256(referencia+centavos+COP+secreto)`), nadie puede alterar el monto.
- Mismas garantías de idempotencia, monto exacto y pago tardío que Bold.
- Ojo con las unidades: **Wompi cobra en CENTAVOS** (`amount_in_cents`) y
  **Bold en PESOS** (`amount.total`). Cada `...MatchesOrder` hace su propia
  conversión; no se mezclan.

## Probar Wompi en sandbox

Con llaves `pub_test_*`: tarjeta APPROVED `4242 4242 4242 4242`, cualquier
CVC/fecha futura. Nequi sandbox: aprobar desde el simulador del dashboard.
