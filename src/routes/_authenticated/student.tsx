import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { AlertTriangle, ArrowRight, Lightbulb, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { GlassPanel, Loading, SectionTitle, StatCard } from "@/components/app/glass";
import { useProfile } from "@/lib/session";
import { useAttempts, useMyCourses, useTopicStats } from "@/lib/queries";
import { tooltipStyle } from "@/components/app/chart-theme";

export const Route = createFileRoute("/_authenticated/student")({
  head: () => ({
    meta: [
      { title: "Tổng quan học tập · EduSense" },
      { name: "description", content: "Theo dõi tiến độ mọi môn học, xu hướng điểm và gợi ý ôn tập cá nhân hóa." },
      { property: "og:title", content: "Tổng quan học tập · EduSense" },
      { property: "og:description", content: "Dashboard đa môn với cảnh báo môn đang tụt và gợi ý ôn tập." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const { data: profile } = useProfile();
  const { data: courses = [], isLoading } = useMyCourses();
  const courseIds = useMemo(() => courses.map((c) => c.id), [courses]);
  const { data: attempts = [] } = useAttempts(courseIds);
  const { data: topics = [] } = useTopicStats();

  const myAttempts = attempts.filter((a) => a.student_id === profile?.id);

  const perCourse = useMemo(() => {
    return courses.map((c) => {
      const mine = myAttempts.filter((a) => a.quiz?.course_id === c.id);
      const avg = mine.length ? mine.reduce((s, a) => s + Number(a.score), 0) / mine.length : 0;
      const half = Math.floor(mine.length / 2);
      const early = mine.slice(0, half);
      const late = mine.slice(half);
      const trend =
        early.length && late.length
          ? late.reduce((s, a) => s + Number(a.score), 0) / late.length -
            early.reduce((s, a) => s + Number(a.score), 0) / early.length
          : 0;
      const classAttempts = attempts.filter((a) => a.quiz?.course_id === c.id);
      const byStudent = new Map<string, number[]>();
      for (const a of classAttempts) {
        byStudent.set(a.student_id, [...(byStudent.get(a.student_id) ?? []), Number(a.score)]);
      }
      const averages = [...byStudent.entries()].map(([sid, list]) => ({
        sid,
        avg: list.reduce((s, v) => s + v, 0) / list.length,
      }));
      const sorted = [...averages].sort((a, b) => b.avg - a.avg);
      const rank = sorted.findIndex((s) => s.sid === profile?.id);
      const percentile = rank >= 0 && sorted.length ? Math.max(1, Math.round(((rank + 1) / sorted.length) * 100)) : null;
      return {
        course: c,
        avg,
        trend,
        percentile,
        series: mine.map((a, i) => ({ i: i + 1, score: Number(a.score), label: a.quiz?.title ?? "" })),
      };
    });
  }, [courses, myAttempts, attempts, profile?.id]);

  const overallAvg = myAttempts.length
    ? myAttempts.reduce((s, a) => s + Number(a.score), 0) / myAttempts.length
    : 0;
  const bestPercentile = perCourse.reduce<number | null>(
    (best, c) => (c.percentile != null && (best == null || c.percentile < best) ? c.percentile : best),
    null,
  );
  const weakTopics = useMemo(
    () =>
      topics
        .filter((t) => t.total >= 3)
        .map((t) => ({ ...t, pct: (t.correct / t.total) * 100 }))
        .sort((a, b) => a.pct - b.pct)
        .slice(0, 4),
    [topics],
  );
  const decliningCourses = perCourse.filter((c) => c.trend < -0.4);

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Xin chào, {profile?.name}</h1>
        <p className="text-sm text-slate-400">Bức tranh tổng hợp mọi môn bạn đang học.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Môn đang học" value={courses.length} />
        <StatCard label="Điểm trung bình" value={overallAvg.toFixed(2)} hint="thang điểm 10" />
        <StatCard
          label="Xếp hạng lớp"
          value={bestPercentile ? `Top ${bestPercentile}%` : "—"}
          hint="ẩn danh, môn tốt nhất"
          tone="success"
        />
        <StatCard
          label="Môn đang tụt"
          value={decliningCourses.length}
          tone={decliningCourses.length ? "warning" : "default"}
          hint="xu hướng điểm giảm"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionTitle title="Các môn học" subtitle="Xu hướng điểm quiz theo thời gian" icon={<Trophy className="h-4 w-4" />} />
          {perCourse.map(({ course, avg, trend, percentile, series }) => (
            <GlassPanel key={course.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-100">{course.title}</h3>
                    {trend < -0.4 ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/15 px-2 py-0.5 text-xs text-[color:var(--warning)]">
                        <TrendingDown className="h-3 w-3" /> Đang tụt
                      </span>
                    ) : trend > 0.4 ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--success)]/40 bg-[color:var(--success)]/15 px-2 py-0.5 text-xs text-[color:var(--success)]">
                        <TrendingUp className="h-3 w-3" /> Tiến bộ
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Điểm TB <span className="stat-num text-slate-200">{avg.toFixed(2)}</span>
                    {percentile ? <> · Top {percentile}% lớp</> : null}
                  </p>
                </div>
                <Link
                  to="/student/courses/$courseId"
                  params={{ courseId: course.id }}
                  className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/15"
                >
                  Vào học <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="mt-3 h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                    <XAxis dataKey="i" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 10]} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
                    <Tooltip {...tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="var(--color-aurora-blue)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "var(--color-aurora-violet)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GlassPanel>
          ))}
        </div>

        <div className="space-y-4">
          <GlassPanel>
            <SectionTitle title="Gợi ý ôn tập" subtitle="Chủ đề yếu nhất của bạn" icon={<Lightbulb className="h-4 w-4" />} />
            {weakTopics.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa đủ dữ liệu để gợi ý.</p>
            ) : (
              <ul className="space-y-3">
                {weakTopics.map((t) => {
                  const course = courses.find((c) => c.id === t.course_id);
                  return (
                    <li key={`${t.course_id}-${t.topic_tag}`}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-200">{t.topic_tag}</span>
                        <span className="stat-num text-slate-300">{t.pct.toFixed(0)}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-aurora-pink to-aurora-violet"
                          style={{ width: `${Math.max(4, t.pct)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{course?.title}</p>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              to="/student/mastery"
              className="mt-4 inline-flex items-center gap-1 text-xs text-aurora-blue hover:underline"
            >
              Xem hồ sơ năng lực đầy đủ <ArrowRight className="h-3 w-3" />
            </Link>
          </GlassPanel>

          {decliningCourses.length ? (
            <GlassPanel>
              <SectionTitle title="Cần chú ý" icon={<AlertTriangle className="h-4 w-4" />} />
              <ul className="space-y-2 text-sm text-slate-300">
                {decliningCourses.map((c) => (
                  <li key={c.course.id}>
                    <span className="text-slate-100">{c.course.title}</span> — điểm giảm{" "}
                    <span className="stat-num">{Math.abs(c.trend).toFixed(2)}</span> so với giai đoạn đầu.
                  </li>
                ))}
              </ul>
            </GlassPanel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
