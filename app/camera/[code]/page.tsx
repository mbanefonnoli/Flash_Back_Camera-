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

  let res: Response;
  try {
    res = await fetch("/api/photos/upload", { method: "POST", body: fd });
  } catch {
    return { status: "failed" };
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
  const [quality, setQuality] = useState(0.9);
  const [streamRes, setStreamRes] = useState("");
  const [lastShot, setLastShot] = useState<ShotInfo | null>(null);
  const [pending, setPending] = useState(0);
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

  // Start camera
  useEffect(() => {
    if (!event) return;

    async function startCamera() {
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
    }
  }, [code, guestName]);

  useEffect(() => {
    if (!guestName) return;
    flushQueue();

    window.addEventListener("online", flushQueue);
    const interval = setInterval(flushQueue, 20000);
    return () => {
      window.removeEventListener("online", flushQueue);
      clearInterval(interval);
    };
  }, [guestName, flushQueue]);

  const captureFromVideo = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
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
  }, [uploadBlob, filter, quality]);

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

      {/* Quality tuning — remove once the right level is chosen */}
      <div className="w-full max-w-sm mt-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-text-muted text-[10px] font-mono uppercase tracking-widest">
            Photo quality
          </span>
          <span className="text-text-muted text-[10px] font-mono">
            {streamRes ? `camera: ${streamRes}` : "camera: —"}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {QUALITY_OPTIONS.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => pickQuality(o.value)}
              className={`py-1.5 rounded-md text-[11px] font-mono border transition-colors ${
                quality === o.value
                  ? "bg-accent text-background border-accent font-bold"
                  : "bg-surface border-text-muted/30 text-text-muted hover:border-accent hover:text-accent"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {lastShot && (
          <p className="text-text-muted text-[10px] font-mono text-center pt-0.5">
            last shot: {lastShot.width}x{lastShot.height} ·{" "}
            {(lastShot.bytes / 1024 / 1024).toFixed(2)} MB · q{Math.round(lastShot.quality * 100)}
          </p>
        )}
      </div>

      {/* Film counter + Shutter */}
      <div className="w-full max-w-sm flex items-center justify-between mt-4">
        <FilmCounter remaining={Math.max(remaining, 0)} total={maxShots} />

        <button
          onClick={useFallback ? () => fileInputRef.current?.click() : captureFromVideo}
          disabled={uploading || !cameraReady || remaining <= 0}
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
          <p className="text-text-muted text-xs font-mono">{shotsTaken + pending} taken</p>
          {pending > 0 && (
            <p className="text-accent text-[10px] font-mono">{pending} to upload</p>
          )}
        </div>
      </div>

      {pending > 0 && (
        <div className="w-full max-w-sm mt-2 flex items-center justify-center gap-2 bg-accent/10 border border-accent/25 rounded-lg py-2 px-3">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse flex-shrink-0" />
          <p className="text-accent text-xs">
            {pending} photo{pending === 1 ? "" : "s"} saved on your phone — they&apos;ll upload
            when the signal is back.
          </p>
        </div>
      )}

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

