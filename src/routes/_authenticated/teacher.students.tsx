import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Search, TrendingDown, TrendingUp, Users } from "lucide-react";
import { GlassPanel, Loading, SectionTitle, StatCard } from "@/components/app/glass";
import { localDb } from "@/lib/local-client";
import { useAttempts, useTeachingCourses } from "@/lib/queries";
import { downloadCsv } from "@/lib/csv";
import { LiquidButton } from "@/components/app/liquid";

export const Route = createFileRoute("/_authenticated/teacher/students")({
  head: () => ({
    meta: [
      { title: "Danh sách sinh viên · EduSense" },
      {
        name: "description",
        content:
          "Toàn bộ sinh viên theo khóa học, điểm trung bình, xu hướng tiến bộ và mức độ hoạt động.",
      },
      { property: "og:title", content: "Danh sách sinh viên · EduSense" },
      {
        property: "og:description",
        content: "So sánh năng lực và mức độ hoạt động của từng sinh viên.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeacherStudents,
});

function TeacherStudents() {
  const { data: courses = [] } = useTeachingCourses();
  const courseIds = useMemo(() => courses.map((c) => c.id), [courses]);
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  const { data: attempts = [] } = useAttempts(courseIds);

  const { data: roster, isLoading } = useQuery({
    queryKey: ["teacher-roster", courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await localDb
        .from("enrollments")
        .select("course_id,student:profiles(id,name)")
        .in("course_id", courseIds);
      if (error) throw error;
      return (data ?? []) as unknown as {
        course_id: string;
        student: { id: string; name: string } | null;
      }[];
    },
  });

  if (isLoading || !roster) return <Loading />;

  const visible = roster.filter((r) => courseFilter === "all" || r.course_id === courseFilter);
  const students = new Map<string, { id: string; name: string; courses: Set<string> }>();
  for (const r of visible) {
    if (!r.student) continue;
    const cur = students.get(r.student.id) ?? {
      id: r.student.id,
      name: r.student.name,
      courses: new Set<string>(),
    };
    cur.courses.add(r.course_id);
    students.set(r.student.id, cur);
  }

  const rows = [...students.values()]
    .map((s) => {
      const mine = attempts
        .filter(
          (a) =>
            a.student_id === s.id &&
            a.quiz &&
            (courseFilter === "all" || a.quiz.course_id === courseFilter),
        )
        .sort((a, b) => a.attempted_at.localeCompare(b.attempted_at));
      const first = mine[0];
      const latest = mine[mine.length - 1];
      const avg = mine.length ? mine.reduce((t, a) => t + Number(a.score), 0) / mine.length : null;
      const trend =
        first && latest && mine.length >= 2 ? Number(latest.score) - Number(first.score) : 0;
      const last = latest ? latest.attempted_at : null;
      return { ...s, avg, trend, attempts: mine.length, last };
    })
    .filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

  const graded = rows.filter((r) => r.avg != null);
  const classAvg = graded.length
    ? (graded.reduce((t, r) => t + r.avg!, 0) / graded.length).toFixed(2)
    : "—";
  const atRisk = graded.filter((r) => r.avg! < 5 || r.trend <= -1.5).length;

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Sinh viên"
        subtitle="Theo dõi năng lực từng cá nhân trên mọi khóa học bạn phụ trách"
        icon={<Users className="h-5 w-5" />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Tổng sinh viên" value={rows.length} />
        <StatCard label="Điểm TB lớp" value={classAvg} />
        <StatCard label="Cần chú ý" value={atRisk} tone={atRisk ? "warning" : "success"} />
      </div>

      <GlassPanel className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên sinh viên"
              className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </div>
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 outline-none"
          >
            <option value="all">Tất cả khóa học</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <LiquidButton
            onClick={() =>
              downloadCsv(
                `sinh-vien-${new Date().toISOString().slice(0, 10)}`,
                rows.map((s) => ({
                  "Sinh viên": s.name,
                  "Số khóa": s.courses.size,
                  "Lượt kiểm tra": s.attempts,
                  "Điểm TB": s.avg != null ? s.avg.toFixed(2) : "",
                  "Xu hướng": s.trend.toFixed(1),
                  "Hoạt động cuối": s.last ? new Date(s.last).toLocaleDateString("vi-VN") : "",
                })),
              )
            }
            variant="outline"
          >
            <Download className="h-4 w-4" /> Xuất CSV
          </LiquidButton>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2">Sinh viên</th>
                <th className="pb-2">Khóa</th>
                <th className="pb-2">Lượt kiểm tra</th>
                <th className="pb-2">Điểm TB</th>
                <th className="pb-2">Xu hướng</th>
                <th className="pb-2">Hoạt động cuối</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((s) => (
                <tr key={s.id} className="text-slate-300">
                  <td className="py-2.5 text-slate-100">{s.name}</td>
                  <td className="py-2.5">{s.courses.size}</td>
                  <td className="py-2.5">{s.attempts}</td>
                  <td className="stat-num py-2.5 text-slate-100">
                    {s.avg != null ? s.avg.toFixed(2) : "—"}
                  </td>
                  <td className="py-2.5">
                    <span
                      className={
                        s.trend >= 0
                          ? "inline-flex items-center gap-1 text-[color:var(--success)]"
                          : "inline-flex items-center gap-1 text-destructive"
                      }
                    >
                      {s.trend >= 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {s.trend.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5">
                    {s.last ? new Date(s.last).toLocaleDateString("vi-VN") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="py-6 text-sm text-slate-400">Không tìm thấy sinh viên.</p>
          ) : null}
        </div>
      </GlassPanel>
    </div>
  );
}
