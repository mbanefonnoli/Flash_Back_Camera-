"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import type { PhotoWithUrl } from "@/lib/supabase";

type Props = {
  photos: PhotoWithUrl[];
  zipName?: string;
  onDelete?: (id: string) => Promise<void>;
};

export default function PhotoGrid({ photos, zipName = "flashback-photos", onDelete }: Props) {
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const activePhoto = viewerIndex === null ? null : photos[viewerIndex] ?? null;

  const showPrev = useCallback(() => {
    setViewerIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
  }, [photos.length]);

  const showNext = useCallback(() => {
    setViewerIndex((i) => (i === null ? null : (i + 1) % photos.length));
  }, [photos.length]);

  useEffect(() => {
    if (viewerIndex === null) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setViewerIndex(null);
      else if (e.key === "ArrowLeft") showPrev();
      else if (e.key === "ArrowRight") showNext();
    }

    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [viewerIndex, showPrev, showNext]);

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx > 0) showPrev();
    else showNext();
  }

  async function handleDownload(url: string, filename: string) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  }

  async function handleDownloadAll() {
    setZipping(true);
    setZipProgress(0);
    try {
      const zip = new JSZip();
      let done = 0;
      await Promise.all(
        photos.map(async (photo) => {
          const res = await fetch(photo.url);
          const blob = await res.blob();
          zip.file(`flashback_${photo.guest_name}_${photo.id.slice(0, 8)}.jpg`, blob);
          done += 1;
          setZipProgress(done);
        })
      );
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const blobUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${zipName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } finally {
      setZipping(false);
    }
  }

  async function handleDelete(id: string) {
    if (!onDelete) return;
    setDeleting(id);
    try {
      await onDelete(id);
      setViewerIndex(null); // indexes shift once the photo is gone
    } finally {
      setDeleting(null);
    }
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-muted">
        <span className="text-4xl mb-4">📷</span>
        <p>No photos yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-center px-2 pb-3">
        <button
          onClick={handleDownloadAll}
          disabled={zipping}
          className="py-2 px-5 text-xs font-mono uppercase tracking-widest bg-accent/10 border border-accent/20 text-accent rounded-lg hover:bg-accent hover:text-background transition-colors disabled:opacity-50"
        >
          {zipping ? `Zipping ${zipProgress}/${photos.length}…` : `Download All (${photos.length})`}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2">
        {photos.map((photo, i) => {
          const filename = `flashback_${photo.guest_name}_${photo.id.slice(0, 8)}.jpg`;
          const isDeleting = deleting === photo.id;

          return (
            <div
              key={photo.id}
              className={`relative aspect-square overflow-hidden rounded-lg bg-surface opacity-0 animate-fade-in-up group ${isDeleting ? "opacity-40 pointer-events-none" : ""}`}
              style={{ animationDelay: `${i * 100}ms`, animationFillMode: "forwards" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`Photo by ${photo.guest_name}`}
                className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
              />

              {/* Sits above the image but below the controls below it */}
              <button
                onClick={() => setViewerIndex(i)}
                className="absolute inset-0 cursor-zoom-in"
                aria-label={`View photo by ${photo.guest_name} full screen`}
              />

              {/* Name + download bar */}
              <div className="absolute bottom-0 left-0 right-0 z-10 px-2.5 py-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                    <span className="text-background text-[9px] font-bold uppercase">
                      {photo.guest_name.charAt(0)}
                    </span>
                  </div>
                  <p className="text-white text-xs font-semibold truncate">{photo.guest_name}</p>
                </div>
                {!onDelete && (
                  <button
                    onClick={() => handleDownload(photo.url, filename)}
                    className="p-1 bg-white/10 hover:bg-white/30 rounded transition-colors flex-shrink-0"
                    title="Download"
                    aria-label="Download photo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Delete button — only in admin mode */}
              {onDelete && (
                <button
                  onClick={() => handleDelete(photo.id)}
                  disabled={isDeleting}
                  className="absolute top-2 right-2 z-10 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-60"
                  title={`Delete ${photo.guest_name}'s photo`}
                  aria-label="Delete photo"
                >
                  {isDeleting ? (
                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {activePhoto && viewerIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col"
          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                <span className="text-background text-[11px] font-bold uppercase">
                  {activePhoto.guest_name.charAt(0)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold truncate">
                  {activePhoto.guest_name}
                </p>
                <p className="text-white/50 text-[11px] font-mono">
                  {viewerIndex + 1} / {photos.length}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() =>
                  handleDownload(
                    activePhoto.url,
                    `flashback_${activePhoto.guest_name}_${activePhoto.id.slice(0, 8)}.jpg`
                  )
                }
                className="p-2 bg-white/10 hover:bg-white/25 rounded-lg transition-colors"
                aria-label="Download photo"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </button>
              <button
                onClick={() => setViewerIndex(null)}
                className="p-2 bg-white/10 hover:bg-white/25 rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Image — tapping the empty space closes the viewer */}
          <div
            className="flex-1 min-h-0 flex items-center justify-center px-2 pb-2"
            onClick={(e) => { if (e.target === e.currentTarget) setViewerIndex(null); }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activePhoto.url}
              alt={`Photo by ${activePhoto.guest_name}`}
              className="max-w-full max-h-full object-contain rounded-lg select-none"
            />
          </div>

          {photos.length > 1 && (
            <>
              <button
                onClick={showPrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 bg-black/50 hover:bg-black/80 border border-white/15 rounded-full flex items-center justify-center transition-colors"
                aria-label="Previous photo"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
              </button>
              <button
                onClick={showNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 bg-black/50 hover:bg-black/80 border border-white/15 rounded-full flex items-center justify-center transition-colors"
                aria-label="Next photo"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
