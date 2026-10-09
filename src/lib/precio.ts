/**
 * Precio de un pedido tal como lo ve el comprador ANTES de enviarlo.
 *
 * EL DINERO LO DECIDE EL SERVIDOR: estas cuentas son solo para que el
 * comprador vea de antemano lo que le van a cobrar, y por eso tienen que ser
 * la MISMA fórmula que aplica el motor de pedidos al crear la orden
 * (calcularTotalPedido en src/lib/engine/orders.ts) —precio de lista por la
 * cantidad, menos el porcentaje del paquete, redondeado al peso—. Si las dos
 * cuentas no dieran igual, el comprador vería un precio y pagaría otro.
 *
 * Archivo puro, sin nada de servidor: lo usan los dos selectores del
 * navegador (el de la rifa grande y el tablero de la cuadrícula).
 */

/** Lo que cuesta una cantidad con un descuento ya conocido. */
export function precioConDescuento(
  cantidad: number,
  precioUnitario: number,
  descuentoPct: number
): number {
  const lista = cantidad * precioUnitario;
  if (descuentoPct <= 0) return lista;
  return Math.round((lista * (100 - descuentoPct)) / 100);
}

/**
 * Descuento que le toca a una cantidad: el MAYOR de los paquetes cuya
 * cantidad coincide EXACTA (55 números al 10% cuestan menos; 54 y 56 se
 * pagan a precio de lista). Se recorren TODOS los paquetes de la rifa, igual
 * que el servidor, y no solo los que se pintan como tarjeta.
 */
export function descuentoPorCantidad(
  cantidad: number,
  paquetes: readonly { qty: number; discountPct: number }[]
): number {
  return paquetes.reduce(
    (mayor, p) =>
      p.qty === cantidad && p.discountPct > mayor ? p.discountPct : mayor,
    0
  );
}
