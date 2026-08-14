import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel, LiquidPanel, Loading, SectionTitle } from "@/components/app/glass";
import { supabase } from "@/integrations/supabase/client";
import { useTeachingCourses } from "@/lib/queries";
import { useProfile } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/teacher/courses/")({
  head: () => ({
    meta: [
      { title: "Quản lý khóa học · EduSense" },
      { name: "description", content: "Tạo, chỉnh sửa và xóa khóa học cùng bài học, bài tập, bài kiểm tra." },
      { property: "og:title", content: "Quản lý khóa học · EduSense" },
      { property: "og:description", content: "CRUD khóa học cho giảng viên." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeacherCourses,
});

function TeacherCourses() {
  const { data: courses = [], isLoading } = useTeachingCourses();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  async function create() {
    if (!profile || !title.trim()) { toast.error("Nhập tên khóa học"); return; }
    const { error } = await supabase
      .from("courses")
      .insert({ title: title.trim(), description: description.trim() || null, teacher_id: profile.id });
    if (error) { toast.error(error.message); return; }
    setTitle("");
    setDescription("");
    toast.success("Đã tạo khóa học");
    queryClient.invalidateQueries({ queryKey: ["teaching-courses"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Đã xóa khóa học");
    queryClient.invalidateQueries({ queryKey: ["teaching-courses"] });
  }

  const input =
    "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-aurora-blue/60";

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-100">Khóa học của tôi</h1>

      <LiquidPanel>
        <SectionTitle title="Tạo khóa học mới" icon={<Plus className="h-4 w-4" />} />
        <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
          <input className={input} placeholder="Tên khóa học" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input
            className={input}
            placeholder="Mô tả ngắn"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            onClick={create}
            className="rounded-xl bg-gradient-to-r from-aurora-blue to-aurora-violet px-5 py-2.5 text-sm font-semibold text-slate-50"
          >
            Tạo
          </button>
        </div>
      </LiquidPanel>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
          <GlassPanel key={c.id}>
            <div className="flex items-start justify-between">
              <BookOpen className="h-4 w-4 text-aurora-blue" />
              <button
                onClick={() => remove(c.id)}
                aria-label="Xóa"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-destructive/20 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <h3 className="mt-2 font-semibold text-slate-100">{c.title}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-slate-400">{c.description}</p>
            <Link
              to="/teacher/courses/$courseId"
              params={{ courseId: c.id }}
              className="mt-3 inline-block text-xs text-aurora-blue hover:underline"
            >
              Quản lý nội dung →
            </Link>
          </GlassPanel>
        ))}
      </div>
    </div>
  );
}
