import Link from "next/link";

type Plan = {
  name: string;
  guests: string;
  price: string;
  feat: string;
  cta: string;
  popular: boolean;
};

const plans: Plan[] = [
  {
    name: "Free Roll",
    guests: "10 guests",
    price: "$0",
    feat: "27 shots each · 14-day storage · watermarked gallery. The full develop-from-black reveal, free.",
    cta: "Start free",
    popular: false,
  },
  {
    name: "Party",
    guests: "40 guests",
    price: "$29",
    feat: "Custom shots per guest · 3-month storage · full-res download · no watermark.",
    cta: "Choose Party",
    popular: false,
  },
  {
    name: "Wedding",
    guests: "150 guests",
    price: "$59",
    feat: "Custom QR signs & event branding · 12-month storage · download-all · photobook add-on.",
    cta: "Choose Wedding",
    popular: true,
  },
  {
    name: "Grand",
    guests: "Unlimited",
    price: "$99",
    feat: "Multi-day events & multiple rolls · 12-month storage + archive export · priority support.",
    cta: "Choose Grand",
    popular: false,
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background pt-[30px] px-[22px] pb-[40px]">
      <div className="max-w-sm mx-auto space-y-8">
        <Link href="/create" className="text-text-muted text-sm hover:text-accent transition-colors">
          ← Back
        </Link>

        {/* Header */}
        <div className="space-y-3">
          <div className="font-mono text-[11px] tracking-[3px] uppercase text-accent">
            Pick your roll
          </div>
          <h1 className="font-sans text-[28px] font-bold tracking-[-0.6px] leading-[1.08] text-text-primary">
            One payment.
            <br />
            One night. No app for guests.
          </h1>
          <p className="text-sm text-[#8a8a8a]">
            Priced by guest count — never per scan, never a subscription. The reveal is free on every plan.
          </p>
        </div>

        {/* Plan cards */}
        <div className="flex flex-col gap-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-surface rounded-2xl p-[18px] border ${
                plan.popular ? "border-accent" : "border-[#262626]"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-[9px] left-[18px] bg-accent text-background font-mono text-[9px] tracking-[1.5px] font-bold px-[9px] py-[3px] rounded-[6px]">
                  MOST POPULAR
                </span>
              )}

              <div className="flex items-baseline justify-between">
                <div>
                  <span className="font-sans text-lg font-bold text-text-primary">{plan.name}</span>{" "}
                  <span className="font-mono text-[11px] text-[#6b6b6b]">{plan.guests}</span>
                </div>
                <span
                  className={`font-mono text-[22px] font-bold ${
                    plan.popular ? "text-accent" : "text-text-primary"
                  }`}
                >
                  {plan.price}
                </span>
              </div>

              <p className="text-[12.5px] leading-[1.5] text-[#8a8a8a] mt-1.5">{plan.feat}</p>

              <Link
                href="/create"
                className={`block w-full text-center mt-[14px] py-[14px] rounded-[14px] font-sans font-bold transition-colors ${
                  plan.popular
                    ? "bg-accent text-background hover:bg-amber-400"
                    : "bg-transparent border border-[#2a2a2a] text-text-primary hover:border-accent hover:text-accent"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="font-mono text-[10px] text-[#5a5a5a] text-center leading-[1.5]">
          One-time payment · full-res download · cancel anytime
          <br />
          before you develop. No hidden per-photo fees.
        </p>
      </div>
    </main>
  );
}
