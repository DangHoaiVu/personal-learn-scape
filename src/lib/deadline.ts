export type DeadlineInfo = {
  label: string;
  tone: "none" | "ok" | "soon" | "urgent" | "overdue";
  days: number | null;
};

/** Tính trạng thái hạn nộp hoàn toàn ở phía client. */
export function deadlineInfo(due: string | null | undefined, submitted = false): DeadlineInfo {
  if (submitted) return { label: "Đã nộp", tone: "ok", days: null };
  if (!due) return { label: "Không giới hạn", tone: "none", days: null };
  const now = new Date();
  const d = new Date(due);
  const ms = d.getTime() - now.getTime();
  const days = Math.ceil(ms / 86_400_000);
  if (days < 0) return { label: `Quá hạn ${Math.abs(days)} ngày`, tone: "overdue", days };
  if (days === 0) return { label: "Hết hạn hôm nay", tone: "urgent", days };
  if (days <= 3) return { label: `Còn ${days} ngày`, tone: "urgent", days };
  if (days <= 7) return { label: `Còn ${days} ngày`, tone: "soon", days };
  return { label: `Còn ${days} ngày`, tone: "ok", days };
}

export const deadlineClass: Record<DeadlineInfo["tone"], string> = {
  none: "border-white/15 bg-white/5 text-slate-300",
  ok: "border-[color:var(--success)]/40 bg-[color:var(--success)]/15 text-[color:var(--success)]",
  soon: "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
  urgent: "border-[color:var(--warning)]/50 bg-[color:var(--warning)]/20 text-[color:var(--warning)]",
  overdue: "border-destructive/40 bg-destructive/15 text-destructive",
};