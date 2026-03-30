"use client";

interface ProgressOverlayProps {
  completed: number;
  total: number;
  status: "processing" | "complete" | "error";
}

export default function ProgressOverlay({
  completed,
  total,
  status,
}: ProgressOverlayProps) {
  if (status === "complete") return null;

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 px-6 py-4 min-w-[320px]">
      <div className="flex items-center gap-3 mb-2">
        {status === "processing" && (
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}
        {status === "error" && (
          <div className="w-4 h-4 rounded-full bg-red-500" />
        )}
        <span className="text-sm font-medium text-gray-700">
          {status === "processing"
            ? "Capturando pantallas..."
            : "Error en las capturas"}
        </span>
        <span className="text-sm text-gray-500 ml-auto">
          {completed}/{total}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            status === "error" ? "bg-red-500" : "bg-blue-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
