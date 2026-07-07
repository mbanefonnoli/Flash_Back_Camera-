"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LandingPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [error, setError] = useState("");

  function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError("Enter an event code.");
      return;
    }
    router.push(`/join/${code}`);
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Film strip decoration */}
      <div className="absolute top-0 left-0 right-0 h-12 flex items-center gap-4 px-4 opacity-10">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="w-6 h-8 border border-text-muted rounded-sm flex-shrink-0" />
        ))}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-12 flex items-center gap-4 px-4 opacity-10">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="w-6 h-8 border border-text-muted rounded-sm flex-shrink-0" />
        ))}
      </div>

      <div className="max-w-md w-full text-center space-y-8 z-10">
        {/* Logo / Title */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-accent font-mono text-sm tracking-widest uppercase">
            <span>&#9654;</span>
            <span>27 exposures</span>
          </div>
          <h1 className="text-6xl font-bold text-text-primary tracking-tight">
            Flash<span className="text-accent">back</span>
          </h1>
          <p className="text-text-muted text-lg leading-relaxed">
            A disposable camera for your event. Everyone shoots. Nobody sees until the host develops the film.
          </p>
        </div>

        {/* CTAs */}
        <div className="space-y-3">
          <Link
            href="/create"
            className="block w-full py-4 px-6 bg-accent text-background font-semibold text-lg rounded-viewfinder hover:bg-amber-400 transition-colors"
          >
            Create Event
          </Link>

          {!showJoinInput ? (
            <button
              onClick={() => setShowJoinInput(true)}
              className="block w-full py-4 px-6 bg-surface border border-surface text-text-primary font-semibold text-lg rounded-viewfinder hover:border-accent hover:text-accent transition-colors"
            >
              Join Event
            </button>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase());
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="Event code (e.g. AB12CD)"
                maxLength={6}
                className="w-full py-4 px-6 bg-surface border border-text-muted text-text-primary rounded-viewfinder text-center text-xl font-mono tracking-widest placeholder:text-text-muted focus:outline-none focus:border-accent"
                autoFocus
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                onClick={handleJoin}
                className="w-full py-4 px-6 bg-surface border border-accent text-accent font-semibold text-lg rounded-viewfinder hover:bg-accent hover:text-background transition-colors"
              >
                Join &rarr;
              </button>
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="pt-4 border-t border-surface space-y-4">
          <p className="text-text-muted text-xs uppercase tracking-widest">How it works</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { step: "01", label: "Scan QR code" },
              { step: "02", label: "Take 27 photos" },
              { step: "03", label: "Develop together" },
            ].map(({ step, label }) => (
              <div key={step} className="space-y-1">
                <div className="text-accent font-mono text-lg font-bold">{step}</div>
                <div className="text-text-muted text-xs">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <Link href="/reviews" className="block text-accent text-sm hover:underline">
          See what hosts are saying →
        </Link>
      </div>
    </main>
  );
}
