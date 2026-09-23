"use client";

import Link from "next/link";

export default function ReviewPrompt({ name }: { name?: string | null }) {
  function rememberName() {
    if (name) localStorage.setItem("flashback_review_name", name);
  }

  return (
    <div className="mx-4 mt-8 bg-surface rounded-2xl p-5 border border-text-muted/10 text-center space-y-2">
      <div className="text-accent text-2xl">★</div>
      <h3 className="text-text-primary font-bold">How was your Flashback?</h3>
      <p className="text-text-muted text-sm">
        Tell us what you loved — and what we could do better. It takes 20 seconds.
      </p>
      <Link
        href="/reviews"
        onClick={rememberName}
        className="inline-block mt-2 py-2.5 px-6 bg-accent text-background font-semibold text-sm rounded-lg hover:bg-amber-400 transition-colors"
      >
        Leave a review
      </Link>
    </div>
  );
}
