"use client";

type Props = {
  remaining: number;
  total?: number;
};

export default function FilmCounter({ remaining, total = 27 }: Props) {
  const color =
    remaining === 0
      ? "text-red-500"
      : remaining <= 5
      ? "text-orange-400"
      : "text-accent";

  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`font-mono text-5xl font-bold tabular-nums leading-none ${color}`}>
        {String(remaining).padStart(2, "0")}
      </span>
      <span className="text-text-muted text-xs font-mono uppercase tracking-widest">
        {remaining === 0 ? "Film full" : "shots left"}
      </span>
      {/* Progress dots */}
      <div className="flex gap-0.5 mt-1 flex-wrap justify-center max-w-[140px]">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${
              i < total - remaining ? "bg-text-muted opacity-30" : "bg-accent"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
