import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel, Loading, SectionTitle } from "@/components/app/glass";
import { localDb } from "@/lib/local-client";
import { useProfile } from "@/lib/session";
import { LiquidButton } from "@/components/app/liquid";

export const Route = createFileRoute("/_authenticated/student/browse")({
  head: () => ({
    meta: [
      { title: "Đăng ký khóa học · EduSense" },
      {
        name: "description",
        content: "Duyệt các khóa học đang mở và tự đăng ký chỉ với một cú nhấp.",
      },
      { property: "og:title", content: "Đăng ký khóa học · EduSense" },
      {
        property: "og:description",
        content: "Khám phá khóa học mới phù hợp với hồ sơ năng lực của bạn.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BrowseCourses,
});

function BrowseCourses() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["open-courses", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const [courses, mine] = await Promise.all([
        localDb.rpc("browse_open_courses", { _q: "" }),
        localDb.from("enrollments").select("course_id").eq("student_id", profile!.id),
      ]);
      const enrolled = new Set(
        (mine.data ?? []).map((enrollment: { course_id: string }) => enrollment.course_id),
      );
      return {
        courses: (courses.data ?? []) as unknown as {
          id: string;
          title: string;
          description: string | null;
          teacher_name: string | null;
        }[],
        enrolled,
      };
    },
  });

  async function enroll(courseId: string) {
    if (!profile) return;
    setBusy(courseId);
    const { error } = await localDb
      .from("enrollments")
      .insert({ student_id: profile.id, course_id: courseId });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    await localDb.from("activity_logs").insert({
      student_id: profile.id,
      course_id: courseId,
      action: "login",
      timestamp: new Date().toISOString(),
    });
    toast.success("Đã đăng ký khóa học");
    queryClient.invalidateQueries({ queryKey: ["open-courses"] });
    queryClient.invalidateQueries({ queryKey: ["my-courses"] });
  }

  if (isLoading || !data) return <Loading />;

  const list = data.courses.filter((c) => c.title.toLowerCase().includes(q.trim().toLowerCase()));
  const available = list.filter((c) => !data.enrolled.has(c.id));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Khóa học đang mở</h1>
        <p className="text-sm text-slate-400">
          {available.length} khóa học bạn chưa tham gia. Đăng ký để bắt đầu học ngay.
        </p>
      </div>

      <GlassPanel className="p-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm khóa học…"
            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
        </div>
      </GlassPanel>

      {list.length === 0 ? (
        <GlassPanel>
          <p className="text-sm text-slate-400">Không tìm thấy khóa học phù hợp.</p>
        </GlassPanel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const joined = data.enrolled.has(c.id);
            return (
              <GlassPanel key={c.id} className="flex flex-col justify-between">
                <div>
                  <SectionTitle title={c.title} icon={<BookOpen className="h-4 w-4" />} />
                  <p className="line-clamp-3 text-sm text-slate-400">{c.description}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    Giảng viên: {c.teacher_name ?? "Đang cập nhật"}
                  </p>
                </div>
                <LiquidButton
                  disabled={joined}
                  loading={busy === c.id}
                  onClick={() => enroll(c.id)}
                  variant={joined ? "outline" : "default"}
                  className={
                    joined
                      ? "mt-4 border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]"
                      : "mt-4"
                  }
                >
                  {joined ? (
                    <>
                      <Check className="h-4 w-4" /> Đã tham gia
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> {busy === c.id ? "Đang đăng ký…" : "Đăng ký"}
                    </>
                  )}
                </LiquidButton>
              </GlassPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
