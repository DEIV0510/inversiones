import Reveal from "./Reveal";
import { waGeneral } from "@/lib/whatsapp";
import { IconWhatsApp } from "@/components/icons";

type Props = {
  whatsappNumber: string;
};

export default function FinalCta({ whatsappNumber }: Props) {
  return (
    <section id="contacto" className="relative overflow-hidden py-16 lg:py-24">
      <div className="dot-grid absolute inset-0" aria-hidden="true" />
      <div
        className="absolute left-1/2 top-1/2 h-[360px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/25 blur-[130px]"
        aria-hidden="true"
      />
      <Reveal className="relative">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
          <div className="neon-card flex flex-col items-center rounded-3xl bg-card px-6 py-12 text-center sm:px-12 sm:py-16">
            <h2 className="font-display text-3xl font-black uppercase leading-tight text-fg sm:text-5xl">
              ¿Listo para <span className="text-brand">participar</span>?
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-fg-soft sm:text-lg">
              Conoce nuestros sorteos y comunícate directamente con
              Inversiones D y S. Te atendemos personalmente.
            </p>
            <a
              href={waGeneral(whatsappNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="glow-red mt-8 inline-flex min-h-14 items-center justify-center gap-2.5 rounded-xl bg-brand px-9 text-base font-bold uppercase tracking-wide text-white transition-all hover:bg-brand-dark active:scale-[0.98]"
            >
              <IconWhatsApp width={20} height={20} />
              Quiero participar
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
