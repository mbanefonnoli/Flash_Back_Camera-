"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type EventData = { name: string; developed: boolean; maxShots: number; maxGuests: number };

export default function JoinPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const code = params.code.toUpperCase();

  const [event, setEvent] = useState<EventData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestCount, setGuestCount] = useState(0);
  const [isFull, setIsFull] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Check if guest already joined this event
    const existingName = localStorage.getItem(`flashback_guest_${code}`);
    if (existingName) {
      router.replace(`/camera/${code}`);
      return;
    }

    async function load() {
      try {
        const [evRes, statsRes] = await Promise.all([
          fetch(`/api/events/${code}`),
          fetch(`/api/events/${code}/stats`),
        ]);

        const evJson = await evRes.json();
        const statsJson = await statsRes.json();

        if (!evJson.success) { setNotFound(true); return; }
        if (evJson.data.developed) { router.replace(`/gallery/${code}`); return; }

        setEvent(evJson.data);

        if (statsJson.success) {
          const currentGuests = statsJson.data.guestCount ?? 0;
          setGuestCount(currentGuests);
          if (evJson.data.maxGuests > 0 && currentGuests >= evJson.data.maxGuests) {
            setIsFull(true);
          }
        }
      } catch {
        setNotFound(true);
      }
    }

    load();
  }, [code, router]);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (isFull) {
      setError("This event is full. You cannot join.");
      return;
    }
    const name = guestName.trim();
    if (!name) { setError("Enter your name."); return; }
    localStorage.setItem(`flashback_guest_${code}`, name);
    localStorage.setItem("flashback_event_code", code);
    router.push(`/camera/${code}`);
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <span className="text-5xl mb-4">🎞️</span>
        <h1 className="text-2xl font-bold text-text-primary mb-2">Event not found</h1>
        <p className="text-text-muted mb-6">Check the code and try again.</p>
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

  const maxShots = event.maxShots ?? 27;

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="max-w-sm w-full space-y-8 text-center">
        <div className="space-y-2">
          <div className="text-accent font-mono text-xs uppercase tracking-widest">{code}</div>
          <h1 className="text-3xl font-bold text-text-primary">{event.name}</h1>
          <p className="text-text-muted">
            {isFull 
              ? "This event has reached its guest limit." 
              : "Enter your name to get your disposable camera."}
          </p>
          {!isFull && guestCount > 0 && (
            <p className="text-xs text-text-muted/80 mt-1">
              Join {guestCount} other guest{guestCount === 1 ? "" : "s"} already shooting!
            </p>
          )}
        </div>

        {isFull ? (
          <div className="space-y-4">
            <div className="bg-red-950/20 border border-red-500/30 text-red-400 p-4 rounded-viewfinder text-sm">
              Event guest limit of {event.maxGuests} reached.
            </div>
            <Link 
              href="/" 
              className="block w-full py-4 bg-surface border border-surface text-text-primary font-semibold text-lg rounded-viewfinder hover:border-accent hover:text-accent transition-colors"
            >
              Back to Home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4">
            <input
              type="text"
              value={guestName}
              onChange={(e) => { setGuestName(e.target.value); setError(""); }}
              placeholder="Your first name"
              className="w-full py-4 px-6 bg-surface border border-text-muted text-text-primary rounded-viewfinder text-center text-lg placeholder:text-text-muted focus:outline-none focus:border-accent"
              maxLength={30}
              autoFocus
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full py-4 bg-accent text-background font-semibold text-lg rounded-viewfinder hover:bg-amber-400 transition-colors"
            >
              Get My Camera →
            </button>
          </form>
        )}

        <p className="text-text-muted text-xs">
          You get {maxShots} shots. Photos stay hidden until the host develops the film.
        </p>
      </div>
    </main>
  );
}

