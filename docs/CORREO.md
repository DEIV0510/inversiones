# Correo automático (números al comprador)

Cuando una orden pasa a **PAGADA** y el comprador dejó su correo, el sistema le
envía sus números y su código de participación por email. Es el cierre del
flujo automático: el comprador paga en la pasarela y recibe todo por correo,
sin WhatsApp de por medio.

El envío se hace **fuera de la transacción** de base de datos y sin esperar
respuesta: si el proveedor falla, el pago queda igual de confirmado y el error
solo se registra en los logs.

---

## 1. Conseguir la clave en Resend

1. Entra a <https://resend.com> y crea una cuenta (el plan gratuito envía
   3.000 correos al mes).
2. Menú **API Keys** → **Create API Key**.
3. Nombre: `inversiones-dys`. Permiso: **Sending access**.
4. Copia la clave (empieza por `re_`). **Solo se muestra una vez.**

## 2. Verificar el dominio del remitente

Sin dominio verificado, Resend solo deja enviar desde `onboarding@resend.dev`
y **únicamente al correo dueño de la cuenta**. Sirve para probar, no para
vender.

1. Menú **Domains** → **Add Domain** → escribe el dominio (ej.
   `inversionesdys.com`).
2. Resend muestra unos registros DNS (`TXT` de verificación, `MX` y `TXT`
   de DKIM). Cópialos tal cual en el panel de tu proveedor de dominio.
3. Vuelve a Resend y pulsa **Verify**. Suele tardar de 5 minutos a 1 hora.
4. Cuando el dominio quede en **Verified**, ya puedes usar cualquier
   dirección de ese dominio como remitente (ej. `sorteos@inversionesdys.com`).

## 3. Variables de entorno en Vercel

Proyecto → **Settings** → **Environment Variables**:

| Variable         | Obligatoria | Ejemplo                       |
| ---------------- | ----------- | ----------------------------- |
| `RESEND_API_KEY` | Sí          | `re_XXXXXXXXXXXXXXXXXXXX`     |
| `EMAIL_FROM`     | No          | `sorteos@inversionesdys.com`  |

- Marca los entornos **Production**, **Preview** y **Development**.
- Después de guardarlas hay que **volver a desplegar** (Deployments → ⋯ →
  Redeploy) para que el servidor las lea.
- `EMAIL_FROM` es solo el valor por defecto: lo que el dueño escriba en
  **Panel → Configuración → Correo remitente** tiene prioridad.

En local, las mismas líneas van en el archivo `.env`:

```
RESEND_API_KEY="re_XXXXXXXXXXXXXXXXXXXX"
EMAIL_FROM="sorteos@inversionesdys.com"
```

## 4. Encenderlo en el panel

**Panel → Configuración**, bloque *Números por correo*:

- **Interruptor**: encendido envía, apagado no envía. Encendido de fábrica.
- **Correo remitente**: la dirección del dominio verificado.
- Debajo aparece el estado real del proveedor. Si dice *"Falta la clave del
  proveedor de correo"*, la variable `RESEND_API_KEY` no está en el servidor y
  **no sale ningún correo**, aunque el interruptor esté encendido.

## 5. Probarlo

1. Comprueba que el panel muestre *"Proveedor de correo conectado"*.
2. Entra al sitio como comprador, elige números en una rifa activa y **escribe
   un correo tuyo** en el formulario de compra.
3. Confirma el pago:
   - con pasarela: paga en Wompi (modo sandbox sirve), o
   - sin pasarela: **Panel → Pedidos** → busca la orden → **Confirmar pago**.
4. En segundos debe llegar el correo con los números y el código.

Si no llega:

- Mira la **bandeja de spam** y la pestaña *Promociones*.
- En Resend, menú **Logs**: ahí sale cada intento con su motivo de rechazo.
- En Vercel, **Deployments → Runtime Logs**: los fallos quedan como
  `[correo] ...` (`403` suele ser dominio sin verificar, `401` clave mal
  copiada).

## 6. Notas

- Solo se envía en la transición real a PAGADA. Si la pasarela repite el aviso
  del mismo pago, el correo **no** se duplica.
- Si el comprador no escribió correo, el sistema no intenta enviar nada.
- El correo es automático y sale de una dirección que no recibe respuestas.
