# Pagos — Wompi + confirmación manual

## Estado actual

La plataforma opera con DOS flujos de pago reales:

1. **WhatsApp (por rifa, encendido de fábrica)**: el comprador aparta sus
   números y coordina el pago por WhatsApp (Nequi/transferencia) con el
   CÓDIGO de su pedido. El administrador verifica el dinero y confirma el
   pedido en el panel (Pedidos → Confirmar pago). Pasa por el mismo motor
   idempotente que la pasarela. Se controla con `whatsappCheckout` en cada
   rifa; apagado, WhatsApp desaparece de esa rifa incluso como texto.
2. **Wompi (se activa con credenciales)**: pago en línea con Nequi, PSE,
   tarjetas y Botón Bancolombia. Sin credenciales configuradas, el botón
   "Pagar en línea" NO se muestra (nada simulado).

> ⚠️ **Una rifa necesita AL MENOS uno de los dos.** Con `whatsappCheckout`
> apagado y sin credenciales de Wompi, el comprador llega a "Realiza el pago"
> con sus números apartados y sin un solo botón para pagar. Ya pasó en
> producción. La pantalla de pedido ahora muestra un respaldo con los datos
> del organizador, pero eso es una red de seguridad, no una forma de cobrar:
> antes de apagar WhatsApp en una rifa hay que tener la pasarela activa.

> **Los números no se revelan hasta que el pago está confirmado.** Con el
> pedido PENDIENTE o EXPIRADO el comprador ve cuántos números tiene
> apartados (fichas tapadas), el total y su código, pero nunca los números:
> no salen de la página del pedido, ni de la respuesta del API que crea el
> pedido, ni del mensaje de WhatsApp, ni de "Mis boletas". Se muestran (y se
> envían por correo, si dejó dirección y el proveedor está configurado) al
> confirmarse el pago. Cierra el fraude de capturar los números sin pagar y
> reclamarlos después. El apartado NO cambia: los números se siguen guardando
> en el momento de comprar.

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

5. Redeploy. El botón "Pagar en línea (Nequi, PSE, tarjeta)" aparece
   automáticamente en la página de pedido.

## Cómo se confirma un pago (nunca desde el navegador)

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

- **Idempotencia**: `providerTxId` es único en la tabla Payment; eventos
  repetidos no duplican efectos.
- **Integridad**: el checkout viaja firmado
  (`SHA256(referencia+centavos+COP+secreto)`), nadie puede alterar el monto.
- **Pago tardío**: si la reserva expiró y otro compró los números, el pago
  queda registrado, la orden pasa a REJECTED y queda en auditoría para
  gestión manual (reembolso). Jamás se duplica un número.
- No se almacena ningún dato de tarjetas: todo ocurre en Wompi.

## Probar en sandbox

Con llaves `pub_test_*`: tarjeta APPROVED `4242 4242 4242 4242`, cualquier
CVC/fecha futura. Nequi sandbox: aprobar desde el simulador del dashboard.
