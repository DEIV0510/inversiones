import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

/**
 * Los cuatro pasos describen la compra tal como ocurre HOY en el sitio: se
 * elige el sorteo, se eligen los números, se paga y se espera el sorteo.
 *
 * Antes decían "escríbenos por WhatsApp" porque la página era solo una
 * vitrina; ahora la venta se cierra aquí y ningún paso puede prometer un
 * canal concreto: hay rifas con el cobro por WhatsApp apagado y esta sección
 * vive en la portada, que es común a todas.
 */
const STEPS = [
  {
    number: "01",
    title: "Elige tu sorteo",
    text: "Conoce los sorteos disponibles y su avance.",
  },
  {
    number: "02",
    title: "Elige tus números",
    text: "Escoge cuántos quieres o busca tu número de la suerte.",
  },
  {
    number: "03",
    title: "Completa tu compra",
    text: "Deja tus datos, paga y recibe tu código de participación.",
  },
  {
    number: "04",
    title: "Espera el sorteo",
    text: "Atento a la fecha y al anuncio de resultados.",
  },
];

export default function HowItWorks() {
  return (
    <section id="como-participar" className="py-10 lg:py-16">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            kicker="Cómo participar"
            title="Participar es muy fácil"
          />
        </Reveal>
        <ol className="mx-auto mt-5 grid max-w-3xl gap-2.5 lg:max-w-none lg:grid-cols-4 lg:gap-4">
          {STEPS.map((step, i) => (
            <Reveal key={step.number} delay={(Math.min(i, 3) as 0 | 1 | 2 | 3)}>
              <li className="flex h-full items-center gap-3.5 rounded-2xl border border-line bg-card p-3.5 lg:flex-col lg:items-start lg:p-5">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-well font-display text-base font-black tabular-nums text-brand"
                  aria-hidden="true"
                >
                  {step.number}
                </span>
                <div>
                  <h3 className="font-display text-sm font-extrabold uppercase text-fg">
                    {step.title}
                  </h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-fg-soft">
                    {step.text}
                  </p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
