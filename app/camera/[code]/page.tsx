"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import FilmCounter from "@/components/FilmCounter";
import { enqueueShot, listQueuedShots, removeQueuedShot } from "@/lib/upload-queue";
import Link from "next/link";

// Phone sensors shoot well past this; cap only so uploads stay sane.
const MAX_DIM = 4096;

// Temporary tuning control: pick the JPEG quality that looks right, then hard-code it.
const QUALITY_OPTIONS = [
  { label: "Max", value: 1.0 },
  { label: "-10%", value: 0.9 },
  { label: "-30%", value: 0.7 },
  { label: "-50%", value: 0.5 },
  { label: "-70%", value: 0.3 },
] as const;

const QUALITY_KEY = "flashback_jpeg_quality";
const UPLOAD_TIMEOUT_MS = 90_000;
const RETRY_INTERVAL_MS = 8000;

type ShotInfo = { width: number; height: number; bytes: number; quality: number };

// Matches the viewfinder's aspect-[3/4] box so the saved shot is framed
// exactly like the preview, which uses object-cover.
const FRAME_ASPECT = 3 / 4;

function coverCrop(srcWidth: number, srcHeight: number) {
  if (srcWidth / srcHeight > FRAME_ASPECT) {
    const sw = srcHeight * FRAME_ASPECT;
    return { sx: (srcWidth - sw) / 2, sy: 0, sw, sh: srcHeight };
  }
  const sh = srcWidth / FRAME_ASPECT;
  return { sx: 0, sy: (srcHeight - sh) / 2, sw: srcWidth, sh };
}

type SendResult =
  | { status: "sent" }
  | { status: "rejected"; error: string }
  | { status: "failed" };

// "rejected" means the server said no for a reason retrying cannot fix (film
// developed, out of shots). "failed" means the network did — worth keeping.
async function sendShot(code: string, guestName: string, blob: Blob): Promise<SendResult> {
  const fd = new FormData();
  fd.append("image", blob, "photo.jpg");
  fd.append("eventCode", code);
  fd.append("guestName", guestName);

  // A stalled request never settles on its own, which would wedge the retry loop.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch("/api/photos/upload", {
      method: "POST",
      body: fd,
      signal: controller.signal,
    });
  } catch {
    return { status: "failed" };
  } finally {
    clearTimeout(timer);
  }

  if (res.status >= 500 || res.status === 429) return { status: "failed" };

  let json: { success?: boolean; error?: string };
  try {
    json = await res.json();
  } catch {
    return { status: "failed" };
  }

  if (json.success) return { status: "sent" };
  return { status: "rejected", error: json.error ?? "Upload failed." };
}

function filterFor(filter: "standard" | "vintage" | "bw") {
  if (filter === "vintage") return "sepia(0.4) contrast(1.1) brightness(0.95) saturate(1.2)";
  if (filter === "bw") return "grayscale(1) contrast(1.3) brightness(0.95)";
  return "none";
}

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
  const [showFilters, setShowFilters] = useState(false);
  const [quality, setQuality] = useState(0.9);
  const [streamRes, setStreamRes] = useState("");
  const [lastShot, setLastShot] = useState<ShotInfo | null>(null);
  const [pending, setPending] = useState(0);
  const [flushing, setFlushing] = useState(false);
  const flushingRef = useRef(false);

  useEffect(() => {
    const saved = Number(localStorage.getItem(QUALITY_KEY));
    if (QUALITY_OPTIONS.some((o) => o.value === saved)) setQuality(saved);
  }, []);

  function pickQuality(value: number) {
    setQuality(value);
    localStorage.setItem(QUALITY_KEY, String(value));
  }

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const maxShots = event?.maxShots ?? 27;
  // Queued shots have been taken even though the server has not seen them yet.
  const remaining = maxShots - shotsTaken - pending;

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

  const startCamera = useCallback(async () => {
    try {
      // Without an explicit request browsers hand back ~640x480, which is why
      // captured shots looked soft. "ideal" lets the device fall back gracefully.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 4096 },
          height: { ideal: 3072 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "");
        videoRef.current.setAttribute("muted", "");
        await videoRef.current.play();
        setStreamRes(`${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
        setCameraReady(true);
        setUseFallback(false);
        setError("");
      }
    } catch {
      setUseFallback(true);
      setCameraReady(true);
    }
  }, []);

  useEffect(() => {
    if (!event) return;
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [event, startCamera]);

  // Phones suspend the video element — and often kill the camera track outright —
  // while the tab is in the background, leaving a frozen viewfinder on return.
  useEffect(() => {
    async function resume() {
      if (document.visibilityState !== "visible" || useFallback) return;

      const track = streamRef.current?.getVideoTracks()[0];
      if (!track || track.readyState === "ended") {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        await startCamera();
        return;
      }

      if (videoRef.current?.paused) {
        try {
          await videoRef.current.play();
        } catch {
          await startCamera();
        }
      }
    }

    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
    };
  }, [startCamera, useFallback]);

  const uploadBlob = useCallback(
    async (blob: Blob) => {
      if (!guestName) return;
      setUploading(true);
      setError("");

      const result = await sendShot(code, guestName, blob);

      if (result.status === "sent") {
        setShotsTaken((n) => n + 1);
        setFlashing(true);
        setTimeout(() => setFlashing(false), 300);
      } else if (result.status === "rejected") {
        // The server will never accept this shot, so queueing it would loop forever.
        setError(result.error);
      } else {
        await enqueueShot(code, guestName, blob);
        setPending((n) => n + 1);
        setFlashing(true);
        setTimeout(() => setFlashing(false), 300);
      }

      setUploading(false);
    },
    [code, guestName]
  );

  // Push parked shots whenever there is a chance the network is back.
  const flushQueue = useCallback(async () => {
    if (!guestName || flushingRef.current) return;
    flushingRef.current = true;
    setFlushing(true);

    try {
      const queued = await listQueuedShots(code);
      setPending(queued.length);

      for (const shot of queued) {
        const result = await sendShot(code, shot.guestName, shot.blob);
        if (result.status === "failed") break; // still offline; keep the rest queued

        await removeQueuedShot(shot.id);
        setPending((n) => Math.max(n - 1, 0));

        if (result.status === "sent") setShotsTaken((n) => n + 1);
        else setError(`A saved photo couldn't be uploaded: ${result.error}`);
      }
    } finally {
      flushingRef.current = false;
      setFlushing(false);
    }
  }, [code, guestName]);

  useEffect(() => {
    if (!guestName) return;
    flushQueue();

    window.addEventListener("online", flushQueue);
    const interval = setInterval(flushQueue, RETRY_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", flushQueue);
      clearInterval(interval);
    };
  }, [guestName, flushQueue]);

  const captureFromVideo = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // A backgrounded tab can leave the track dead; capturing now saves a blank frame.
    if (!video.videoWidth || !video.videoHeight || video.paused) {
      setError("Camera went to sleep — waking it up, try again in a second.");
      await startCamera();
      return;
    }

    const { sx, sy, sw, sh } = coverCrop(video.videoWidth, video.videoHeight);
    const ratio = Math.min(MAX_DIM / sw, MAX_DIM / sh, 1);
    canvas.width = Math.round(sw * ratio);
    canvas.height = Math.round(sh * ratio);

    // Resizing the canvas resets its context, so the filter is set afterwards.
    const ctx = canvas.getContext("2d")!;
    ctx.filter = filterFor(filter);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setLastShot({ width: canvas.width, height: canvas.height, bytes: blob.size, quality });
        uploadBlob(blob);
      },
      "image/jpeg",
      quality
    );
  }, [uploadBlob, filter, quality, startCamera]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      const { sx, sy, sw, sh } = coverCrop(img.width, img.height);
      const ratio = Math.min(MAX_DIM / sw, MAX_DIM / sh, 1);
      canvas.width = Math.round(sw * ratio);
      canvas.height = Math.round(sh * ratio);

      const ctx = canvas.getContext("2d")!;
      ctx.filter = filterFor(filter);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          setLastShot({ width: canvas.width, height: canvas.height, bytes: blob.size, quality });
          uploadBlob(blob);
        },
        "image/jpeg",
        quality
      );
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

  if (remaining <= 0) {
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
          <div className="w-full h-full flex flex-col items-center justify-center text-text-muted gap-2 px-6 text-center">
            <span className="text-3xl">📷</span>
            <span className="text-sm">Tap the shutter to use your phone camera</span>
            <span className="text-[11px] text-text-muted/60">
              The in-app viewfinder needs an https:// address
            </span>
          </div>
        )}

        {flashing && (
          <div className="absolute inset-0 bg-white animate-flash pointer-events-none" />
        )}

        {/* Filters live behind this so they never crowd the frame */}
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`absolute bottom-3 right-3 w-10 h-10 rounded-full border flex items-center justify-center backdrop-blur transition-colors ${
            showFilters || filter !== "standard"
              ? "bg-accent border-accent text-background"
              : "bg-black/40 border-white/25 text-white"
          }`}
          aria-label="Photo filters"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
            <circle cx="9" cy="9" r="6" />
            <circle cx="15" cy="15" r="6" />
          </svg>
        </button>

        {showFilters && (
          <div className="absolute bottom-16 right-3 flex flex-col gap-1.5">
            {(["standard", "vintage", "bw"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => { setFilter(f); setShowFilters(false); }}
                className={`px-3 py-1.5 rounded-full text-xs font-mono border backdrop-blur transition-colors ${
                  filter === f
                    ? "bg-accent text-background border-accent font-semibold"
                    : "bg-black/60 border-white/20 text-white"
                }`}
              >
                {f === "standard" ? "Standard" : f === "vintage" ? "Vintage" : "B&W Film"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Film counter + Shutter */}
      <div className="w-full max-w-sm flex items-center justify-between mt-5">
        <FilmCounter remaining={Math.max(remaining, 0)} />

        <button
          onClick={useFallback ? () => fileInputRef.current?.click() : captureFromVideo}
          disabled={uploading || !cameraReady || remaining <= 0}
          className="w-[84px] h-[84px] rounded-full bg-accent border-4 border-background shadow-lg shadow-accent/30 flex items-center justify-center hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Take photo"
        >
          {uploading ? (
            <div className="w-6 h-6 border-2 border-background border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-background/20" />
          )}
        </button>

        <div className="w-10" aria-hidden="true" />
      </div>

      {/* Status line — only ever one message at a time */}
      <div className="w-full max-w-sm mt-3 min-h-[20px] flex items-center justify-center">
        {error ? (
          <p className="text-red-400 text-xs text-center">{error}</p>
        ) : pending > 0 ? (
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <p className="text-accent text-xs">
              {flushing ? `Uploading ${pending}…` : `${pending} waiting to upload`}
            </p>
          </div>
        ) : null}
      </div>

      {/* Quality tuning — temporary, remove once a level is locked in */}
      <details className="w-full max-w-sm mt-2">
        <summary className="text-text-muted/60 text-[10px] font-mono uppercase tracking-widest cursor-pointer list-none text-center">
          quality · {streamRes || "no camera"}
        </summary>
        <div className="mt-2 space-y-1.5">
          <div className="grid grid-cols-5 gap-1.5">
            {QUALITY_OPTIONS.map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => pickQuality(o.value)}
                className={`py-1.5 rounded-md text-[11px] font-mono border transition-colors ${
                  quality === o.value
                    ? "bg-accent text-background border-accent font-bold"
                    : "bg-surface border-text-muted/30 text-text-muted"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {lastShot && (
            <p className="text-text-muted text-[10px] font-mono text-center">
              {lastShot.width}x{lastShot.height} · {(lastShot.bytes / 1024 / 1024).toFixed(2)} MB ·
              q{Math.round(lastShot.quality * 100)}
            </p>
          )}
        </div>
      </details>

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

