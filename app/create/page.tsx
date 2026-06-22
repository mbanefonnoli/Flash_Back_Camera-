"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SHOT_OPTIONS = [12, 24, 27, 36];

export default function CreatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [maxShots, setMaxShots] = useState(27);
  const [maxGuests, setMaxGuests] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !password.trim()) {
      setError("Event name and host password are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/events/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          host_password: password.trim(),
          max_shots: maxShots,
          max_guests: maxGuests,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      router.push(`/host/${data.data.code}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="max-w-sm w-full space-y-8">
        <div className="space-y-1">
          <Link href="/" className="text-text-muted text-sm hover:text-accent transition-colors">
            ← Back
          </Link>
          <h1 className="text-3xl font-bold text-text-primary mt-2">Create Event</h1>
          <p className="text-text-muted text-sm">
            Share the QR code with your guests after creating.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-text-muted text-xs uppercase tracking-widest">Event Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah's Birthday"
              className="w-full py-3 px-4 bg-surface border border-text-muted text-text-primary rounded-lg placeholder:text-text-muted focus:outline-none focus:border-accent"
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <label className="text-text-muted text-xs uppercase tracking-widest">Host Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="You'll need this to develop the film"
              className="w-full py-3 px-4 bg-surface border border-text-muted text-text-primary rounded-lg placeholder:text-text-muted focus:outline-none focus:border-accent"
              maxLength={100}
            />
            <p className="text-text-muted text-xs">Keep this safe — it unlocks the photos for everyone.</p>
          </div>

          {/* Shots per guest */}
          <div className="space-y-2">
            <label className="text-text-muted text-xs uppercase tracking-widest">
              Shots per guest
            </label>
            <div className="grid grid-cols-4 gap-2">
              {SHOT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMaxShots(n)}
                  className={`py-2.5 rounded-lg text-sm font-mono font-bold border transition-colors ${
                    maxShots === n
                      ? "bg-accent text-background border-accent"
                      : "bg-surface border-text-muted text-text-muted hover:border-accent hover:text-accent"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-text-muted text-xs">Each guest gets this many photos.</p>
          </div>

          {/* Max guests */}
          <div className="space-y-2">
            <label className="text-text-muted text-xs uppercase tracking-widest">
              Max guests{" "}
              <span className="normal-case text-text-muted">(0 = unlimited)</span>
            </label>
            <input
              type="number"
              value={maxGuests}
              onChange={(e) => setMaxGuests(Math.max(0, parseInt(e.target.value) || 0))}
              min={0}
              max={500}
              className="w-full py-3 px-4 bg-surface border border-text-muted text-text-primary rounded-lg focus:outline-none focus:border-accent"
            />
            <p className="text-text-muted text-xs">Set to 0 to allow any number of guests.</p>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-4 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-accent text-background font-semibold text-lg rounded-viewfinder hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating…" : "Create Event →"}
          </button>
        </form>
      </div>
    </main>
  );
}
