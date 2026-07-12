"use client";

import { AlertTriangle, ChevronsUp, ChevronUp, Minus, Info } from "lucide-react";
import styles from "../dashboard.module.css";

// Single source of truth for severity/priority styling across the whole app,
// so Critical/High/Medium/Low mean the same thing and are coloured identically.
export const SEVERITY_META: Record<string, { label: string; color: string; Icon: typeof AlertTriangle }> = {
  critical: { label: "Critical", color: "#ef4444", Icon: AlertTriangle },
  high:     { label: "High",     color: "#f97316", Icon: ChevronsUp },
  medium:   { label: "Medium",   color: "#eab308", Icon: ChevronUp },
  low:      { label: "Low",      color: "#22c55e", Icon: Minus },
  info:     { label: "Info",     color: "#60a5fa", Icon: Info },
};

// Severity/priority/probability badge. `dimension` (e.g. "Priority", "Severity",
// "Probability") is rendered INLINE as a prefix so two badges that reuse the same
// Critical/High/Medium vocabulary can't be confused for one another.
export function SeverityBadge({ level, dimension, title }: { level: string; dimension?: string; title?: string }) {
  const m = SEVERITY_META[level.toLowerCase()] ?? SEVERITY_META.medium;
  const Icon = m.Icon;
  return (
    <span
      className={styles.badge}
      title={title ?? (dimension ? `${dimension}: ${m.label}` : `${m.label} severity`)}
      style={{ background: `${m.color}1f`, color: m.color, border: `1px solid ${m.color}55`, display: "inline-flex", alignItems: "center", gap: "0.25rem", cursor: title ? "help" : undefined }}
    >
      <Icon size={11} />
      {dimension && <span style={{ opacity: 0.7, fontWeight: 500 }}>{dimension}:</span>} {m.label}
    </span>
  );
}

// Neutral labeled pill for dimensions that AREN'T a severity scale — Effort,
// Status, Appetite. Always renders "Dimension: Value" so its meaning is explicit.
export function LabeledBadge({ dimension, value, color = "#94a3b8" }: { dimension: string; value: string; color?: string }) {
  return (
    <span
      className={styles.badge}
      title={`${dimension}: ${value}`}
      style={{ background: `${color}1f`, color, border: `1px solid ${color}44`, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
    >
      <span style={{ opacity: 0.7, fontWeight: 500 }}>{dimension}:</span> {value}
    </span>
  );
}

// Colour helpers for the non-severity dimensions, kept here so every screen uses
// the same palette for the same value.
export const EFFORT_COLOR: Record<string, string> = { "quick-win": "#22c55e", medium: "#eab308", complex: "#f97316" };
export const STATUS_COLOR: Record<string, string> = { open: "#94a3b8", in_progress: "#eab308", resolved: "#22c55e", untreated: "#94a3b8", done: "#22c55e" };
export const STATUS_LABEL: Record<string, string> = { open: "Open", in_progress: "In Progress", resolved: "Resolved", untreated: "Untreated", done: "Done" };

// Inline legend describing the four severity levels, with an optional context
// note stating what the severity means on this particular screen.
export function SeverityLegend({ note }: { note?: string }) {
  return (
    <div className={`${styles.flex}`} style={{ gap: "0.9rem", flexWrap: "wrap", alignItems: "center" }}>
      <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>Severity:</span>
      {(["critical", "high", "medium", "low"] as const).map((lvl) => {
        const m = SEVERITY_META[lvl];
        const Icon = m.Icon;
        return (
          <span key={lvl} className={`${styles.flex} ${styles.itemsCenter}`} style={{ gap: "0.25rem", color: m.color, fontSize: "0.72rem", fontWeight: 600 }}>
            <Icon size={12} /> {m.label}
          </span>
        );
      })}
      {note && <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>· {note}</span>}
    </div>
  );
}
