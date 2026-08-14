import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, ClipboardList, FileCheck2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel, Loading, SectionTitle } from "@/components/app/glass";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/student/courses/$courseId")({
  head: () => ({
    meta: [
      { title: "Nội dung khóa học · EduSense" },
      { name: "description", content: "Bài giảng, bài tập và bài kiểm tra của khóa học." },
      { property: "og:title", content: "Nội dung khóa học · EduSense" },
      { property: "og:description", content: "Học bài, nộp bài tập và làm quiz." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoursePage,
});

function CoursePage() {
  const { courseId } = Route.useParams();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["course-detail", courseId],
    queryFn: async () => {
      const [course, lessons, assignments, quizzes, submissions] = await Promise.all([
        supabase.from("courses").select("id,title,description").eq("id", courseId).maybeSingle(),
        supabase.from("lessons").select("id,title,content,order").eq("course_id", courseId).order("order"),
        supabase.from("assignments").select("id,title,description,due_date").eq("course_id", courseId),
        supabase.from("quizzes").select("id,title,created_at").eq("course_id", courseId).order("created_at"),
        supabase.from("submissions").select("id,assignment_id,grade,feedback,submitted_at"),
      ]);
      return {
        course: course.data,
        lessons: lessons.data ?? [],
        assignments: assignments.data ?? [],
        quizzes: quizzes.data ?? [],
        submissions: submissions.data ?? [],
      };
    },
  });

  async function openLessonAndLog(id: string) {
    setOpenLesson(openLesson === id ? null : id);
    if (profile) {
      await supabase.from("activity_logs").insert({
        student_id: profile.id,
        course_id: courseId,
        action: "view_lesson",
        timestamp: new Date().toISOString(),
      });
    }
  }

  async function submitAssignment(assignmentId: string) {
    if (!profile) return;
    const content = draft[assignmentId]?.trim();
    if (!content) { toast.error("Hãy nhập nội dung bài làm"); return; }
    const { error } = await supabase
      .from("submissions")
      .upsert(
        { assignment_id: assignmentId, student_id: profile.id, content, submitted_at: new Date().toISOString() },
        { onConflict: "assignment_id,student_id" },
      );
    if (error) { toast.error(error.message); return; }
    await supabase.from("activity_logs").insert({
      student_id: profile.id,
      course_id: courseId,
      action: "submit_assignment",
      timestamp: new Date().toISOString(),
    });
    toast.success("Đã nộp bài");
    queryClient.invalidateQueries({ queryKey: ["course-detail", courseId] });
  }

  if (isLoading || !data) return <Loading />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">{data.course?.title}</h1>
        <p className="text-sm text-slate-400">{data.course?.description}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassPanel className="lg:col-span-2">
          <SectionTitle title="Bài học" icon={<BookOpen className="h-4 w-4" />} />
          <ul className="space-y-2">
            {data.lessons.map((l) => (
              <li key={l.id} className="rounded-2xl border border-white/10 bg-white/[0.03]">
                <button
                  onClick={() => openLessonAndLog(l.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-slate-200"
                >
                  <span>{l.title}</span>
                  <PlayCircle className="h-4 w-4 text-aurora-blue" />
                </button>
                {openLesson === l.id ? (
                  <p className="border-t border-white/10 px-4 py-3 text-sm leading-relaxed text-slate-300">
                    {l.content}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </GlassPanel>

        <div className="space-y-4">
          <GlassPanel>
            <SectionTitle title="Bài kiểm tra" icon={<ClipboardList className="h-4 w-4" />} />
            <ul className="space-y-2">
              {data.quizzes.map((q) => (
                <li key={q.id}>
                  <Link
                    to="/student/quiz/$quizId"
                    params={{ quizId: q.id }}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10"
                  >
                    {q.title}
                    <span className="text-xs text-aurora-blue">Làm bài</span>
                  </Link>
                </li>
              ))}
            </ul>
          </GlassPanel>

          <GlassPanel>
            <SectionTitle title="Bài tập" icon={<FileCheck2 className="h-4 w-4" />} />
            <ul className="space-y-4">
              {data.assignments.map((a) => {
                const sub = data.submissions.find((s) => s.assignment_id === a.id);
                return (
                  <li key={a.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-sm font-medium text-slate-100">{a.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{a.description}</p>
                    {sub ? (
                      <p className="mt-2 text-xs text-slate-300">
                        Đã nộp · Điểm:{" "}
                        <span className="stat-num text-slate-100">
                          {sub.grade != null ? sub.grade : "chờ chấm"}
                        </span>
                        {sub.feedback ? <span className="block text-slate-400">{sub.feedback}</span> : null}
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <textarea
                          rows={2}
                          value={draft[a.id] ?? ""}
                          onChange={(e) => setDraft({ ...draft, [a.id]: e.target.value })}
                          placeholder="Nội dung bài làm / link sản phẩm"
                          className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-100 outline-none focus:border-aurora-blue/60"
                        />
                        <button
                          onClick={() => submitAssignment(a.id)}
                          className="rounded-full bg-gradient-to-r from-aurora-blue to-aurora-violet px-4 py-1.5 text-xs font-medium text-slate-50"
                        >
                          Nộp bài
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
