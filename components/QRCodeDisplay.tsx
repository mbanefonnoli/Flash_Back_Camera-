"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  url: string;
  code: string;
  eventName?: string;
  size?: number;
};

function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, family: string, startSize: number) {
  let size = startSize;
  ctx.font = `${size}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size -= 1;
    ctx.font = `${size}px ${family}`;
  }
  return size;
}

export default function QRCodeDisplay({ url, code, eventName, size = 200 }: Props) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      color: { dark: "#0A0A0A", light: "#F5F5F5" },
    }).then(setDataUrl);
  }, [url, size]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const qrSize = 480;
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: qrSize,
        margin: 2,
        color: { dark: "#0A0A0A", light: "#F5F5F5" },
      });

      const qrImg = new Image();
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => resolve();
        qrImg.onerror = reject;
        qrImg.src = qrDataUrl;
      });

      const width = 560;
      const qrTop = 150;
      const height = qrTop + qrSize + 150;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(0, 0, width, height);
      ctx.textAlign = "center";

      ctx.fillStyle = "#F5A623";
      ctx.font = "bold 30px sans-serif";
      ctx.fillText(eventName?.trim() || "Flashback", width / 2, 56, width - 60);

      ctx.fillStyle = "#9A9A9A";
      ctx.font = "15px sans-serif";
      ctx.fillText("Scan to get your disposable camera", width / 2, 86);

      const qrX = (width - qrSize) / 2;
      ctx.drawImage(qrImg, qrX, qrTop, qrSize, qrSize);

      ctx.fillStyle = "#F5A623";
      ctx.font = "bold 34px monospace";
      ctx.fillText(code, width / 2, qrTop + qrSize + 48);

      ctx.fillStyle = "#9A9A9A";
      const urlFontSize = fitFont(ctx, url, width - 60, "monospace", 15);
      ctx.font = `${urlFontSize}px monospace`;
      ctx.fillText(url, width / 2, qrTop + qrSize + 80);

      const finalDataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = finalDataUrl;
      link.download = `flashback-${code}.png`;
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="bg-surface rounded-lg animate-pulse"
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt="QR code"
        width={size}
        height={size}
        className="rounded-lg"
      />
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="py-2 px-4 text-xs font-mono uppercase tracking-widest bg-accent/10 border border-accent/20 text-accent rounded-lg hover:bg-accent hover:text-background transition-colors disabled:opacity-50"
      >
        {downloading ? "Preparing…" : "Download QR"}
      </button>
    </div>
  );
}
