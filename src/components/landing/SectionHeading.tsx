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
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">
        {kicker}
      </p>
      <h2 className="mt-3 font-display text-3xl font-extrabold uppercase leading-tight text-fg sm:text-4xl">
        {title}
      </h2>
      {intro ? (
        <p className="mt-4 text-base leading-relaxed text-fg-soft sm:text-lg">
          {intro}
        </p>
      ) : null}
    </div>
  );
}
