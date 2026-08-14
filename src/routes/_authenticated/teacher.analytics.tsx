import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, BarChart3, Flame } from "lucide-react";
import { GlassPanel, Loading, SectionTitle } from "@/components/app/glass";
import { tooltipStyle } from "@/components/app/chart-theme";
import { useActivityLogs, useAttempts, useQuestionAnalytics, useTeachingCourses } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/teacher/analytics")({
  head: () => ({
    meta: [
      { title: "Phân tích lớp học · EduSense" },
      { name: "description", content: "Phổ điểm, phân tích câu hỏi khó và bản đồ nhiệt hoạt động học tập." },
      { property: "og:title", content: "Phân tích lớp học · EduSense" },
      { property: "og:description", content: "Item analysis và heatmap hành vi học tập." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeacherAnalytics,
});

const BANDS = ["0-2", "2-4", "4-6", "6-8", "8-10"];
const DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function TeacherAnalytics() {
  const { data: courses = [], isLoading } = useTeachingCourses();
  const [courseId, setCourseId] = useState<string>("all");
  const ids = useMemo(() => courses.map((c) => c.id), [courses]);
  const scoped = courseId === "all" ? ids : [courseId];
  const { data: attempts = [] } = useAttempts(ids);
  const { data: questions = [] } = useQuestionAnalytics(ids);
  const { data: logs = [] } = useActivityLogs(ids);

  const inScope = attempts.filter((a) => scoped.includes(a.quiz?.course_id ?? ""));

  const histogram = useMemo(() => {
    const counts = BANDS.map((band) => ({ band, count: 0 }));
    for (const a of inScope) {
      const s = Number(a.score);
      const i = Math.min(4, Math.max(0, Math.floor(s / 2)));
      counts[i]!.count += 1;
    }
    return counts;
  }, [inScope]);

  const hardest = useMemo(
    () =>
      questions
        .filter((q) => scoped.includes(q.courseId) && q.total >= 3)
        .map((q) => ({ ...q, wrongRate: Math.round((q.wrong / q.total) * 100) }))
        .sort((a, b) => b.wrongRate - a.wrongRate)
        .slice(0, 8),
    [questions, courseId],
  );

  const heat = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
    for (const l of logs) {
      if (l.course_id && !scoped.includes(l.course_id)) continue;
      const d = new Date(l.timestamp);
      grid[d.getDay()]![d.getHours()!] = (grid[d.getDay()]![d.getHours()] ?? 0) + 1;
    }
    const max = Math.max(1, ...grid.flat());
    return { grid, max };
  }, [logs, courseId]);

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Phân tích chi tiết</h1>
          <p className="text-sm text-slate-400">Phổ điểm, câu hỏi gây khó và nhịp học của lớp.</p>
        </div>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
        >
          <option value="all" className="bg-slate-900">
            Tất cả khóa học
          </option>
          {courses.map((c) => (
            <option key={c.id} value={c.id} className="bg-slate-900">
              {c.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassPanel>
          <SectionTitle
            title="Phổ điểm"
            subtitle={`${inScope.length} lượt làm bài`}
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogram}>
                <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis dataKey="band" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {histogram.map((_, i) => (
                    <Cell key={i} fill={i < 2 ? "var(--destructive)" : i < 3 ? "var(--warning)" : "var(--color-aurora-blue)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        <GlassPanel>
          <SectionTitle title="Câu hỏi gây khó nhất" subtitle="Tỉ lệ trả lời sai" icon={<Flame className="h-4 w-4" />} />
          <ul className="space-y-2">
            {hardest.map((q) => (
              <li key={q.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-slate-200">{q.text}</p>
                  <span className="stat-num shrink-0 text-sm text-destructive">{q.wrongRate}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-destructive/80" style={{ width: `${q.wrongRate}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {q.quiz} · {q.topic} · {q.total} lượt
                </p>
              </li>
            ))}
            {hardest.length === 0 ? <p className="text-sm text-slate-400">Chưa đủ dữ liệu.</p> : null}
          </ul>
        </GlassPanel>
      </div>

      <GlassPanel>
        <SectionTitle
          title="Bản đồ nhiệt hoạt động"
          subtitle="Thời điểm sinh viên học trong tuần"
          icon={<Activity className="h-4 w-4" />}
        />
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="mb-1 ml-9 flex gap-[3px]">
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="w-[18px] text-center text-[9px] text-slate-500">
                  {h % 3 === 0 ? h : ""}
                </span>
              ))}
            </div>
            {heat.grid.map((row, d) => (
              <div key={d} className="mb-[3px] flex items-center gap-[3px]">
                <span className="w-9 text-[10px] text-slate-400">{DAYS[d]}</span>
                {row.map((v, h) => (
                  <span
                    key={h}
                    title={`${DAYS[d]} ${h}:00 — ${v} hoạt động`}
                    className={cn("h-[18px] w-[18px] rounded-[5px] border border-white/5")}
                    style={{
                      backgroundColor: v
                        ? `color-mix(in oklab, var(--color-aurora-blue) ${Math.round((v / heat.max) * 100)}%, transparent)`
                        : "rgba(255,255,255,0.04)",
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
