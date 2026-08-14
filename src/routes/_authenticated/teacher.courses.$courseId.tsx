import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, ClipboardList, FileCheck2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel, Loading, SectionTitle } from "@/components/app/glass";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/teacher/courses/$courseId")({
  head: () => ({
    meta: [
      { title: "Nội dung khóa học · EduSense" },
      { name: "description", content: "Quản lý bài học, bài tập, ngân hàng câu hỏi và chấm điểm sinh viên." },
      { property: "og:title", content: "Nội dung khóa học · EduSense" },
      { property: "og:description", content: "Soạn nội dung và chấm bài trong một màn hình." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManageCourse,
});

const inputCls =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-aurora-blue/60";

function ManageCourse() {
  const { courseId } = Route.useParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"lessons" | "assignments" | "quizzes" | "students">("lessons");
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["manage-course", courseId] });

  const { data, isLoading } = useQuery({
    queryKey: ["manage-course", courseId],
    queryFn: async () => {
      const [course, lessons, assignments, quizzes, enrollments, submissions] = await Promise.all([
        supabase.from("courses").select("id,title,description").eq("id", courseId).maybeSingle(),
        supabase.from("lessons").select("id,title,content,order").eq("course_id", courseId).order("order"),
        supabase.from("assignments").select("id,title,description,due_date").eq("course_id", courseId),
        supabase.from("quizzes").select("id,title").eq("course_id", courseId).order("created_at"),
        supabase.from("enrollments").select("student_id,student:profiles(id,name)").eq("course_id", courseId),
        supabase.from("submissions").select("id,assignment_id,student_id,content,grade,feedback"),
      ]);
      const quizIds = (quizzes.data ?? []).map((q) => q.id);
      const questions = quizIds.length
        ? await supabase.from("questions").select("id,quiz_id,text,topic_tag").in("quiz_id", quizIds)
        : { data: [] };
      return {
        course: course.data,
        lessons: lessons.data ?? [],
        assignments: assignments.data ?? [],
        quizzes: quizzes.data ?? [],
        questions: (questions.data ?? []) as { id: string; quiz_id: string; text: string; topic_tag: string }[],
        enrollments: (enrollments.data ?? []) as unknown as {
          student_id: string;
          student: { id: string; name: string } | null;
        }[],
        submissions: (submissions.data ?? []) as {
          id: string;
          assignment_id: string;
          student_id: string;
          content: string | null;
          grade: number | null;
          feedback: string | null;
        }[],
      };
    },
  });

  if (isLoading || !data) return <Loading />;

  const tabs = [
    { id: "lessons", label: "Bài học", icon: BookOpen },
    { id: "assignments", label: "Bài tập & chấm điểm", icon: FileCheck2 },
    { id: "quizzes", label: "Quiz", icon: ClipboardList },
    { id: "students", label: "Sinh viên", icon: Users },
  ] as const;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">{data.course?.title}</h1>
        <p className="text-sm text-slate-400">{data.course?.description}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
              tab === t.id
                ? "border-aurora-blue/50 bg-aurora-blue/20 text-slate-100"
                : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10",
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "lessons" ? <LessonsTab courseId={courseId} lessons={data.lessons} onChange={invalidate} /> : null}
      {tab === "assignments" ? (
        <AssignmentsTab
          courseId={courseId}
          assignments={data.assignments}
          submissions={data.submissions}
          students={data.enrollments}
          onChange={invalidate}
        />
      ) : null}
      {tab === "quizzes" ? (
        <QuizzesTab courseId={courseId} quizzes={data.quizzes} questions={data.questions} onChange={invalidate} />
      ) : null}
      {tab === "students" ? <StudentsTab students={data.enrollments} /> : null}
    </div>
  );
}

function LessonsTab({
  courseId,
  lessons,
  onChange,
}: {
  courseId: string;
  lessons: { id: string; title: string; content: string | null; order: number }[];
  onChange: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  async function add() {
    if (!title.trim()) { toast.error("Nhập tiêu đề bài học"); return; }
    const { error } = await supabase.from("lessons").insert({
      course_id: courseId,
      title: title.trim(),
      content: content.trim() || null,
      order: lessons.length + 1,
    });
    if (error) { toast.error(error.message); return; }
    setTitle("");
    setContent("");
    onChange();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
      <GlassPanel>
        <SectionTitle title="Thêm bài học" icon={<Plus className="h-4 w-4" />} />
        <div className="space-y-3">
          <input className={inputCls} placeholder="Tiêu đề" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            rows={5}
            className={inputCls}
            placeholder="Nội dung bài giảng"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <button
            onClick={add}
            className="rounded-xl bg-gradient-to-r from-aurora-blue to-aurora-violet px-5 py-2 text-sm font-semibold text-slate-50"
          >
            Thêm
          </button>
        </div>
      </GlassPanel>

      <GlassPanel>
        <SectionTitle title={`Danh sách bài học (${lessons.length})`} />
        <ul className="space-y-2">
          {lessons.map((l) => (
            <li
              key={l.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
            >
              <div>
                <p className="text-sm text-slate-100">{l.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-400">{l.content}</p>
              </div>
              <button
                onClick={async () => {
                  await supabase.from("lessons").delete().eq("id", l.id);
                  onChange();
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-destructive/20 hover:text-destructive"
                aria-label="Xóa"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </GlassPanel>
    </div>
  );
}

function AssignmentsTab({
  courseId,
  assignments,
  submissions,
  students,
  onChange,
}: {
  courseId: string;
  assignments: { id: string; title: string; description: string | null; due_date: string | null }[];
  submissions: { id: string; assignment_id: string; student_id: string; content: string | null; grade: number | null; feedback: string | null }[];
  students: { student_id: string; student: { id: string; name: string } | null }[];
  onChange: () => void;
}) {
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<string | null>(assignments[0]?.id ?? null);

  async function add() {
    if (!title.trim()) { toast.error("Nhập tên bài tập"); return; }
    const { error } = await supabase.from("assignments").insert({ course_id: courseId, title: title.trim() });
    if (error) { toast.error(error.message); return; }
    setTitle("");
    onChange();
  }

  async function grade(id: string, value: string, feedback: string) {
    const { error } = await supabase
      .from("submissions")
      .update({ grade: value === "" ? null : Number(value), feedback: feedback || null })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Đã lưu điểm");
    onChange();
  }

  const list = submissions.filter((s) => s.assignment_id === selected);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
      <GlassPanel>
        <SectionTitle title="Bài tập" icon={<Plus className="h-4 w-4" />} />
        <div className="flex gap-2">
          <input className={inputCls} placeholder="Tên bài tập" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button onClick={add} className="rounded-xl bg-white/10 px-4 text-sm text-slate-100">
            Thêm
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {assignments.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => setSelected(a.id)}
                className={cn(
                  "w-full rounded-xl border px-3 py-2 text-left text-sm",
                  selected === a.id
                    ? "border-aurora-blue/50 bg-aurora-blue/15 text-slate-100"
                    : "border-white/10 bg-white/[0.03] text-slate-300",
                )}
              >
                {a.title}
              </button>
            </li>
          ))}
        </ul>
      </GlassPanel>

      <GlassPanel>
        <SectionTitle title="Bài nộp" subtitle={`${list.length} bài`} />
        <div className="space-y-3">
          {list.map((s) => (
            <GradeRow
              key={s.id}
              name={students.find((st) => st.student_id === s.student_id)?.student?.name ?? "Sinh viên"}
              submission={s}
              onSave={grade}
            />
          ))}
          {list.length === 0 ? <p className="text-sm text-slate-400">Chưa có bài nộp.</p> : null}
        </div>
      </GlassPanel>
    </div>
  );
}

function GradeRow({
  name,
  submission,
  onSave,
}: {
  name: string;
  submission: { id: string; content: string | null; grade: number | null; feedback: string | null };
  onSave: (id: string, grade: string, feedback: string) => void;
}) {
  const [grade, setGrade] = useState(submission.grade?.toString() ?? "");
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-100">{name}</p>
        <span className="stat-num text-sm text-slate-300">{submission.grade ?? "—"}</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">{submission.content}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          className={cn(inputCls, "w-24")}
          placeholder="Điểm"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
        />
        <input
          className={cn(inputCls, "flex-1")}
          placeholder="Nhận xét"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <button
          onClick={() => onSave(submission.id, grade, feedback)}
          className="rounded-xl bg-gradient-to-r from-aurora-blue to-aurora-violet px-4 py-2 text-xs font-semibold text-slate-50"
        >
          Lưu
        </button>
      </div>
    </div>
  );
}

function QuizzesTab({
  courseId,
  quizzes,
  questions,
  onChange,
}: {
  courseId: string;
  quizzes: { id: string; title: string }[];
  questions: { id: string; quiz_id: string; text: string; topic_tag: string }[];
  onChange: () => void;
}) {
  const [quizTitle, setQuizTitle] = useState("");
  const [selected, setSelected] = useState<string | null>(quizzes[0]?.id ?? null);
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [correct, setCorrect] = useState("A");
  const [options, setOptions] = useState({ A: "", B: "", C: "", D: "" });

  const topicOptions = [...new Set(questions.map((q) => q.topic_tag))];

  async function addQuiz() {
    if (!quizTitle.trim()) { toast.error("Nhập tên quiz"); return; }
    const { data, error } = await supabase
      .from("quizzes")
      .insert({ course_id: courseId, title: quizTitle.trim() })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return; }
    setQuizTitle("");
    setSelected(data.id);
    onChange();
  }

  async function addQuestion() {
    if (!selected) { toast.error("Chọn một quiz"); return; }
    if (!text.trim() || !topic.trim()) { toast.error("Câu hỏi và chủ đề (topic tag) là bắt buộc"); return; }
    const { error } = await supabase.from("questions").insert({
      quiz_id: selected,
      text: text.trim(),
      topic_tag: topic.trim(),
      correct_answer: correct,
      options: (["A", "B", "C", "D"] as const).map((k) => ({ key: k, text: options[k] || `Phương án ${k}` })),
    });
    if (error) { toast.error(error.message); return; }
    setText("");
    setOptions({ A: "", B: "", C: "", D: "" });
    toast.success("Đã thêm câu hỏi");
    onChange();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <GlassPanel>
        <SectionTitle title="Bài kiểm tra" icon={<Plus className="h-4 w-4" />} />
        <div className="flex gap-2">
          <input className={inputCls} placeholder="Tên quiz" value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} />
          <button onClick={addQuiz} className="rounded-xl bg-white/10 px-4 text-sm text-slate-100">
            Thêm
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {quizzes.map((q) => (
            <li key={q.id}>
              <button
                onClick={() => setSelected(q.id)}
                className={cn(
                  "w-full rounded-xl border px-3 py-2 text-left text-sm",
                  selected === q.id
                    ? "border-aurora-blue/50 bg-aurora-blue/15 text-slate-100"
                    : "border-white/10 bg-white/[0.03] text-slate-300",
                )}
              >
                {q.title}
                <span className="ml-2 text-xs text-slate-500">
                  {questions.filter((x) => x.quiz_id === q.id).length} câu
                </span>
              </button>
            </li>
          ))}
        </ul>
      </GlassPanel>

      <GlassPanel>
        <SectionTitle title="Thêm câu hỏi" subtitle="Mỗi câu hỏi bắt buộc gắn chủ đề (topic tag)" />
        <div className="space-y-3">
          <textarea
            rows={2}
            className={inputCls}
            placeholder="Nội dung câu hỏi"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className={inputCls}
              placeholder="Chủ đề (topic tag)"
              list="topic-list"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <datalist id="topic-list">
              {topicOptions.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <select className={inputCls} value={correct} onChange={(e) => setCorrect(e.target.value)}>
              {["A", "B", "C", "D"].map((k) => (
                <option key={k} value={k} className="bg-slate-900">
                  Đáp án đúng: {k}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["A", "B", "C", "D"] as const).map((k) => (
              <input
                key={k}
                className={inputCls}
                placeholder={`Phương án ${k}`}
                value={options[k]}
                onChange={(e) => setOptions({ ...options, [k]: e.target.value })}
              />
            ))}
          </div>
          <button
            onClick={addQuestion}
            className="rounded-xl bg-gradient-to-r from-aurora-blue to-aurora-violet px-5 py-2 text-sm font-semibold text-slate-50"
          >
            Thêm câu hỏi
          </button>
        </div>

        <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
          {questions
            .filter((q) => q.quiz_id === selected)
            .map((q) => (
              <li key={q.id} className="flex items-start justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                <p className="text-xs text-slate-300">
                  {q.text}
                  <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">{q.topic_tag}</span>
                </p>
                <button
                  onClick={async () => {
                    await supabase.from("questions").delete().eq("id", q.id);
                    onChange();
                  }}
                  className="rounded-lg p-1 text-slate-400 hover:text-destructive"
                  aria-label="Xóa"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
        </ul>
      </GlassPanel>
    </div>
  );
}

function StudentsTab({ students }: { students: { student_id: string; student: { id: string; name: string } | null }[] }) {
  return (
    <GlassPanel>
      <SectionTitle title={`Sinh viên trong lớp (${students.length})`} icon={<Users className="h-4 w-4" />} />
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {students.map((s) => (
          <li key={s.student_id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200">
            {s.student?.name ?? "Sinh viên"}
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
