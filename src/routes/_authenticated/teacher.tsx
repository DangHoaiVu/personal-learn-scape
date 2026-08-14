import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowRight, BookOpen, Users } from "lucide-react";
import { GlassPanel, Loading, SectionTitle, StatCard } from "@/components/app/glass";
import { useAttempts, useRiskAlerts, useTeachingCourses } from "@/lib/queries";
import { tooltipStyle } from "@/components/app/chart-theme";

export const Route = createFileRoute("/_authenticated/teacher")({
  head: () => ({
    meta: [
      { title: "Bảng điều khiển giảng viên · EduSense" },
      { name: "description", content: "Cảnh báo sinh viên nguy cơ và xu hướng điểm trung bình lớp theo thời gian." },
      { property: "og:title", content: "Bảng điều khiển giảng viên · EduSense" },
      { property: "og:description", content: "Theo dõi sức khỏe lớp học bằng dữ liệu thật." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeacherDashboard,
});

function TeacherDashboard() {
  const { data: courses = [], isLoading } = useTeachingCourses();
  const courseIds = useMemo(() => courses.map((c) => c.id), [courses]);
  const { data: attempts = [] } = useAttempts(courseIds);
  const { data: alerts = [] } = useRiskAlerts();

  const students = new Set(attempts.map((a) => a.student_id));
  const avg = attempts.length ? attempts.reduce((s, a) => s + Number(a.score), 0) / attempts.length : 0;

  const trend = useMemo(() => {
    const buckets = new Map<string, { sum: number; n: number }>();
    for (const a of attempts) {
      const key = a.attempted_at.slice(0, 7);
      const cur = buckets.get(key) ?? { sum: 0, n: 0 };
      cur.sum += Number(a.score);
      cur.n += 1;
      buckets.set(key, cur);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, avg: Math.round((v.sum / v.n) * 100) / 100 }));
  }, [attempts]);

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Tổng quan lớp học</h1>
        <p className="text-sm text-slate-400">Tất cả chỉ số được tính trực tiếp từ dữ liệu bài làm.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Khóa học phụ trách" value={courses.length} />
        <StatCard label="Sinh viên có bài làm" value={students.size} />
        <StatCard label="Điểm TB toàn bộ" value={avg.toFixed(2)} hint="thang điểm 10" />
        <StatCard
          label="Cảnh báo nguy cơ"
          value={alerts.length}
          tone={alerts.length ? "danger" : "success"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassPanel className="lg:col-span-2">
          <SectionTitle title="Xu hướng điểm trung bình" subtitle="Theo tháng, toàn bộ khóa học" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip {...tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="var(--color-aurora-blue)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--color-aurora-violet)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        <GlassPanel>
          <SectionTitle title="Sinh viên nguy cơ" icon={<AlertTriangle className="h-4 w-4" />} />
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-400">Chưa có cảnh báo nào.</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {alerts.map((a) => (
                <li key={a.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-100">{a.student?.name ?? "Sinh viên"}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        a.level === "high"
                          ? "bg-destructive/20 text-destructive"
                          : "bg-[color:var(--warning)]/20 text-[color:var(--warning)]"
                      }`}
                    >
                      {a.level === "high" ? "Cao" : "Trung bình"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{a.reason}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {courses.find((c) => c.id === a.course_id)?.title}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
          <GlassPanel key={c.id}>
            <BookOpen className="h-4 w-4 text-aurora-blue" />
            <h3 className="mt-2 font-semibold text-slate-100">{c.title}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-slate-400">{c.description}</p>
            <Link
              to="/teacher/courses/$courseId"
              params={{ courseId: c.id }}
              className="mt-3 inline-flex items-center gap-1 text-xs text-aurora-blue hover:underline"
            >
              Quản lý <ArrowRight className="h-3 w-3" />
            </Link>
          </GlassPanel>
        ))}
      </div>

      <p className="flex items-center gap-2 text-xs text-slate-500">
        <Users className="h-3.5 w-3.5" /> Dữ liệu hành vi được mô phỏng cho mục đích trình diễn đồ án.
      </p>
    </div>
  );
}
