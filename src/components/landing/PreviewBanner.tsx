import Link from "next/link";

/**
 * Franja de VISTA PREVIA de un sorteo.
 *
 * Solo se pinta cuando alguien con sesión de panel abre una rifa que el
 * público todavía no puede ver (borrador o cancelada). Va fija justo debajo
 * de la cabecera, explica en palabras del dueño por qué esa página no es
 * visible y lleva de un toque a la ficha para publicarla.
 */

/** El estado real de la rifa, contado como se lo diría uno al dueño. */
const MENSAJES: Record<string, string> = {
  DRAFT: "Borrador: el público todavía no la ve",
  CANCELLED: "Cancelada: el público ya no la ve",
};

export default function PreviewBanner({
  raffleId,
  status,
}: {
  raffleId: string;
  status: string;
}) {
  const mensaje = MENSAJES[status] ?? "Sin publicar: el público todavía no la ve";

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-16 z-40 border-b border-warn/45 bg-bg2/95 backdrop-blur-md"
    >
      {/* A 360px el texto baja de línea y el botón se queda a la derecha:
          nada se desborda y el enlace conserva sus 44px de alto. */}
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 sm:px-6">
        <p className="min-w-0 flex-1 text-[11px] font-bold uppercase leading-snug tracking-[0.1em]">
          <span className="mr-1.5 whitespace-nowrap text-warn">
            <span
              aria-hidden="true"
              className="mr-1.5 inline-block h-[7px] w-[7px] shrink-0 rounded-full bg-warn align-middle"
            />
            Vista previa
          </span>
          <span className="text-fg">{mensaje}</span>
        </p>
        <Link
          href={`/admin/rifas/${raffleId}`}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-warn/50 bg-warn/15 px-4 text-[11px] font-bold uppercase tracking-[0.1em] text-warn transition-colors hover:bg-warn/25"
        >
          Publicar
        </Link>
      </div>
    </div>
  );
}
