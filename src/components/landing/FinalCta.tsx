import Reveal from "./Reveal";
import { waGeneral } from "@/lib/whatsapp";
import { IconWhatsApp } from "@/components/icons";

type Props = {
  whatsappNumber: string;
};

export default function FinalCta({ whatsappNumber }: Props) {
  return (
    <section id="contacto" className="relative overflow-hidden py-10 lg:py-16">
      <div className="dot-grid absolute inset-0" aria-hidden="true" />
      <div
        className="absolute left-1/2 top-1/2 h-[300px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/25 blur-[130px]"
        aria-hidden="true"
      />
      <Reveal className="relative">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
          <div className="neon-card flex flex-col items-center rounded-3xl bg-card px-6 py-8 text-center sm:py-10">
            <h2 className="font-display text-2xl font-black uppercase leading-tight text-fg sm:text-4xl">
              ¿Listo para <span className="text-brand">participar</span>?
            </h2>
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-fg-soft sm:text-base">
              Conoce nuestros sorteos y comunícate directamente con
              Inversiones D y S. Te atendemos personalmente.
            </p>
            <a
              href={waGeneral(whatsappNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="glow-brand mt-5 inline-flex min-h-13 items-center justify-center gap-2.5 rounded-xl bg-brand px-8 text-base font-bold uppercase tracking-wide text-white transition-all hover:bg-brand-dark active:scale-[0.98]"
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
