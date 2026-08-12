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
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-fg-faint">
          Avance
        </span>
        <span className="font-display text-sm font-extrabold uppercase tabular-nums text-brand">
          {value}% alcanzado
        </span>
      </div>
      <div
        className="relative mt-2 h-2.5 w-full rounded-full bg-well"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label={`Avance del sorteo: ${value} por ciento alcanzado`}
      >
        <div
          className="progress-fill h-full rounded-full bg-gradient-to-r from-brand-deep via-brand to-brand"
          style={{ width: `${value}%` }}
        />
        <span
          aria-hidden="true"
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-brand glow-red-sm transition-all duration-1000"
          style={{ left: `calc(${value}% - ${value * 0.16}px)` }}
        />
      </div>
    </div>
  );
}
