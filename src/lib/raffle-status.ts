// Metadatos de estado de rifa (v2), seguros para componentes cliente.

export const RAFFLE_STATUSES_V2 = [
  "DRAFT",
  "COMING_SOON",
  "ACTIVE",
  "SOLD_OUT",
  "FINISHED",
  "CANCELLED",
] as const;

export type RaffleStatusV2 = (typeof RAFFLE_STATUSES_V2)[number];

export const STATUS_META_V2: Record<
  RaffleStatusV2,
  { label: string; badgeClass: string }
> = {
  DRAFT: { label: "Borrador", badgeClass: "bg-well text-fg-faint" },
  COMING_SOON: {
    label: "Próximamente",
    badgeClass: "border border-line-strong bg-well text-fg",
  },
  ACTIVE: { label: "Activa", badgeClass: "bg-brand text-white glow-brand-sm" },
  SOLD_OUT: { label: "Agotada", badgeClass: "bg-brand-deep text-white" },
  FINISHED: { label: "Finalizada", badgeClass: "bg-well text-fg-soft" },
  CANCELLED: { label: "Cancelada", badgeClass: "bg-well text-fg-faint" },
};

export function statusMetaV2(status: string) {
  return (
    STATUS_META_V2[status as RaffleStatusV2] ?? STATUS_META_V2.DRAFT
  );
}
