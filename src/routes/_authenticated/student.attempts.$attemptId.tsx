import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, X } from "lucide-react";
import { GlassPanel, LiquidPanel, Loading } from "@/components/app/glass";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/student/attempts/$attemptId")({
  head: () => ({
    meta: [
      { title: "Xem lại bài kiểm tra · EduSense" },
      { name: "description", content: "Xem lại từng câu hỏi, đáp án bạn đã chọn và đáp án đúng của bài kiểm tra." },
      { property: "og:title", content: "Xem lại bài kiểm tra · EduSense" },
      { property: "og:description", content: "Đối chiếu đáp án để biết chính xác cần ôn lại chủ đề nào." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AttemptReview,
});

type QuestionRow = {
  id: string;
  text: string;
  topic_tag: string;
  correct_answer: string;
  options: { key: string; text: string }[];
};

function AttemptReview() {
  const { attemptId } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["attempt-review", attemptId],
    queryFn: async () => {
      const attempt = await supabase
        .from("quiz_attempts")
        .select("id,score,attempted_at,quiz:quizzes(id,title,course_id)")
        .eq("id", attemptId)
        .maybeSingle();
      const qa = await supabase
        .from("question_attempts")
        .select("question_id,is_correct,chosen_answer")
        .eq("quiz_attempt_id", attemptId);
      const ids = (qa.data ?? []).map((r) => r.question_id);
      const questions = ids.length
        ? await supabase.from("questions").select("id,text,topic_tag,options,correct_answer").in("id", ids)
        : { data: [] };
      return {
        attempt: attempt.data as unknown as {
          id: string;
          score: number;
          attempted_at: string;
          quiz: { id: string; title: string; course_id: string } | null;
        } | null,
        answers: (qa.data ?? []) as { question_id: string; is_correct: boolean; chosen_answer: string | null }[],
        questions: (questions.data ?? []) as unknown as QuestionRow[],
      };
    },
  });

  if (isLoading || !data) return <Loading />;
  if (!data.attempt) {
    return (
      <GlassPanel>
        <p className="text-sm text-slate-400">Không tìm thấy bài làm này.</p>
      </GlassPanel>
    );
  }

  const correct = data.answers.filter((a) => a.is_correct).length;
  const byId = new Map(data.questions.map((q) => [q.id, q]));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        to="/student/courses/$courseId"
        params={{ courseId: data.attempt.quiz?.course_id ?? "" }}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại khóa học
      </Link>

      <LiquidPanel className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">{data.attempt.quiz?.title}</h1>
          <p className="mt-1 text-sm text-slate-400">
            Làm ngày {new Date(data.attempt.attempted_at).toLocaleDateString("vi-VN")} · Đúng {correct}/
            {data.answers.length} câu
          </p>
        </div>
        <p className="stat-num text-4xl font-semibold text-slate-100">{data.attempt.score}</p>
      </LiquidPanel>

      {data.answers.map((a, i) => {
        const q = byId.get(a.question_id);
        if (!q) return null;
        return (
          <GlassPanel key={a.question_id}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <p className="text-sm text-slate-100">
                <span className="stat-num mr-2 text-slate-400">{i + 1}.</span>
                {q.text}
              </p>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${
                  a.is_correct
                    ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/15 text-[color:var(--success)]"
                    : "border-destructive/40 bg-destructive/15 text-destructive"
                }`}
              >
                {a.is_correct ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                {a.is_correct ? "Đúng" : "Sai"}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {q.options.map((o) => {
                const isCorrect = o.key === q.correct_answer;
                const isChosen = a.chosen_answer === o.key;
                return (
                  <div
                    key={o.key}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      isCorrect
                        ? "border-[color:var(--success)]/50 bg-[color:var(--success)]/12 text-slate-100"
                        : isChosen
                          ? "border-destructive/50 bg-destructive/12 text-slate-100"
                          : "border-white/12 bg-white/[0.03] text-slate-400"
                    }`}
                  >
                    <span className="stat-num mr-2 text-slate-400">{o.key}</span>
                    {o.text}
                    {isChosen ? <span className="ml-2 text-xs text-slate-400">(bạn chọn)</span> : null}
                    {isCorrect ? <span className="ml-2 text-xs text-[color:var(--success)]">(đáp án đúng)</span> : null}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Chủ đề: {q.topic_tag}
              {a.chosen_answer == null ? " · Bài làm cũ không lưu đáp án đã chọn" : ""}
            </p>
          </GlassPanel>
        );
      })}
    </div>
  );
}