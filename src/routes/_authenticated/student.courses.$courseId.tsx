import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, ClipboardList, FileCheck2, History, Paperclip, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel, Loading, SectionTitle } from "@/components/app/glass";
import { localDb } from "@/lib/local-client";
import { useProfile } from "@/lib/session";
import { LiquidButton } from "@/components/app/liquid";
import { deadlineClass, deadlineInfo } from "@/lib/deadline";

const ACCEPTED = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp";
const MAX_SIZE = 10 * 1024 * 1024;

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
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["course-detail", courseId],
    queryFn: async () => {
      const [course, lessons, assignments, quizzes, submissions, attempts] = await Promise.all([
        localDb.from("courses").select("id,title,description").eq("id", courseId).maybeSingle(),
        localDb
          .from("lessons")
          .select("id,title,content,order")
          .eq("course_id", courseId)
          .order("order"),
        localDb
          .from("assignments")
          .select("id,title,description,due_date")
          .eq("course_id", courseId),
        localDb
          .from("quizzes")
          .select("id,title,created_at")
          .eq("course_id", courseId)
          .eq("visible", true)
          .order("created_at"),
        localDb
          .from("submissions")
          .select("id,assignment_id,grade,feedback,submitted_at,file_url,content"),
        localDb
          .from("quiz_attempts")
          .select("id,quiz_id,score,attempted_at")
          .order("attempted_at", { ascending: false }),
      ]);
      return {
        course: course.data,
        lessons: (lessons.data ?? []) as {
          id: string;
          title: string;
          content: string | null;
          order: number;
        }[],
        assignments: (assignments.data ?? []) as {
          id: string;
          title: string;
          description: string | null;
          due_date: string | null;
        }[],
        quizzes: (quizzes.data ?? []) as { id: string; title: string; created_at: string }[],
        submissions: (submissions.data ?? []) as {
          id: string;
          assignment_id: string;
          grade: number | null;
          feedback: string | null;
          submitted_at: string;
          file_url: string | null;
          content: string | null;
        }[],
        attempts: (attempts.data ?? []) as {
          id: string;
          quiz_id: string;
          score: number;
          attempted_at: string;
        }[],
      };
    },
  });

  async function openLessonAndLog(id: string) {
    setOpenLesson(openLesson === id ? null : id);
    if (profile) {
      await localDb.from("activity_logs").insert({
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
    const file = files[assignmentId] ?? null;
    if (!content && !file) {
      toast.error("Hãy nhập nội dung hoặc chọn file bài làm");
      return;
    }

    let filePath: string | null = null;
    if (file) {
      if (file.size > MAX_SIZE) {
        toast.error("File tối đa 10MB");
        return;
      }
      setUploading(assignmentId);
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "dat";
      filePath = `${profile.id}/${assignmentId}-${Date.now()}.${ext}`;
      const { error: upErr } = await localDb.storage.from("submissions").upload(filePath, file);
      setUploading(null);
      if (upErr) {
        toast.error(upErr.message);
        return;
      }
    }

    const { error } = await localDb.from("submissions").upsert(
      {
        assignment_id: assignmentId,
        student_id: profile.id,
        content: content ?? (file ? `Đã nộp file: ${file.name}` : null),
        file_url: filePath,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "assignment_id,student_id" },
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    await localDb.from("activity_logs").insert({
      student_id: profile.id,
      course_id: courseId,
      action: "submit_assignment",
      timestamp: new Date().toISOString(),
    });
    toast.success("Đã nộp bài");
    setFiles({ ...files, [assignmentId]: null });
    queryClient.invalidateQueries({ queryKey: ["course-detail", courseId] });
  }

  async function openFile(path: string) {
    const { data: signed, error } = await localDb.storage
      .from("submissions")
      .createSignedUrl(path, 60);
    if (error || !signed) {
      toast.error("Không mở được file");
      return;
    }
    window.open(signed.signedUrl, "_blank", "noopener");
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
                  type="button"
                  onClick={() => openLessonAndLog(l.id)}
                  aria-expanded={openLesson === l.id}
                  className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-slate-200 transition-colors hover:bg-[var(--glass-surface-hover)] focus-visible:outline-2 focus-visible:outline-ring"
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
                <li key={q.id} className="space-y-1">
                  <Link
                    to="/student/quiz/$quizId"
                    params={{ quizId: q.id }}
                    className="liquid-clickable-card flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10"
                  >
                    {q.title}
                    <span className="text-xs text-aurora-blue">Làm bài</span>
                  </Link>
                  {data.attempts
                    .filter((a) => a.quiz_id === q.id)
                    .slice(0, 2)
                    .map((a) => (
                      <Link
                        key={a.id}
                        to="/student/attempts/$attemptId"
                        params={{ attemptId: a.id }}
                        className="ml-3 flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
                      >
                        <History className="h-3.5 w-3.5" />
                        {new Date(a.attempted_at).toLocaleDateString("vi-VN")} · điểm{" "}
                        <span className="stat-num text-slate-300">{a.score}</span> · xem lại
                      </Link>
                    ))}
                </li>
              ))}
            </ul>
          </GlassPanel>

          <GlassPanel>
            <SectionTitle title="Bài tập" icon={<FileCheck2 className="h-4 w-4" />} />
            <ul className="space-y-4">
              {data.assignments.map((a) => {
                const sub = data.submissions.find((s) => s.assignment_id === a.id);
                const dl = deadlineInfo(a.due_date, Boolean(sub));
                return (
                  <li key={a.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-100">{a.title}</p>
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] ${deadlineClass[dl.tone]}`}
                      >
                        {dl.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{a.description}</p>
                    {sub ? (
                      <p className="mt-2 text-xs text-slate-300">
                        Đã nộp · Điểm:{" "}
                        <span className="stat-num text-slate-100">
                          {sub.grade != null ? sub.grade : "chờ chấm"}
                        </span>
                        {sub.feedback ? (
                          <span className="block text-slate-400">{sub.feedback}</span>
                        ) : null}
                        {sub.file_url ? (
                          <button
                            type="button"
                            onClick={() => openFile(sub.file_url!)}
                            className="mt-1 inline-flex items-center gap-1.5 text-aurora-blue hover:underline"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            {sub.file_url.split("/").pop()}
                          </button>
                        ) : null}
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
                        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-3 py-2 text-xs text-slate-400 hover:bg-white/[0.06]">
                          <Paperclip className="h-3.5 w-3.5" />
                          <span className="truncate">
                            {files[a.id]?.name ?? "Đính kèm file (pdf, docx, ảnh — tối đa 10MB)"}
                          </span>
                          <input
                            type="file"
                            accept={ACCEPTED}
                            className="hidden"
                            onChange={(e) =>
                              setFiles({ ...files, [a.id]: e.target.files?.[0] ?? null })
                            }
                          />
                        </label>
                        <LiquidButton
                          onClick={() => submitAssignment(a.id)}
                          loading={uploading === a.id}
                          size="sm"
                        >
                          {uploading === a.id ? "Đang tải file…" : "Nộp bài"}
                        </LiquidButton>
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
