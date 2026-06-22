"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PhotoWithUrl } from "@/lib/supabase";
import PhotoGrid from "@/components/PhotoGrid";
import Link from "next/link";

type EventData = { name: string; developed: boolean };

export default function HostGalleryPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const code = params.code.toUpperCase();

  const [event, setEvent] = useState<EventData | null>(null);
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const evRes = await fetch(`/api/events/${code}`);
      const evJson = await evRes.json();
      if (!evJson.success) { router.replace("/"); return; }
      if (!evJson.data.developed) { router.replace(`/host/${code}`); return; }
      setEvent(evJson.data);

      const photosRes = await fetch(`/api/events/${code}/photos`);
      const photosJson = await photosRes.json();
      if (photosJson.success) setPhotos(photosJson.data.photos);
      setLoading(false);
    }

    load();
  }, [code, router]);

  if (loading || !event) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-12">
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-surface px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-text-primary font-bold text-lg">{event.name}</h1>
          <p className="text-text-muted text-xs font-mono">{photos.length} photos · developed</p>
        </div>
        <Link href={`/host/${code}`} className="text-text-muted text-sm hover:text-accent transition-colors">
          Dashboard
        </Link>
      </div>

      <div className="px-4 pt-6 pb-4 text-center space-y-1">
        <div className="text-accent text-3xl">🎞️</div>
        <h2 className="text-text-primary font-bold text-xl">Film Developed</h2>
        <p className="text-text-muted text-sm">
          {new Set(photos.map((p) => p.guest_name)).size} guests ·{" "}
          {photos.length} memories
        </p>
      </div>

      <PhotoGrid photos={photos} zipName={`flashback-${code}`} />
    </main>
  );
}
