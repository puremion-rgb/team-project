import type { CSSProperties } from "react";

type LoadingIndicatorProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: { outer: "h-7 w-7", dot: "h-1.5 w-1.5", inset: 5 },
  md: { outer: "h-12 w-12", dot: "h-2 w-2", inset: 8 },
  lg: { outer: "h-20 w-20", dot: "h-3 w-3", inset: 14 },
} as const;

/** Brand-colored loading ring based on the supplied loading icon. */
export default function LoadingIndicator({
  label = "불러오는 중이에요…",
  size = "md",
  className = "",
}: LoadingIndicatorProps) {
  const selected = sizes[size];
  const ringMask: CSSProperties = {
    WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${selected.inset}px), #000 calc(100% - ${selected.inset - 1}px))`,
    mask: `radial-gradient(farthest-side, transparent calc(100% - ${selected.inset}px), #000 calc(100% - ${selected.inset - 1}px))`,
  };

  return (
    <div className={`flex flex-col items-center gap-3 text-ink-muted ${className}`} role="status" aria-live="polite">
      <div className={`relative ${selected.outer} rounded-full bg-brand-tint`} style={ringMask}>
        <div
          className="absolute inset-0 animate-spin rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(216,90,48,0.04)_80deg,rgba(216,90,48,0.18)_145deg,rgba(216,90,48,0.48)_215deg,#D85A30_345deg,#D85A30_360deg)]"
          style={ringMask}
        >
          <span className={`absolute left-1/2 top-0 -translate-x-1/2 rounded-full bg-brand ${selected.dot}`} />
        </div>
      </div>
      {label && <p className="text-[14px]">{label}</p>}
    </div>
  );
}
