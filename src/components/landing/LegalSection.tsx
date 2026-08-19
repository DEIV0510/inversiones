import Link from "next/link";
import Reveal from "./Reveal";
import { IconArrowRight } from "@/components/icons";

export default function LegalSection() {
  return (
    <section id="condiciones" className="bg-bg2 py-8 lg:py-12">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <Reveal>
          <div className="flex flex-col items-center gap-3.5 rounded-2xl border border-line bg-card p-5 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <h2 className="font-display text-base font-extrabold uppercase text-fg">
                Participa informado
              </h2>
              {/* Las condiciones ya no se "comparten por WhatsApp": cada rifa
                  publica las suyas en su propia página (bloque "Condiciones de
                  este sorteo") y las generales viven en estos dos enlaces. */}
              <p className="mt-1 text-xs leading-relaxed text-fg-soft sm:text-sm">
                Cada sorteo publica sus condiciones en su propia página, antes
                de que compres.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-center gap-2">
              <Link
                href="/terminos"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line-strong px-4 text-xs font-bold uppercase tracking-wide text-fg transition-colors hover:border-brand hover:text-brand"
              >
                Términos
                <IconArrowRight width={14} height={14} />
              </Link>
              <Link
                href="/privacidad"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line-strong px-4 text-xs font-bold uppercase tracking-wide text-fg transition-colors hover:border-brand hover:text-brand"
              >
                Privacidad
                <IconArrowRight width={14} height={14} />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
