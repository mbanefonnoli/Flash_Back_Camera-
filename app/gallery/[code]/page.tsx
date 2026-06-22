"use client";

import { useEffect, useState } from "react";
import type { PhotoWithUrl } from "@/lib/supabase";
import PhotoGrid from "@/components/PhotoGrid";
import Link from "next/link";

type EventData = { name: string; developed: boolean };

export default function GuestGalleryPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();

  const [event, setEvent] = useState<EventData | null>(null);
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/events/${code}`);
      const json = await res.json();

      if (!json.success) { setNotFound(true); setLoading(false); return; }

      setEvent(json.data);

      if (json.data.developed) {
        const photosRes = await fetch(`/api/events/${code}/photos`);
        const photosJson = await photosRes.json();
        if (photosJson.success) setPhotos(photosJson.data.photos);
      }

      setLoading(false);
    }

    load();
  }, [code]);

  // Poll for development
  useEffect(() => {
    if (!event || event.developed) return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/events/${code}`);
      const json = await res.json();
      if (!json.success || !json.data.developed) return;

      setEvent((prev) => prev ? { ...prev, developed: true } : prev);

      const photosRes = await fetch(`/api/events/${code}/photos`);
      const photosJson = await photosRes.json();
      if (photosJson.success) setPhotos(photosJson.data.photos);

      clearInterval(interval);
    }, 5000);

    return () => clearInterval(interval);
  }, [event, code]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Event not found</h1>
        <Link href="/" className="text-accent hover:underline">← Home</Link>
      </main>
    );
  }

  if (!event?.developed) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center space-y-6">
        <div className="space-y-2">
          <div className="text-5xl animate-pulse">🎞️</div>
          <h1 className="text-2xl font-bold text-text-primary">Film not developed yet</h1>
          <p className="text-text-muted">
            The host hasn&apos;t developed the film. Check back soon — this page updates automatically.
          </p>
        </div>

        <div className="flex gap-2 items-center text-text-muted text-sm">
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          Waiting for host to develop film…
        </div>

        <Link href={`/camera/${code}`} className="text-accent text-sm hover:underline">
          Back to camera
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-12">
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-surface px-4 py-3 text-center">
        <h1 className="text-text-primary font-bold text-lg">{event.name}</h1>
        <p className="text-text-muted text-xs font-mono">{photos.length} photos revealed</p>
      </div>

      <div className="px-4 pt-6 pb-4 text-center space-y-1">
        <div className="text-accent text-3xl">✨</div>
        <h2 className="text-text-primary font-bold text-xl">The film is developed!</h2>
        <p className="text-text-muted text-sm">
          {new Set(photos.map((p) => p.guest_name)).size} guests captured{" "}
          {photos.length} moments
        </p>
      </div>

      <PhotoGrid photos={photos} zipName={`flashback-${code}`} />
    </main>
  );
}
