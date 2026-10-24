"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/files";

type ImageCropperProps = {
  file: File;
  aspect: number;
  maxBytes: number;
  onCancel: () => void;
  onConfirm: (file: File) => void;
  onError: (message: string) => void;
};

export function ImageCropper({
  file,
  aspect,
  maxBytes,
  onCancel,
  onConfirm,
  onError,
}: ImageCropperProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [source] = useState(() => URL.createObjectURL(file));
  const [natural, setNatural] = useState({ width: 1, height: 1 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    const frame = frameRef.current;
    if (!frame) return;
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const frameWidth = frame.clientWidth;
      const frameHeight = frame.clientHeight;
      const fitted = Math.max(frameWidth / natural.width, frameHeight / natural.height);
      const displayWidth = natural.width * fitted * scale;
      const displayHeight = natural.height * fitted * scale;
      const originX = (frameWidth - displayWidth) / 2 + offset.x;
      const originY = (frameHeight - displayHeight) / 2 + offset.y;
      const sx = Math.max(0, ((0 - originX) / displayWidth) * natural.width);
      const sy = Math.max(0, ((0 - originY) / displayHeight) * natural.height);
      const sw = Math.min(
        natural.width - sx,
        (frameWidth / displayWidth) * natural.width,
      );
      const sh = Math.min(
        natural.height - sy,
        (frameHeight / displayHeight) * natural.height,
      );
      const targetHeight = aspect < 1 ? 540 : 180;
      const targetWidth = Math.round(targetHeight * aspect);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, targetWidth);
      canvas.height = Math.max(1, targetHeight);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        onError("The photograph could not be cropped. Try another image.");
        return;
      }
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!blob) {
        onError("The photograph could not be cropped. Try another image.");
        return;
      }
      const cropped = new File([blob], file.name.replace(/\.\w+$/i, ".jpg"), {
        type: "image/jpeg",
      });
      const compressed = await compressImage(cropped, maxBytes);
      onConfirm(compressed);
    } catch {
      onError("The image is too large. Use a smaller JPG or PNG.");
    } finally {
      setBusy(false);
    }
  }

  // Above the ERP dialogs (z-200), so it also works when opened from inside one.
  return createPortal(
    <div
      className="fixed inset-0 z-[450] grid place-items-center bg-purple-deep/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-lift">
        <h2 id="crop-title" className="font-heading text-lg font-extrabold text-primary">
          Crop before upload
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Drag to position. Zoom to fill the frame. Preview is shown at the required
          ratio.
        </p>
        <div
          ref={frameRef}
          className="relative mx-auto mt-3 max-w-full overflow-hidden rounded-xl border border-border bg-muted"
          style={{ aspectRatio: String(aspect), width: "min(100%, 16rem)" }}
          onPointerDown={(event) => {
            (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
            setDrag({ x: event.clientX - offset.x, y: event.clientY - offset.y });
          }}
          onPointerMove={(event) => {
            if (!drag) return;
            setOffset({ x: event.clientX - drag.x, y: event.clientY - drag.y });
          }}
          onPointerUp={() => setDrag(null)}
          onPointerCancel={() => setDrag(null)}
        >
          {/* User-selected blob preview; next/image cannot serve object URLs. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={source}
            alt=""
            className="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
            style={{
              transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            }}
            onLoad={(event) => {
              const image = event.currentTarget;
              setNatural({
                width: image.naturalWidth || 1,
                height: image.naturalHeight || 1,
              });
            }}
          />
        </div>
        <label className="mt-3 block text-xs font-semibold text-primary">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={scale}
            className="mt-1 w-full accent-primary"
            onChange={(event) => setScale(Number(event.target.value))}
          />
        </label>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              URL.revokeObjectURL(source);
              onCancel();
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="gold"
            size="sm"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {busy ? "Saving…" : "Use this crop"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
