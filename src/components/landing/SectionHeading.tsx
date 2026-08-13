type Props = {
  kicker: string;
  title: string;
  intro?: string;
  align?: "left" | "center";
};

export default function SectionHeading({
  kicker,
  title,
  intro,
  align = "center",
}: Props) {
  const alignClass = align === "center" ? "mx-auto text-center" : "text-left";
  return (
    <div className={`max-w-2xl ${alignClass}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand">
        {kicker}
      </p>
      <h2 className="mt-1.5 font-display text-2xl font-extrabold uppercase leading-tight text-fg sm:text-3xl">
        {title}
      </h2>
      {intro ? (
        <p className="mt-2.5 text-sm leading-relaxed text-fg-soft sm:text-base">
          {intro}
        </p>
      ) : null}
    </div>
  );
}
