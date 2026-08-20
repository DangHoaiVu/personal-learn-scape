import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, GraduationCap } from "lucide-react";
import { GlassPanel, Loading, SectionTitle } from "@/components/app/glass";
import { localDb } from "@/lib/local-client";
import { useAttempts, useMyCourses } from "@/lib/queries";
import { useProfile } from "@/lib/session";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/student/courses/")({
  head: () => ({
    meta: [
      { title: "Khóa học của tôi · EduSense" },
      {
        name: "description",
        content: "Danh sách khóa học đang theo học, tiến độ bài giảng và điểm trung bình từng môn.",
      },
      { property: "og:title", content: "Khóa học của tôi · EduSense" },
      {
        property: "og:description",
        content: "Tiến độ bài giảng và điểm trung bình theo từng khóa học.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentCourses,
});

function StudentCourses() {
  const { data: profile } = useProfile();
  const { data: courses = [], isLoading } = useMyCourses();
  const courseIds = useMemo(() => courses.map((c) => c.id), [courses]);
  const { data: attempts = [] } = useAttempts(courseIds);

  const { data: counts } = useQuery({
    queryKey: ["student-course-counts", courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const [lessons, quizzes, assignments] = await Promise.all([
        localDb.from("lessons").select("id,course_id").in("course_id", courseIds),
        localDb.from("quizzes").select("id,course_id").in("course_id", courseIds),
        localDb.from("assignments").select("id,course_id").in("course_id", courseIds),
      ]);
      return {
        lessons: (lessons.data ?? []) as { id: string; course_id: string }[],
        quizzes: (quizzes.data ?? []) as { id: string; course_id: string }[],
        assignments: (assignments.data ?? []) as { id: string; course_id: string }[],
      };
    },
  });

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Khóa học của tôi"
        subtitle={`${courses.length} khóa đang theo học`}
        icon={<GraduationCap className="h-5 w-5" />}
      />

      {courses.length === 0 ? (
        <GlassPanel>
          <p className="text-sm text-slate-400">Bạn chưa ghi danh khóa học nào.</p>
        </GlassPanel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map((course) => {
            const mine = attempts.filter(
              (a) => a.student_id === profile?.id && a.quiz?.course_id === course.id,
            );
            const avg = mine.length
              ? (mine.reduce((s, a) => s + Number(a.score), 0) / mine.length).toFixed(1)
              : "—";
            const done = mine.length;
            const totalQuizzes =
              counts?.quizzes.filter((q) => q.course_id === course.id).length ?? 0;
            const pct = totalQuizzes ? Math.round((done / totalQuizzes) * 100) : 0;
            return (
              <GlassPanel key={course.id} className="flex flex-col">
                <div className="flex items-start gap-3">
                  <span className="rounded-xl border border-white/15 bg-white/10 p-2 text-slate-200">
                    <BookOpen className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-100">{course.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-400">{course.description}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <Metric label="Điểm TB" value={avg} />
                  <Metric
                    label="Bài giảng"
                    value={String(
                      counts?.lessons.filter((l) => l.course_id === course.id).length ?? 0,
                    )}
                  />
                  <Metric
                    label="Bài tập"
                    value={String(
                      counts?.assignments.filter((a) => a.course_id === course.id).length ?? 0,
                    )}
                  />
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Tiến độ kiểm tra</span>
                    <span>
                      {done}/{totalQuizzes}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-aurora-blue to-aurora-violet"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <Button asChild variant="outline" className="mt-4 self-start">
                  <Link to="/student/courses/$courseId" params={{ courseId: course.id }}>
                    Vào học <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </GlassPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-2">
      <p className="stat-num text-lg font-semibold text-slate-100">{value}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  );
}
