"use client";

import { useState } from "react";
import JSZip from "jszip";
import type { PhotoWithUrl } from "@/lib/supabase";

type Props = {
  photos: PhotoWithUrl[];
  zipName?: string;
};

export default function PhotoGrid({ photos, zipName = "flashback-photos" }: Props) {
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

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
          return (
            <div
              key={photo.id}
              className="relative aspect-square overflow-hidden rounded-lg bg-surface opacity-0 animate-fade-in-up group"
              style={{ animationDelay: `${i * 100}ms`, animationFillMode: "forwards" }}
            >
              {/* Download Button overlay */}
              <button
                onClick={() => handleDownload(photo.url, filename)}
                className="absolute top-2 right-2 z-10 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                title="Download photo"
                aria-label="Download photo"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
              </button>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`Photo by ${photo.guest_name}`}
                className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
              />
              <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent">
                <p className="text-white text-xs font-medium truncate">{photo.guest_name}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
