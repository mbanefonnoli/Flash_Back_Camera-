"use client";

type Props = {
  remaining: number;
};

export default function FilmCounter({ remaining }: Props) {
  const color =
    remaining === 0
      ? "text-red-500"
      : remaining <= 5
      ? "text-orange-400"
      : "text-accent";

  return (
    <div className="flex flex-col items-start leading-none">
      <span className={`font-mono text-4xl font-bold tabular-nums ${color}`}>
        {String(remaining).padStart(2, "0")}
      </span>
      <span className="text-text-muted text-[10px] font-mono uppercase tracking-widest mt-1">
        {remaining === 0 ? "Film full" : "left"}
      </span>
    </div>
  );
}
