import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel, LiquidPanel, Loading } from "@/components/app/glass";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/student/quiz/$quizId")({
  head: () => ({
    meta: [
      { title: "Làm bài kiểm tra · EduSense" },
      { name: "description", content: "Làm bài quiz và nhận kết quả phân tích theo chủ đề ngay lập tức." },
      { property: "og:title", content: "Làm bài kiểm tra · EduSense" },
      { property: "og:description", content: "Mỗi câu hỏi gắn chủ đề để cập nhật hồ sơ năng lực." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuizPage,
});

type Question = { id: string; text: string; topic_tag: string; options: { key: string; text: string }[]; correct_answer: string };

function QuizPage() {
  const { quizId } = Route.useParams();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; total: number; correct: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: async () => {
      const [quiz, questions] = await Promise.all([
        supabase.from("quizzes").select("id,title,course_id").eq("id", quizId).maybeSingle(),
        supabase.from("questions").select("id,text,topic_tag,options,correct_answer").eq("quiz_id", quizId),
      ]);
      return { quiz: quiz.data, questions: (questions.data ?? []) as unknown as Question[] };
    },
  });

  async function submit() {
    if (!profile || !data?.quiz) return;
    const questions = data.questions;
    if (Object.keys(answers).length < questions.length) {
      toast.error("Hãy trả lời tất cả câu hỏi");
      return;
    }
    setSaving(true);
    const correct = questions.filter((q) => answers[q.id] === q.correct_answer).length;
    const score = Math.round((correct * 10) / questions.length * 100) / 100;
    const { data: attempt, error } = await supabase
      .from("quiz_attempts")
      .insert({ quiz_id: quizId, student_id: profile.id, score })
      .select("id")
      .single();
    if (error || !attempt) {
      setSaving(false);
      return toast.error(error?.message ?? "Không lưu được kết quả");
    }
    await supabase.from("question_attempts").insert(
      questions.map((q) => ({
        quiz_attempt_id: attempt.id,
        question_id: q.id,
        is_correct: answers[q.id] === q.correct_answer,
      })),
    );
    await supabase.from("activity_logs").insert({
      student_id: profile.id,
      course_id: data.quiz.course_id,
      action: "take_quiz",
      timestamp: new Date().toISOString(),
    });
    setResult({ score, total: questions.length, correct });
    setSaving(false);
  }

  if (isLoading || !data) return <Loading />;

  if (result) {
    return (
      <div className="mx-auto max-w-xl">
        <LiquidPanel className="p-8 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-[color:var(--success)]" />
          <h1 className="mt-4 text-xl font-semibold text-slate-100">Hoàn thành bài kiểm tra</h1>
          <p className="stat-num mt-3 text-5xl font-semibold text-slate-100">{result.score}</p>
          <p className="mt-2 text-sm text-slate-400">
            Đúng {result.correct}/{result.total} câu. Hồ sơ năng lực đã được cập nhật.
          </p>
          <button
            onClick={() => navigate({ to: "/student/mastery" })}
            className="mt-6 rounded-full bg-gradient-to-r from-aurora-blue to-aurora-violet px-6 py-2.5 text-sm font-semibold text-slate-50"
          >
            Xem hồ sơ năng lực
          </button>
        </LiquidPanel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-slate-100">{data.quiz?.title}</h1>
      {data.questions.map((q, i) => (
        <GlassPanel key={q.id}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <p className="text-sm text-slate-100">
              <span className="stat-num mr-2 text-slate-400">{i + 1}.</span>
              {q.text}
            </p>
            <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs text-slate-300">
              {q.topic_tag}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {q.options.map((o) => (
              <button
                key={o.key}
                onClick={() => setAnswers({ ...answers, [q.id]: o.key })}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                  answers[q.id] === o.key
                    ? "border-aurora-blue/60 bg-aurora-blue/20 text-slate-100"
                    : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <span className="stat-num mr-2 text-slate-400">{o.key}</span>
                {o.text}
              </button>
            ))}
          </div>
        </GlassPanel>
      ))}
      <button
        onClick={submit}
        disabled={saving}
        className="w-full rounded-2xl bg-gradient-to-r from-aurora-blue to-aurora-violet px-6 py-3 text-sm font-semibold text-slate-50 disabled:opacity-60"
      >
        {saving ? "Đang chấm…" : "Nộp bài"}
      </button>
    </div>
  );
}
