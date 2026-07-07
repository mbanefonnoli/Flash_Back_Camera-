"use client";

import { useEffect, useState, useCallback } from "react";
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

  // Admin mode
  const [adminMode, setAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [verifying, setVerifying] = useState(false);

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

  async function handleUnlockAdmin(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    setVerifying(true);

    try {
      // Verify password by attempting a dry-run against the develop endpoint
      // (already developed, so it returns { success: true, data: { already: true } })
      const res = await fetch(`/api/events/${code}/develop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwInput }),
      });
      const json = await res.json();

      if (!json.success) {
        setPwError(json.error ?? "Incorrect password.");
        return;
      }

      setAdminPassword(pwInput);
      setAdminMode(true);
      setShowPwModal(false);
      setPwInput("");
    } catch {
      setPwError("Network error.");
    } finally {
      setVerifying(false);
    }
  }

  const handleDelete = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/events/${code}/photos/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Delete failed.");
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    },
    [code, adminPassword]
  );

  if (loading || !event) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-12">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-surface px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-text-primary font-bold text-lg">{event.name}</h1>
          <p className="text-text-muted text-xs font-mono">{photos.length} photos · developed</p>
        </div>
        <div className="flex items-center gap-2">
          {adminMode ? (
            <button
              onClick={() => { setAdminMode(false); setAdminPassword(""); }}
              className="py-1.5 px-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold rounded-lg hover:bg-red-500/20 transition-colors"
            >
              Exit Admin
            </button>
          ) : (
            <button
              onClick={() => setShowPwModal(true)}
              className="py-1.5 px-3 bg-surface border border-text-muted text-text-muted text-xs font-semibold rounded-lg hover:border-accent hover:text-accent transition-colors"
            >
              Admin Mode
            </button>
          )}
          <Link href={`/host/${code}`} className="text-text-muted text-sm hover:text-accent transition-colors">
            Dashboard
          </Link>
        </div>
      </div>

      {/* Admin mode banner */}
      {adminMode && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <p className="text-red-400 text-xs font-semibold">
            Admin mode active — hover any photo and click ✕ to delete it permanently.
          </p>
        </div>
      )}

      <div className="px-4 pt-6 pb-4 text-center space-y-1">
        <div className="text-accent text-3xl">🎞️</div>
        <h2 className="text-text-primary font-bold text-xl">Film Developed</h2>
        <p className="text-text-muted text-sm">
          {new Set(photos.map((p) => p.guest_name)).size} guests ·{" "}
          {photos.length} memories
        </p>
      </div>

      <PhotoGrid
        photos={photos}
        zipName={`flashback-${code}`}
        onDelete={adminMode ? handleDelete : undefined}
      />

      {/* Password modal */}
      {showPwModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-6">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-text-primary font-bold text-xl">Enter Host Password</h2>
            <p className="text-text-muted text-sm">
              Unlock admin mode to delete individual photos.
            </p>
            <form onSubmit={handleUnlockAdmin} className="space-y-3">
              <input
                type="password"
                value={pwInput}
                onChange={(e) => { setPwInput(e.target.value); setPwError(""); }}
                placeholder="Host password"
                className="w-full py-3 px-4 bg-background border border-text-muted text-text-primary rounded-lg placeholder:text-text-muted focus:outline-none focus:border-accent"
                autoFocus
              />
              {pwError && <p className="text-red-400 text-sm">{pwError}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowPwModal(false); setPwInput(""); setPwError(""); }}
                  className="flex-1 py-3 border border-text-muted text-text-muted rounded-lg hover:border-text-primary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying}
                  className="flex-1 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {verifying ? "Verifying…" : "Unlock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
