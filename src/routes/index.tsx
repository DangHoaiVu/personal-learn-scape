import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, LineChart, ShieldAlert, Sparkles, Target, GraduationCap } from "lucide-react";
import { GlassPanel, LiquidPanel } from "@/components/app/glass";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EduSense — Hệ thống cá nhân hóa học tập trên nền LMS" },
      {
        name: "description",
        content:
          "LMS thông minh: hồ sơ năng lực theo chủ đề, gợi ý ôn tập cá nhân hóa, cảnh báo sớm sinh viên nguy cơ và phổ điểm tùy chỉnh cho giáo viên.",
      },
      { property: "og:title", content: "EduSense — Cá nhân hóa học tập trên nền LMS" },
      {
        property: "og:description",
        content: "Biến dữ liệu học tập thành hồ sơ năng lực, gợi ý và cảnh báo sớm.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Target,
    title: "Hồ sơ năng lực theo chủ đề",
    desc: "Radar chart % thành thạo từng topic, tính từ tỉ lệ đúng của mọi câu hỏi đã làm.",
  },
  {
    icon: Sparkles,
    title: "Gợi ý ôn tập cá nhân hóa",
    desc: "Hệ thống chỉ đúng chủ đề yếu nhất và bài học cần xem lại.",
  },
  {
    icon: ShieldAlert,
    title: "Cảnh báo sớm",
    desc: "Phát hiện điểm giảm liên tiếp hoặc ngừng hoạt động dài ngày.",
  },
  {
    icon: LineChart,
    title: "Phổ điểm tùy chỉnh",
    desc: "Histogram, ngưỡng phân loại tự đặt, item analysis và heatmap tương tác.",
  },
];

function Landing() {
  return (
    <main className="relative min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <LiquidPanel className="mb-10 flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-2 text-slate-100">
            <Brain className="h-5 w-5 text-aurora-blue" />
            <span className="font-semibold tracking-tight">EduSense</span>
          </div>
          <Button asChild variant="outline">
            <Link to="/auth">Đăng nhập</Link>
          </Button>
        </LiquidPanel>

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300">
              <GraduationCap className="h-3.5 w-3.5" /> Đồ án tốt nghiệp · LMS thông minh
            </p>
            <h1 className="text-4xl font-bold leading-tight text-slate-100 sm:text-5xl">
              Hệ thống cá nhân hóa học tập
              <span className="block bg-gradient-to-r from-aurora-blue via-aurora-violet to-aurora-pink bg-clip-text text-transparent">
                trên nền LMS
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-slate-300">
              Không chỉ lưu trữ bài giảng — EduSense phân tích hành vi và kết quả học tập để dựng hồ
              sơ năng lực, gợi ý lộ trình ôn tập và cảnh báo giảng viên trước khi sinh viên rớt lại.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Bắt đầu ngay</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Xem bản demo</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((f) => (
              <GlassPanel key={f.title}>
                <f.icon className="h-5 w-5 text-aurora-blue" />
                <h3 className="mt-3 text-sm font-semibold text-slate-100">{f.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{f.desc}</p>
              </GlassPanel>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
