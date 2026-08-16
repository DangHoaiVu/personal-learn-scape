import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { LiquidPanel } from "@/components/app/glass";
import { supabase } from "@/integrations/supabase/client";
import { useAttempts, useRiskAlerts, useTeachingCourses } from "@/lib/queries";
import { teacherTutorReply } from "@/lib/ai/mockTutorResponse";

export const Route = createFileRoute("/_authenticated/teacher/tutor")({
  head: () => ({
    meta: [
      { title: "Trợ lý lớp học · EduSense" },
      { name: "description", content: "Hỏi đáp nhanh về tình hình lớp: chủ đề yếu, sinh viên nguy cơ, xu hướng điểm." },
      { property: "og:title", content: "Trợ lý lớp học · EduSense" },
      { property: "og:description", content: "Tóm tắt sức khỏe lớp học từ dữ liệu năng lực và cảnh báo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeacherTutor,
});

type Msg = { id: string; role: "user" | "ai"; content: string };

function TeacherTutor() {
  const { data: courses = [] } = useTeachingCourses();
  const courseIds = useMemo(() => courses.map((c) => c.id), [courses]);
  const { data: attempts = [] } = useAttempts(courseIds);
  const { data: alerts = [] } = useRiskAlerts();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: mastery = [] } = useQuery({
    queryKey: ["class-mastery", courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topic_mastery")
        .select("course_id,topic_tag,mastery_pct")
        .in("course_id", courseIds);
      if (error) throw error;
      const map = new Map<string, { course_id: string; topic_tag: string; sum: number; n: number }>();
      for (const r of (data ?? []) as { course_id: string; topic_tag: string; mastery_pct: number }[]) {
        const key = `${r.course_id}::${r.topic_tag}`;
        const cur = map.get(key) ?? { course_id: r.course_id, topic_tag: r.topic_tag, sum: 0, n: 0 };
        cur.sum += Number(r.mastery_pct);
        cur.n += 1;
        map.set(key, cur);
      }
      return [...map.values()].map((v) => ({ course_id: v.course_id, topic_tag: v.topic_tag, mastery: v.sum / v.n }));
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    setSending(true);
    setMessages((m) => [...m, { id: `${Date.now()}-u`, role: "user", content: text }]);
    const avg = attempts.length ? attempts.reduce((s, a) => s + Number(a.score), 0) / attempts.length : null;
    const reply = await teacherTutorReply({
      question: text,
      courses,
      topics: mastery,
      alerts: alerts.map((a) => ({
        student: a.student?.name ?? "Sinh viên",
        reason: a.reason,
        level: a.level,
        course_id: a.course_id,
      })),
      averageScore: avg,
      studentCount: new Set(attempts.map((a) => a.student_id)).size,
    });
    setMessages((m) => [...m, { id: `${Date.now()}-a`, role: "ai", content: reply }]);
    setSending(false);
  }

  const suggestions = [
    "Lớp đang yếu chủ đề nào nhất?",
    "Sinh viên nào đang có nguy cơ?",
    "Điểm trung bình lớp thế nào?",
    "Câu hỏi nào đang quá khó?",
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Trợ lý lớp học</h1>
        <p className="text-sm text-slate-400">
          Trả lời dựa trên hồ sơ năng lực và cảnh báo đã tính sẵn trong hệ thống.
        </p>
      </div>

      <LiquidPanel className="flex h-[62vh] flex-col p-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <Sparkles className="h-7 w-7 text-aurora-violet" />
              <p className="text-sm text-slate-400">Hỏi nhanh về tình hình lớp học của bạn.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                {m.role !== "user" ? (
                  <span className="mt-1 h-7 w-7 shrink-0 rounded-full border border-white/15 bg-white/10 p-1.5 text-aurora-blue">
                    <Bot className="h-full w-full" />
                  </span>
                ) : null}
                <div
                  className={`max-w-[78%] whitespace-pre-line rounded-2xl border px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "border-aurora-blue/30 bg-aurora-blue/20 text-slate-100"
                      : "border-white/15 bg-white/[0.06] text-slate-200"
                  }`}
                >
                  {m.content}
                </div>
                {m.role === "user" ? (
                  <span className="mt-1 h-7 w-7 shrink-0 rounded-full border border-white/15 bg-white/10 p-1.5 text-slate-300">
                    <User className="h-full w-full" />
                  </span>
                ) : null}
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>
        <form onSubmit={send} className="flex items-center gap-2 border-t border-white/10 p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Hỏi về lớp học…"
            className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-aurora-blue/60"
          />
          <button
            type="submit"
            disabled={sending}
            className="rounded-full bg-gradient-to-r from-aurora-blue to-aurora-violet p-2.5 text-slate-50 disabled:opacity-60"
            aria-label="Gửi"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </LiquidPanel>
    </div>
  );
}