import { useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { Target } from "lucide-react";
import { GlassPanel, Loading, SectionTitle } from "@/components/app/glass";
import { useMyCourses, useTopicStats } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/session";
import { tooltipStyle } from "@/components/app/chart-theme";

export const Route = createFileRoute("/_authenticated/student/mastery")({
  head: () => ({
    meta: [
      { title: "Hồ sơ năng lực · EduSense" },
      { name: "description", content: "Biểu đồ radar mức độ thành thạo theo từng chủ đề trong mỗi môn học." },
      { property: "og:title", content: "Hồ sơ năng lực · EduSense" },
      { property: "og:description", content: "% thành thạo từng chủ đề tính từ toàn bộ câu hỏi đã làm." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MasteryPage,
});

function MasteryPage() {
  const { data: profile } = useProfile();
  const { data: courses = [], isLoading } = useMyCourses();
  const { data: topics = [] } = useTopicStats();

  const grouped = useMemo(() => {
    return courses.map((c) => ({
      course: c,
      rows: topics
        .filter((t) => t.course_id === c.id)
        .map((t) => ({ topic: t.topic_tag, pct: Math.round((t.correct / t.total) * 1000) / 10, total: t.total }))
        .sort((a, b) => a.pct - b.pct),
    }));
  }, [courses, topics]);

  // Lưu lại hồ sơ năng lực đã tính vào bảng topic_mastery
  useEffect(() => {
    if (!profile || topics.length === 0) return;
    const payload = topics.map((t) => ({
      student_id: profile.id,
      course_id: t.course_id,
      topic_tag: t.topic_tag,
      mastery_pct: Math.round((t.correct / t.total) * 1000) / 10,
      updated_at: new Date().toISOString(),
    }));
    void supabase.from("topic_mastery").upsert(payload, { onConflict: "student_id,course_id,topic_tag" });
  }, [profile, topics]);

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Hồ sơ năng lực</h1>
        <p className="text-sm text-slate-400">
          % thành thạo mỗi chủ đề = số câu đúng / tổng số câu đã làm thuộc chủ đề đó.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {grouped.map(({ course, rows }) => (
          <GlassPanel key={course.id}>
            <SectionTitle title={course.title} subtitle={`${rows.length} chủ đề`} icon={<Target className="h-4 w-4" />} />
            {rows.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có dữ liệu bài làm.</p>
            ) : (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={rows} outerRadius="72%">
                      <PolarGrid stroke="rgba(255,255,255,0.14)" />
                      <PolarAngleAxis dataKey="topic" tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} />
                      <Tooltip {...tooltipStyle} />
                      <Radar
                        name="Thành thạo"
                        dataKey="pct"
                        stroke="var(--color-aurora-violet)"
                        fill="var(--color-aurora-violet)"
                        fillOpacity={0.35}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-4 space-y-2.5">
                  {rows.map((r) => (
                    <li key={r.topic}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-200">{r.topic}</span>
                        <span className="stat-num text-slate-300">
                          {r.pct}% <span className="text-slate-500">({r.total} câu)</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full ${
                            r.pct < 50
                              ? "bg-gradient-to-r from-aurora-pink to-aurora-violet"
                              : "bg-gradient-to-r from-aurora-blue to-aurora-violet"
                          }`}
                          style={{ width: `${Math.max(3, r.pct)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </GlassPanel>
        ))}
      </div>
    </div>
  );
}
