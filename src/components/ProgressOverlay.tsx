"use client";

interface ProgressOverlayProps {
  completed: number;
  total: number;
  status: "processing" | "complete" | "error";
  onStop?: () => void;
}

export default function ProgressOverlay({
  completed,
  total,
  status,
  onStop,
}: ProgressOverlayProps) {
  if (status === "complete") return null;

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-[20px] px-6 py-4 min-w-[320px]" style={{ background: "rgba(255, 255, 255, 0.80)", backdropFilter: "blur(20px)" }}>
      <div className="flex items-center gap-3 mb-2">
        {status === "processing" && (
          <div className="w-4 h-4 border-2 border-[#5a3bdd] border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}
        {status === "error" && (
          <div className="w-4 h-4 rounded-full bg-red-500 flex-shrink-0" />
        )}
        <span className="text-sm font-medium text-[#1a1c1e]">
          {status === "processing"
            ? "Capturando pantallas..."
            : "Error en las capturas"}
        </span>
        <span className="text-sm text-[#6b7072] ml-auto">
          {completed}/{total}
        </span>
        {status === "processing" && onStop && (
          <button
            onClick={onStop}
            title="Detener captura"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 8,
              border: "1.5px solid #e0e0e0",
              background: "#fff",
              cursor: "pointer",
              flexShrink: 0,
              transition: "background 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#fef2f2";
              (e.currentTarget as HTMLElement).style.borderColor = "#fca5a5";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#fff";
              (e.currentTarget as HTMLElement).style.borderColor = "#e0e0e0";
            }}
          >
            {/* Stop icon: filled square */}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="1" y="1" width="8" height="8" rx="1.5" fill="#ef4444" />
            </svg>
          </button>
        )}
      </div>
      <div className="w-full bg-[#eff1f2] rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            status === "error" ? "bg-red-500" : "bg-[#E2F162]"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
