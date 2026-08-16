import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { LiquidPanel, Loading } from "@/components/app/glass";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/session";
import { useTopicStats, useMyCourses } from "@/lib/queries";
import { studentTutorReply } from "@/lib/ai/mockTutorResponse";

export const Route = createFileRoute("/_authenticated/student/tutor")({
  head: () => ({
    meta: [
      { title: "AI Tutor · EduSense" },
      { name: "description", content: "Trợ giảng AI gợi ý lộ trình ôn tập dựa trên hồ sơ năng lực của bạn." },
      { property: "og:title", content: "AI Tutor · EduSense" },
      { property: "og:description", content: "Hỏi đáp và nhận gợi ý ôn tập cá nhân hóa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TutorPage,
});

type Message = { id: string; role: string; content: string; created_at: string };

function TutorPage() {
  const { data: profile } = useProfile();
  const { data: topics = [] } = useTopicStats();
  const { data: courses = [] } = useMyCourses();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chat"],
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id,role,content,created_at")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !profile) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    await supabase.from("chat_messages").insert({ student_id: profile.id, role: "user", content: text });
    const reply = await studentTutorReply({ question: text, topics, courses });
    await supabase
      .from("chat_messages")
      .insert({ student_id: profile.id, role: "ai", content: reply });
    await queryClient.invalidateQueries({ queryKey: ["chat"] });
    setSending(false);
  }

  const suggestions = ["Mình nên ôn gì tiếp theo?", "Chủ đề nào mình đang yếu?", "Điểm của mình thế nào?"];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">AI Tutor</h1>
        <p className="text-sm text-slate-400">Trợ giảng cá nhân, đọc trực tiếp hồ sơ năng lực của bạn.</p>
      </div>

      <LiquidPanel className="flex h-[62vh] flex-col p-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {isLoading ? (
            <Loading />
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <Sparkles className="h-7 w-7 text-aurora-violet" />
              <p className="text-sm text-slate-400">Hãy bắt đầu bằng một câu hỏi.</p>
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
                  className={`max-w-[78%] rounded-2xl border px-4 py-2.5 text-sm leading-relaxed ${
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
            placeholder="Hỏi AI Tutor…"
            className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-aurora-blue/60"
          />
          <button
            type="submit"
            disabled={sending}
            className="rounded-xl bg-gradient-to-r from-aurora-blue to-aurora-violet p-2.5 text-slate-50 disabled:opacity-60"
            aria-label="Gửi"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </LiquidPanel>
    </div>
  );
}
