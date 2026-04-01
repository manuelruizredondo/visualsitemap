"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";

interface DrawingCanvasProps {
  imageUrl: string;
  savedDrawing?: string; // data URL of previous drawing
  onSave: (dataUrl: string | null) => void;
}

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  size: number;
}

const COLORS = [
  { value: "#ef4444", label: "Rojo" },
  { value: "#f97316", label: "Naranja" },
  { value: "#eab308", label: "Amarillo" },
  { value: "#22c55e", label: "Verde" },
  { value: "#3b82f6", label: "Azul" },
  { value: "#ffffff", label: "Blanco" },
];

const SIZES = [2, 4, 6, 10];

export default function DrawingCanvas({ imageUrl, savedDrawing, onSave }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#ef4444");
  const [brushSize, setBrushSize] = useState(4);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [undoneStrokes, setUndoneStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [drawingMode, setDrawingMode] = useState(false);
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load image dimensions
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImgDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Load saved drawing strokes
  useEffect(() => {
    if (savedDrawing && imgDimensions.width > 0) {
      // The saved drawing is a data URL overlay — we'll load it as the initial state
      // But we can't recover strokes from it, so we paint it as background
    }
  }, [savedDrawing, imgDimensions]);

  // Redraw canvas whenever strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || imgDimensions.width === 0) return;

    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const scale = containerWidth / imgDimensions.width;
    const displayHeight = imgDimensions.height * scale;

    canvas.width = containerWidth;
    canvas.height = displayHeight;
    canvas.style.height = `${displayHeight}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw saved overlay if exists and no current strokes
    if (savedDrawing && strokes.length === 0 && !currentStroke) {
      const overlayImg = new Image();
      overlayImg.onload = () => {
        ctx.drawImage(overlayImg, 0, 0, canvas.width, canvas.height);
      };
      overlayImg.src = savedDrawing;
      return;
    }

    // Draw saved overlay as base layer if strokes added on top
    if (savedDrawing && strokes.length === 0 && currentStroke) {
      // Will be redrawn next frame, skip
    }

    // Redraw all strokes
    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;
    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size * scale;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = 0.85;

      ctx.moveTo(stroke.points[0].x * scale, stroke.points[0].y * scale);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * scale, stroke.points[i].y * scale);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, [strokes, currentStroke, imgDimensions, savedDrawing]);

  // Resize canvas on container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      // Trigger re-render
      setStrokes((s) => [...s]);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const getPoint = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scale = imgDimensions.width / rect.width;
      return {
        x: (e.clientX - rect.left) * scale,
        y: (e.clientY - rect.top) * scale,
      };
    },
    [imgDimensions.width]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingMode) return;
      e.preventDefault();
      e.stopPropagation();
      const point = getPoint(e);
      setCurrentStroke({ points: [point], color, size: brushSize });
      setDrawing(true);
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    },
    [drawingMode, color, brushSize, getPoint]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing || !currentStroke) return;
      e.preventDefault();
      e.stopPropagation();
      const point = getPoint(e);
      setCurrentStroke((prev) =>
        prev ? { ...prev, points: [...prev.points, point] } : null
      );
    },
    [drawing, currentStroke, getPoint]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing || !currentStroke) return;
      e.preventDefault();
      e.stopPropagation();
      if (currentStroke.points.length > 1) {
        setStrokes((prev) => [...prev, currentStroke]);
        setUndoneStrokes([]);
        setDirty(true);
      }
      setCurrentStroke(null);
      setDrawing(false);
    },
    [drawing, currentStroke]
  );

  const handleUndo = useCallback(() => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setUndoneStrokes((u) => [...u, last]);
      setDirty(true);
      return prev.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setUndoneStrokes((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setStrokes((s) => [...s, last]);
      setDirty(true);
      return prev.slice(0, -1);
    });
  }, []);

  const handleClear = useCallback(() => {
    setStrokes([]);
    setUndoneStrokes([]);
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!imgDimensions.width) return;

    setSaving(true);
    try {
      if (strokes.length === 0) {
        // No drawing — clear saved drawing
        onSave(null);
        setDirty(false);
        return;
      }

      // Create a full-resolution canvas for export
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = imgDimensions.width;
      exportCanvas.height = imgDimensions.height;
      const ctx = exportCanvas.getContext("2d");
      if (!ctx) return;

      // Draw all strokes at full resolution
      for (const stroke of strokes) {
        if (stroke.points.length < 2) continue;
        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = 0.85;

        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      }

      const dataUrl = exportCanvas.toDataURL("image/png");
      onSave(dataUrl);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [strokes, imgDimensions, onSave]);

  return (
    <div className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--ec-surface-container-high)", background: "var(--ec-surface-container-low)", flexShrink: 0, flexWrap: "wrap" }}>
        {/* Draw mode toggle */}
        <button
          onClick={() => setDrawingMode(!drawingMode)}
          style={{
            padding: "6px 10px", borderRadius: 10, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
            background: drawingMode ? "var(--ec-secondary)" : "var(--ec-surface-container)",
            color: drawingMode ? "#fff" : "var(--ec-on-surface-variant)",
          }}
          title={drawingMode ? "Desactivar dibujo" : "Activar dibujo"}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          {drawingMode ? "Dibujando" : "Dibujar"}
        </button>

        {drawingMode && (
          <>
            <div style={{ width: 1, height: 20, background: "var(--ec-surface-container-high)" }} />

            {/* Colors */}
            <div style={{ display: "flex", gap: 4 }}>
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  style={{
                    width: 20, height: 20, borderRadius: "50%", border: "none", cursor: "pointer",
                    backgroundColor: c.value, transition: "all 0.15s",
                    outline: color === c.value ? "2px solid var(--ec-secondary)" : "2px solid transparent",
                    outlineOffset: 2, transform: color === c.value ? "scale(1.2)" : "scale(1)",
                  }}
                  title={c.label}
                />
              ))}
            </div>

            <div style={{ width: 1, height: 20, background: "var(--ec-surface-container-high)" }} />

            {/* Brush sizes */}
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setBrushSize(s)}
                  style={{
                    width: 24, height: 24, borderRadius: 6, border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                    background: brushSize === s ? "var(--ec-secondary)" : "transparent",
                  }}
                  title={`${s}px`}
                >
                  <span style={{ width: Math.min(s + 2, 12), height: Math.min(s + 2, 12), borderRadius: "50%", background: brushSize === s ? "#fff" : "var(--ec-on-surface-variant)" }} />
                </button>
              ))}
            </div>

            <div style={{ width: 1, height: 20, background: "var(--ec-surface-container-high)" }} />

            {/* Actions */}
            <button onClick={handleUndo} disabled={strokes.length === 0} title="Deshacer (Ctrl+Z)"
              style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", color: "var(--ec-on-surface-variant)", opacity: strokes.length === 0 ? 0.3 : 1, transition: "all 0.15s" }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" /></svg>
            </button>
            <button onClick={handleRedo} disabled={undoneStrokes.length === 0} title="Rehacer"
              style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", color: "var(--ec-on-surface-variant)", opacity: undoneStrokes.length === 0 ? 0.3 : 1, transition: "all 0.15s" }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4" /></svg>
            </button>
            <button onClick={handleClear} disabled={strokes.length === 0} title="Borrar todo"
              style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", color: "var(--ec-on-surface-variant)", opacity: strokes.length === 0 ? 0.3 : 1, transition: "all 0.15s" }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </>
        )}

        {/* Save button */}
        {dirty && (
          <>
            <div style={{ flex: 1 }} />
            <Button
              variant="primary"
              shape="rounded"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              loading={saving}
            >
              {saving ? "Guardando..." : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Guardar marcas
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {/* Image + canvas overlay */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto relative"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <img
            src={imageUrl}
            alt="Screenshot"
            className="w-full block"
            draggable={false}
          />
          {/* Saved drawing overlay (shown when not actively drawing new strokes) */}
          {savedDrawing && strokes.length === 0 && !currentStroke && (
            <img
              src={savedDrawing}
              alt="Marcas guardadas"
              className="absolute inset-0 w-full h-full pointer-events-none"
              draggable={false}
            />
          )}
          {/* Drawing canvas */}
          <canvas
            ref={canvasRef}
            className={`absolute top-0 left-0 w-full ${
              drawingMode ? "cursor-crosshair" : "pointer-events-none"
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>
      </div>
    </div>
  );
}
