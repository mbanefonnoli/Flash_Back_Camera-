"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import Link from "next/link";

type EventData = { name: string; developed: boolean; maxShots: number; maxGuests: number };
type Stats = { photoCount: number; guestCount: number; developed: boolean };

export default function HostDashboard({ params }: { params: { code: string } }) {
  const router = useRouter();
  const code = params.code.toUpperCase();

  const [event, setEvent] = useState<EventData | null>(null);
  const [stats, setStats] = useState<Stats>({ photoCount: 0, guestCount: 0, developed: false });
  const [notFound, setNotFound] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState("");
  const [developing, setDeveloping] = useState(false);
  const [pwError, setPwError] = useState("");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => { setOrigin(window.location.origin); }, []);

  function copyToClipboard() {
    const joinUrl = origin ? `${origin}/join/${code}` : `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    fetch(`/api/events/${code}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) { setNotFound(true); return; }
        if (json.data.developed) { router.replace(`/host/${code}/gallery`); return; }
        setEvent(json.data);
      })
      .catch(() => setNotFound(true));
  }, [code, router]);

  const loadStats = useCallback(async () => {
    const res = await fetch(`/api/events/${code}/stats`);
    const json = await res.json();
    if (json.success) setStats(json.data);
  }, [code]);

  useEffect(() => {
    if (!event) return;
    loadStats();
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, [event, loadStats]);

  async function handleDevelop(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    setDeveloping(true);

    try {
      const res = await fetch(`/api/events/${code}/develop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!json.success) { setPwError(json.error ?? "Failed."); return; }
      router.push(`/host/${code}/gallery`);
    } catch {
      setPwError("Network error.");
    } finally {
      setDeveloping(false);
    }
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Event not found</h1>
        <Link href="/" className="text-accent hover:underline">← Home</Link>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  const joinUrl = origin ? `${origin}/join/${code}` : `/join/${code}`;
  const placeholderCount = Math.min(stats.photoCount, 9);
  const guestLabel = event.maxGuests > 0
    ? `${stats.guestCount} / ${event.maxGuests}`
    : `${stats.guestCount}`;

  return (
    <main className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-surface px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-text-primary font-bold text-lg">{event.name}</h1>
          <p className="text-text-muted text-xs font-mono">{code} · Host view</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="py-2 px-4 bg-accent text-background text-sm font-semibold rounded-lg hover:bg-amber-400 transition-colors"
        >
          Develop Film
        </button>
      </div>

      {/* QR + stats */}
      <div className="px-4 pt-6 pb-4 flex flex-col items-center gap-4">
        {origin && <QRCodeDisplay url={joinUrl} code={code} eventName={event.name} size={180} />}
        <p className="text-text-muted text-xs text-center">Share this QR code with your guests</p>
        
        <div className="flex items-center gap-2 bg-surface px-4 py-2 rounded-lg border border-text-muted/20 max-w-sm w-full">
          <input
            type="text"
            readOnly
            value={joinUrl}
            className="bg-transparent text-accent text-xs font-mono select-all focus:outline-none flex-1 truncate"
          />
          <button
            onClick={copyToClipboard}
            className="px-2.5 py-1 text-[11px] bg-accent/10 border border-accent/20 text-accent font-mono rounded hover:bg-accent hover:text-background transition-colors"
          >
            {copied ? "COPIED" : "COPY"}
          </button>
        </div>

        {/* Live stats */}
        <div className="flex gap-6 text-center">
          <div>
            <p className="text-accent font-mono text-2xl font-bold">{stats.photoCount}</p>
            <p className="text-text-muted text-xs">photos</p>
          </div>
          <div>
            <p className="text-accent font-mono text-2xl font-bold">{guestLabel}</p>
            <p className="text-text-muted text-xs">{event.maxGuests > 0 ? "guests (max)" : "guests"}</p>
          </div>
          <div>
            <p className="text-accent font-mono text-2xl font-bold">{event.maxShots}</p>
            <p className="text-text-muted text-xs">shots/guest</p>
          </div>
        </div>
      </div>

      {/* Photo placeholder grid */}
      {stats.photoCount === 0 ? (
        <p className="text-text-muted text-center text-sm py-10">Waiting for guests to take photos…</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2">
          {Array.from({ length: placeholderCount }).map((_, i) => (
            <div key={i} className="relative aspect-square rounded-lg bg-surface overflow-hidden">
              <div className="w-full h-full bg-gradient-to-br from-surface via-amber-900/10 to-surface animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-accent opacity-30 text-3xl">🎞️</span>
              </div>
            </div>
          ))}
          {stats.photoCount > 9 && (
            <div className="aspect-square rounded-lg bg-surface flex items-center justify-center">
              <span className="text-text-muted text-sm font-mono">+{stats.photoCount - 9} more</span>
            </div>
          )}
        </div>
      )}

      {/* Develop modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-6">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-text-primary font-bold text-xl">Develop Film?</h2>
            <p className="text-text-muted text-sm">
              This will reveal all {stats.photoCount} photos to everyone. This cannot be undone.
            </p>
            <form onSubmit={handleDevelop} className="space-y-3">
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPwError(""); }}
                placeholder="Host password"
                className="w-full py-3 px-4 bg-background border border-text-muted text-text-primary rounded-lg placeholder:text-text-muted focus:outline-none focus:border-accent"
                autoFocus
              />
              {pwError && <p className="text-red-400 text-sm">{pwError}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setPassword(""); setPwError(""); }}
                  className="flex-1 py-3 border border-text-muted text-text-muted rounded-lg hover:border-text-primary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={developing}
                  className="flex-1 py-3 bg-accent text-background font-semibold rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50"
                >
                  {developing ? "Developing…" : "Develop"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
