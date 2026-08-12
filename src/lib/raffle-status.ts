// Metadatos de estado de rifa, seguros para componentes cliente
// (sin dependencias de Prisma ni de código de servidor).

export const RAFFLE_STATUSES = [
  "active",
  "coming_soon",
  "finished",
  "sold_out",
] as const;

export type RaffleStatus = (typeof RAFFLE_STATUSES)[number];

export const STATUS_META: Record<RaffleStatus, { label: string; badgeClass: string }> = {
  active: { label: "Activa", badgeClass: "bg-brand text-white glow-red-sm" },
  coming_soon: {
    label: "Próximamente",
    badgeClass: "border border-line-strong bg-well text-fg",
  },
  finished: { label: "Finalizada", badgeClass: "bg-well text-fg-soft" },
  sold_out: { label: "Agotada", badgeClass: "bg-brand-deep text-white" },
};

export function isRaffleStatus(value: string): value is RaffleStatus {
  return (RAFFLE_STATUSES as readonly string[]).includes(value);
}

export function statusMeta(status: string) {
  return isRaffleStatus(status) ? STATUS_META[status] : STATUS_META.active;
}
