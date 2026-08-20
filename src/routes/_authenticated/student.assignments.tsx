import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, CircleAlert, ClipboardList } from "lucide-react";
import { GlassPanel, Loading, SectionTitle, StatCard } from "@/components/app/glass";
import { localDb } from "@/lib/local-client";
import { useMyCourses } from "@/lib/queries";
import { useProfile } from "@/lib/session";
import { deadlineClass, deadlineInfo } from "@/lib/deadline";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/student/assignments")({
  head: () => ({
    meta: [
      { title: "Bài tập & hạn nộp · EduSense" },
      {
        name: "description",
        content:
          "Tất cả bài tập của mọi khóa học, trạng thái nộp bài, điểm số và nhận xét của giáo viên.",
      },
      { property: "og:title", content: "Bài tập & hạn nộp · EduSense" },
      { property: "og:description", content: "Theo dõi deadline, trạng thái nộp bài và điểm số." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentAssignments,
});

type Assignment = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
};
type Submission = {
  id: string;
  assignment_id: string;
  grade: number | null;
  feedback: string | null;
  submitted_at: string;
};

function fmt(d: string | null) {
  if (!d) return "Không giới hạn";
  return new Date(d).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function StudentAssignments() {
  const { data: profile } = useProfile();
  const { data: courses = [] } = useMyCourses();
  const courseIds = useMemo(() => courses.map((c) => c.id), [courses]);

  const { data, isLoading } = useQuery({
    queryKey: ["student-assignments", courseIds, profile?.id],
    enabled: courseIds.length > 0 && Boolean(profile?.id),
    queryFn: async () => {
      const [assignments, submissions] = await Promise.all([
        localDb
          .from("assignments")
          .select("id,course_id,title,description,due_date")
          .in("course_id", courseIds)
          .order("due_date"),
        localDb
          .from("submissions")
          .select("id,assignment_id,grade,feedback,submitted_at")
          .eq("student_id", profile!.id),
      ]);
      return {
        assignments: (assignments.data ?? []) as Assignment[],
        submissions: (submissions.data ?? []) as Submission[],
      };
    },
  });

  if (isLoading || !data) return <Loading />;

  const byAssignment = new Map(data.submissions.map((s) => [s.assignment_id, s]));
  const courseName = new Map(courses.map((c) => [c.id, c.title]));
  const now = Date.now();

  const rows = data.assignments.map((a) => {
    const sub = byAssignment.get(a.id) ?? null;
    const overdue = !sub && a.due_date ? new Date(a.due_date).getTime() < now : false;
    return { a, sub, overdue };
  });

  const submitted = rows.filter((r) => r.sub).length;
  const graded = rows.filter((r) => r.sub?.grade != null);
  const avg = graded.length
    ? (graded.reduce((s, r) => s + Number(r.sub!.grade), 0) / graded.length).toFixed(1)
    : "—";

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Bài tập & hạn nộp"
        subtitle="Tổng hợp bài tập của tất cả khóa học"
        icon={<ClipboardList className="h-5 w-5" />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Tổng bài tập" value={rows.length} />
        <StatCard label="Đã nộp" value={`${submitted}/${rows.length}`} tone="success" />
        <StatCard label="Điểm trung bình" value={avg} hint={`${graded.length} bài đã chấm`} />
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <GlassPanel>
            <p className="text-sm text-slate-400">Chưa có bài tập nào.</p>
          </GlassPanel>
        ) : (
          rows.map(({ a, sub, overdue }) => (
            <GlassPanel key={a.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">{courseName.get(a.course_id)}</p>
                  <h3 className="font-medium text-slate-100">{a.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-400">{a.description}</p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-400">
                    <CalendarClock className="h-3.5 w-3.5" /> Hạn nộp: {fmt(a.due_date)}
                  </p>
                  {(() => {
                    const dl = deadlineInfo(a.due_date, Boolean(sub));
                    return dl.tone === "none" ? null : (
                      <span
                        className={`ml-2 inline-block rounded-full border px-2.5 py-0.5 text-[11px] ${deadlineClass[dl.tone]}`}
                      >
                        {dl.label}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {sub ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--success)]/40 bg-[color:var(--success)]/15 px-3 py-1 text-xs text-[color:var(--success)]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Đã nộp
                    </span>
                  ) : (
                    <span
                      className={
                        overdue
                          ? "inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/15 px-3 py-1 text-xs text-destructive"
                          : "inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300"
                      }
                    >
                      <CircleAlert className="h-3.5 w-3.5" /> {overdue ? "Quá hạn" : "Chưa nộp"}
                    </span>
                  )}
                  {sub?.grade != null ? (
                    <span className="stat-num text-lg font-semibold text-slate-100">
                      {sub.grade}/10
                    </span>
                  ) : null}
                  <Button asChild variant="outline" size="sm">
                    <Link to="/student/courses/$courseId" params={{ courseId: a.course_id }}>
                      {sub ? "Xem lại" : "Nộp bài"}
                    </Link>
                  </Button>
                </div>
              </div>
              {sub?.feedback ? (
                <p className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
                  Nhận xét: {sub.feedback}
                </p>
              ) : null}
            </GlassPanel>
          ))
        )}
      </div>
    </div>
  );
}
