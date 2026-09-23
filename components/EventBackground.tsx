type Props = {
  url?: string | null;
  /** Higher values dim the photo further, keeping text over it readable. */
  intensity?: "soft" | "strong";
};

export default function EventBackground({ url, intensity = "soft" }: Props) {
  if (!url) return null;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className={`w-full h-full object-cover ${intensity === "strong" ? "opacity-20" : "opacity-35"}`}
      />
      <div
        className={`absolute inset-0 ${
          intensity === "strong"
            ? "bg-background/80"
            : "bg-gradient-to-b from-background/70 via-background/75 to-background/90"
        }`}
      />
    </div>
  );
}
