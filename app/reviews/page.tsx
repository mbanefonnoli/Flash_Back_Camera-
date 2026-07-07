"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Review = { id: string; name: string; rating: number; body: string; created_at: string };

function Stars({ value }: { value: number }) {
  return (
    <span className="text-accent text-sm tracking-wider">
      {"★".repeat(value)}
      <span className="text-text-muted">{"★".repeat(5 - value)}</span>
    </span>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/reviews");
    const json = await res.json();
    if (json.success) setReviews(json.data.reviews);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !text.trim()) {
      setError("Enter your name and a review.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), rating, body: text.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Something went wrong.");
        return;
      }
      setName("");
      setText("");
      setRating(5);
      await load();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="max-w-md mx-auto space-y-8">
        <div className="space-y-1">
          <Link href="/" className="text-text-muted text-sm hover:text-accent transition-colors">
            ← Home
          </Link>
          <h1 className="text-3xl font-bold text-text-primary mt-2">Reviews</h1>
          <p className="text-text-muted text-sm">What hosts are saying about Flashback.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-surface rounded-2xl p-5 border border-text-muted/10">
          <div className="space-y-2">
            <label className="text-text-muted text-xs uppercase tracking-widest">Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="e.g. Sarah"
              className="w-full py-3 px-4 bg-background border border-text-muted text-text-primary rounded-lg placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          <div className="space-y-2">
            <label className="text-text-muted text-xs uppercase tracking-widest">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`text-2xl leading-none transition-colors ${n <= rating ? "text-accent" : "text-text-muted"}`}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-text-muted text-xs uppercase tracking-widest">Your review</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Tell other hosts what your event was like…"
              className="w-full py-3 px-4 bg-background border border-text-muted text-text-primary rounded-lg placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-accent text-background font-semibold rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Posting…" : "Post Review"}
          </button>
        </form>

        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-text-muted text-center text-sm py-6">No reviews yet — be the first!</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="bg-surface rounded-xl p-4 border border-text-muted/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-text-primary font-semibold text-sm">{r.name}</span>
                  <Stars value={r.rating} />
                </div>
                <p className="text-text-muted text-sm leading-relaxed">{r.body}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
