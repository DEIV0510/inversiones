type Props = {
  pct: number;
  className?: string;
};

/**
 * Barra de avance del sorteo. Por regla del negocio SOLO se muestra el
 * porcentaje alcanzado: nunca cantidades de números vendidos ni totales.
 */
export default function ProgressBar({ pct, className = "" }: Props) {
  const value = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className={className}>
      <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-fg-faint">
        Avance
      </span>

      {/* Canal delgado y oscuro con el punto de avance encendido */}
      <div
        className="relative mt-2 h-1.5 w-full rounded-full bg-well"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label={`Avance del sorteo: ${value} por ciento alcanzado`}
      >
        <div
          className="progress-fill h-full rounded-full bg-gradient-to-r from-brand-deep via-brand to-brand-light"
          style={{ width: `${value}%` }}
        />
        <span
          aria-hidden="true"
          className="glow-brand-sm absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-brand ring-2 ring-brand-light/40 transition-all duration-1000"
          // El punto se recorta dentro del canal para que nunca se desborde.
          style={{ left: `calc(${value}% - ${value * 0.14}px)` }}
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-3">
        <span className="font-display text-xl font-black leading-none tabular-nums text-brand sm:text-2xl">
          {value}%
        </span>
        {/* Aquí jamás va un contador de números: solo la palabra del avance. */}
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-faint">
          Alcanzado
        </span>
      </div>
    </div>
  );
}
