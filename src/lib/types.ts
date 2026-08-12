// Vista pública de una rifa: NUNCA incluye totalNumbers ni datos internos.
export type RaffleView = {
  id: string;
  title: string;
  description: string;
  prize: string;
  imageUrl: string | null;
  priceCop: number | null;
  drawDateText: string | null;
  progressPct: number;
  status: string;
};

export type WinnerView = {
  id: string;
  name: string;
  prize: string;
  raffleTitle: string | null;
  photoUrl: string | null;
  drawnAtText: string | null;
  isDemo: boolean;
};
