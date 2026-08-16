import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel, Loading, SectionTitle, StatCard } from "@/components/app/glass";
import { supabase } from "@/integrations/supabase/client";
import { useRiskAlerts, useTeachingCourses } from "@/lib/queries";
import { downloadCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/teacher/alerts")({
  head: () => ({
    meta: [
      { title: "Cảnh báo nguy cơ · EduSense" },
      { name: "description", content: "Danh sách sinh viên có nguy cơ, tính lại theo yêu cầu và xuất báo cáo CSV." },
      { property: "og:title", content: "Cảnh báo nguy cơ · EduSense" },
      { property: "og:description", content: "Phát hiện sớm sinh viên cần hỗ trợ dựa trên dữ liệu thật." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeacherAlerts,
});

function TeacherAlerts() {
  const { data: courses = [] } = useTeachingCourses();
  const { data: alerts = [], isLoading } = useRiskAlerts();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [courseFilter, setCourseFilter] = useState("all");

  const courseName = useMemo(() => new Map(courses.map((c) => [c.id, c.title])), [courses]);
  const rows = alerts.filter((a) => courseFilter === "all" || a.course_id === courseFilter);
  const high = rows.filter((a) => a.level === "high").length;

  async function recompute() {
    setBusy(true);
    const { data, error } = await supabase.rpc("recompute_risk_alerts");
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Đã tính lại: ${data ?? 0} cảnh báo`);
    queryClient.invalidateQueries({ queryKey: ["risk-alerts"] });
  }

  function exportCsv() {
    downloadCsv(
      "canh-bao-nguy-co",
      rows.map((a) => ({
        "Sinh viên": a.student?.name ?? "",
        "Khóa học": courseName.get(a.course_id) ?? "",
        "Mức độ": a.level === "high" ? "Cao" : "Trung bình",
        "Lý do": a.reason,
        "Ngày ghi nhận": new Date(a.created_at).toLocaleDateString("vi-VN"),
      })),
    );
  }

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Cảnh báo nguy cơ</h1>
          <p className="text-sm text-slate-400">
            Tính từ hoạt động, xu hướng điểm và điểm trung bình. Chạy khi bạn bấm, không chạy nền.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={recompute}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-aurora-blue to-aurora-violet px-4 py-2 text-sm font-semibold text-slate-50 disabled:opacity-60"
          >
            <RefreshCcw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            {busy ? "Đang tính…" : "Tính lại cảnh báo"}
          </button>
          <button
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Xuất CSV
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Tổng cảnh báo" value={rows.length} tone={rows.length ? "warning" : "success"} />
        <StatCard label="Mức cao" value={high} tone={high ? "danger" : "success"} />
        <StatCard label="Khóa học phụ trách" value={courses.length} />
      </div>

      <div className="flex flex-wrap gap-2">
        {[{ id: "all", title: "Tất cả khóa" }, ...courses.map((c) => ({ id: c.id, title: c.title }))].map((c) => (
          <button
            key={c.id}
            onClick={() => setCourseFilter(c.id)}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              courseFilter === c.id
                ? "border-aurora-blue/50 bg-aurora-blue/20 text-slate-100"
                : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {c.title}
          </button>
        ))}
      </div>

      <GlassPanel>
        <SectionTitle title={`Danh sách (${rows.length})`} icon={<AlertTriangle className="h-4 w-4" />} />
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">Không có cảnh báo nào. Bấm “Tính lại cảnh báo” để cập nhật.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-slate-100">{a.student?.name ?? "Sinh viên"}</p>
                  <p className="text-xs text-slate-400">
                    {courseName.get(a.course_id) ?? "—"} · {a.reason}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs ${
                    a.level === "high"
                      ? "border-destructive/40 bg-destructive/15 text-destructive"
                      : "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/15 text-[color:var(--warning)]"
                  }`}
                >
                  {a.level === "high" ? "Nguy cơ cao" : "Cần theo dõi"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>
    </div>
  );
}