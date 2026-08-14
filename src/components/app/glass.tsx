import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function LiquidGlassDefs() {
  return (
    <svg aria-hidden className="pointer-events-none fixed h-0 w-0">
      <filter id="liquid-glass-filter" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="7" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="6" result="softNoise" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="softNoise"
          scale="42"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}

export function AuroraBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink">
      <div className="aurora-a absolute -left-40 top-[-10%] h-[46rem] w-[46rem] rounded-full bg-aurora-blue/30 blur-3xl" />
      <div className="aurora-b absolute right-[-15%] top-[10%] h-[40rem] w-[40rem] rounded-full bg-aurora-violet/30 blur-3xl" />
      <div className="aurora-c absolute bottom-[-20%] left-[25%] h-[38rem] w-[38rem] rounded-full bg-aurora-pink/25 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,transparent_20%,var(--color-ink)_100%)] opacity-80" />
    </div>
  );
}

export function GlassPanel({
  children,
  className,
  as: _as,
}: {
  children?: ReactNode;
  className?: string;
  as?: string;
}) {
  return (
    <div className={cn("glass-panel p-5", className)}>
      <span className="glass-sheen" />
      <div className="relative">{children}</div>
    </div>
  );
}

export function LiquidPanel({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cn("liquid-glass p-5", className)}>
      <span className="glass-sheen" />
      <div className="relative">{children}</div>
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {icon ? (
        <span className="mt-0.5 rounded-xl border border-white/15 bg-white/10 p-2 text-slate-200">{icon}</span>
      ) : null}
      <div>
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    default: "text-slate-100",
    success: "text-[color:var(--success)]",
    warning: "text-[color:var(--warning)]",
    danger: "text-destructive",
  }[tone];
  return (
    <GlassPanel className="p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn("stat-num mt-2 text-3xl font-semibold", toneClass)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </GlassPanel>
  );
}

export function Loading({ label = "Đang tải dữ liệu…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-16 text-sm text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
      {label}
    </div>
  );
}
