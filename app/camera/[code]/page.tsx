"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import FilmCounter from "@/components/FilmCounter";
import Link from "next/link";

const MAX_DIM = 800;
const JPEG_QUALITY = 0.8;

type EventData = { name: string; developed: boolean; maxShots: number; maxGuests: number };

export default function CameraPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const code = params.code.toUpperCase();

  const [event, setEvent] = useState<EventData | null>(null);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [shotsTaken, setShotsTaken] = useState(0);
  const [flashing, setFlashing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [filter, setFilter] = useState<"standard" | "vintage" | "bw">("standard");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const maxShots = event?.maxShots ?? 27;
  const remaining = maxShots - shotsTaken;

  // Load guest name, fetch event + prior shot count
  useEffect(() => {
    const name = localStorage.getItem(`flashback_guest_${code}`);
    if (!name) { router.replace(`/join/${code}`); return; }
    setGuestName(name);
    const encodedName = encodeURIComponent(name);

    async function init() {
      const [evRes, statsRes] = await Promise.all([
        fetch(`/api/events/${code}`),
        fetch(`/api/events/${code}/stats?guest=${encodedName}`),
      ]);

      const evJson = await evRes.json();
      if (!evJson.success) { router.replace("/"); return; }
      if (evJson.data.developed) { router.replace(`/gallery/${code}`); return; }
      setEvent(evJson.data);

      const statsJson = await statsRes.json();
      if (statsJson.success) setShotsTaken(statsJson.data.guestShots ?? 0);
    }

    init();
  }, [code, router]);

  // Start camera
  useEffect(() => {
    if (!event) return;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "");
          videoRef.current.setAttribute("muted", "");
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch {
        setUseFallback(true);
        setCameraReady(true);
      }
    }

    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [event]);

  const uploadBlob = useCallback(
    async (blob: Blob) => {
      if (!guestName) return;
      setUploading(true);
      setError("");

      try {
        const fd = new FormData();
        fd.append("image", blob, "photo.jpg");
        fd.append("eventCode", code);
        fd.append("guestName", guestName);

        const res = await fetch("/api/photos/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!json.success) throw new Error(json.error ?? "Upload failed.");

        setShotsTaken((n) => n + 1);
        setFlashing(true);
        setTimeout(() => setFlashing(false), 300);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
      }
    },
    [code, guestName]
  );

  const captureFromVideo = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ratio = Math.min(MAX_DIM / video.videoWidth, MAX_DIM / video.videoHeight, 1);
    canvas.width = video.videoWidth * ratio;
    canvas.height = video.videoHeight * ratio;
    const ctx = canvas.getContext("2d")!;
    
    // Apply camera effect filter to canvas context
    if (filter === "vintage") {
      ctx.filter = "sepia(0.4) contrast(1.1) brightness(0.95) saturate(1.2)";
    } else if (filter === "bw") {
      ctx.filter = "grayscale(1) contrast(1.3) brightness(0.95)";
    } else {
      ctx.filter = "none";
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => { if (blob) uploadBlob(blob); }, "image/jpeg", JPEG_QUALITY);
  }, [uploadBlob, filter]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      const ratio = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext("2d")!;

      // Apply camera effect filter to canvas context
      if (filter === "vintage") {
        ctx.filter = "sepia(0.4) contrast(1.1) brightness(0.95) saturate(1.2)";
      } else if (filter === "bw") {
        ctx.filter = "grayscale(1) contrast(1.3) brightness(0.95)";
      } else {
        ctx.filter = "none";
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => blob && uploadBlob(blob), "image/jpeg", JPEG_QUALITY);
    };
    img.src = URL.createObjectURL(file);
    e.target.value = "";
  }

  if (!event || !guestName) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (remaining === 0) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center space-y-6">
        <span className="text-6xl">🎞️</span>
        <h1 className="text-2xl font-bold text-text-primary">Film&apos;s full!</h1>
        <p className="text-text-muted">You used all {maxShots} shots. Wait for the host to develop the film.</p>
        <Link
          href={`/gallery/${code}`}
          className="py-3 px-8 border border-accent text-accent rounded-viewfinder hover:bg-accent hover:text-background transition-colors"
        >
          View Gallery
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-between py-6 px-4 select-none">
      {/* Header */}
      <div className="w-full max-w-sm flex items-center justify-between">
        <Link href={`/gallery/${code}`} className="text-text-muted text-sm hover:text-accent">
          Gallery
        </Link>
        <span className="text-text-muted text-xs font-mono uppercase">{event.name}</span>
        <span className="text-text-muted text-xs font-mono">{guestName}</span>
      </div>

      {/* Viewfinder */}
      <div className="relative w-full max-w-sm aspect-[3/4] rounded-viewfinder overflow-hidden bg-surface border-2 border-surface shadow-2xl">
        {!useFallback ? (
          <video
            ref={videoRef}
            className={`w-full h-full object-cover transition-all duration-300 ${
              filter === "vintage" ? "sepia-[0.4] contrast-[1.1] brightness-[0.95] saturate-[1.2]" :
              filter === "bw" ? "grayscale contrast-[1.3] brightness-[0.95]" :
              ""
            }`}
            playsInline
            muted
            autoPlay
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted">
            <span className="text-center text-sm px-4">Camera unavailable — use the button below to pick a photo</span>
          </div>
        )}

        {/* Retro glass/lens reflections and scanline overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.4)_100%)] pointer-events-none" />

        {/* Retro Viewport Overlays */}
        <div className="absolute inset-x-4 top-3 flex justify-between items-center text-[10px] font-mono text-accent/80 drop-shadow-md pointer-events-none select-none">
          <div className="flex items-center gap-1">
            <span className="border border-accent/80 px-1 rounded-sm text-[8px]">ISO 400</span>
            <span>24FPS</span>
          </div>
          <div>
            <span>[|||] 87%</span>
          </div>
          <div className="flex items-center gap-1">
            <span>⚡ AUTO</span>
          </div>
        </div>

        <div className="absolute inset-x-4 bottom-3 flex justify-between items-center text-[10px] font-mono text-accent/80 drop-shadow-md pointer-events-none select-none">
          <span>F/2.8</span>
          <span>1/125s</span>
          <span>EV -0.3</span>
        </div>

        {flashing && (
          <div className="absolute inset-0 bg-white animate-flash pointer-events-none" />
        )}

        {["top-3 left-3", "top-3 right-3", "bottom-3 left-3", "bottom-3 right-3"].map((pos, i) => (
          <div
            key={i}
            className={`absolute ${pos} w-5 h-5 border-accent opacity-60 pointer-events-none ${
              i === 0 ? "border-t-2 border-l-2" :
              i === 1 ? "border-t-2 border-r-2" :
              i === 2 ? "border-b-2 border-l-2" :
                        "border-b-2 border-r-2"
            }`}
          />
        ))}
      </div>

      {/* Filter Selector */}
      <div className="w-full max-w-sm flex justify-center gap-2 mt-4">
        {(["standard", "vintage", "bw"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-colors ${
              filter === f
                ? "bg-accent text-background border-accent font-semibold"
                : "bg-surface border-text-muted/30 text-text-muted hover:border-accent hover:text-accent"
            }`}
          >
            {f === "standard" ? "Standard" : f === "vintage" ? "Vintage" : "B&W Film"}
          </button>
        ))}
      </div>

      {/* Film counter + Shutter */}
      <div className="w-full max-w-sm flex items-center justify-between mt-4">
        <FilmCounter remaining={remaining} total={maxShots} />

        <button
          onClick={useFallback ? () => fileInputRef.current?.click() : captureFromVideo}
          disabled={uploading || !cameraReady || remaining === 0}
          className="w-20 h-20 rounded-full bg-accent border-4 border-background shadow-lg shadow-accent/30 flex items-center justify-center hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Take photo"
        >
          {uploading ? (
            <div className="w-6 h-6 border-2 border-background border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-background/20" />
          )}
        </button>

        <div className="text-right">
          <p className="text-text-muted text-xs font-mono">{shotsTaken} taken</p>
        </div>
      </div>

      {error && <p className="text-red-400 text-xs text-center max-w-sm mt-2">{error}</p>}

      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
    </main>
  );
}

