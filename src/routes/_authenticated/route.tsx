import { useState } from "react";
import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Brain,
  LayoutDashboard,
  Target,
  MessageSquareText,
  BookOpen,
  Users,
  BarChart3,
  ClipboardList,
  UserRound,
  LogOut,
  Menu,
  Compass,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/session";
import { LiquidPanel, Loading } from "@/components/app/glass";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Shell,
});

const studentNav = [
  { to: "/student", label: "Tổng quan", icon: LayoutDashboard },
  { to: "/student/courses", label: "Khóa học", icon: BookOpen },
  { to: "/student/browse", label: "Đăng ký khóa", icon: Compass },
  { to: "/student/assignments", label: "Bài tập", icon: ClipboardList },
  { to: "/student/mastery", label: "Hồ sơ năng lực", icon: Target },
  { to: "/student/tutor", label: "AI Tutor", icon: MessageSquareText },
  { to: "/profile", label: "Cá nhân", icon: UserRound },
];
const teacherNav = [
  { to: "/teacher", label: "Tổng quan", icon: LayoutDashboard },
  { to: "/teacher/courses", label: "Khóa học", icon: BookOpen },
  { to: "/teacher/students", label: "Sinh viên", icon: Users },
  { to: "/teacher/alerts", label: "Cảnh báo", icon: AlertTriangle },
  { to: "/teacher/analytics", label: "Phân tích", icon: BarChart3 },
  { to: "/teacher/tutor", label: "Trợ lý lớp", icon: MessageSquareText },
  { to: "/profile", label: "Cá nhân", icon: UserRound },
];

function Shell() {
  const { data: profile, isLoading, refetch } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (!profile) return <Onboarding onDone={() => refetch()} />;

  const nav = profile.role === "teacher" ? teacherNav : studentNav;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-5">
        <LiquidPanel className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-100">
              <Brain className="h-5 w-5 text-aurora-blue" />
              <span className="font-semibold tracking-tight">EduSense</span>
              <span className="ml-2 hidden rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs text-slate-300 sm:inline">
                {profile.role === "teacher" ? "Giáo viên" : "Học sinh"}
              </span>
            </div>

            <nav className="hidden items-center gap-1 md:flex">
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-4 py-2 text-sm transition",
                    pathname === item.to
                      ? "bg-white/15 text-slate-100"
                      : "text-slate-300 hover:bg-white/10",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-slate-300 sm:inline">{profile.name}</span>
              <button
                onClick={signOut}
                aria-label="Đăng xuất"
                className="rounded-full border border-white/15 bg-white/5 p-2 text-slate-300 transition hover:bg-white/15"
              >
                <LogOut className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpen((v) => !v)}
                aria-label="Menu"
                className="rounded-full border border-white/15 bg-white/5 p-2 text-slate-300 md:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
            </div>
          </div>

          {open ? (
            <nav className="mt-3 grid gap-1 md:hidden">
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </LiquidPanel>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}

function Onboarding({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    const { error } = await supabase.rpc("bootstrap_demo", {
      _name: name || "Người dùng",
      _role: role,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onDone();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <LiquidPanel className="w-full max-w-md p-7">
        <Users className="h-5 w-5 text-aurora-blue" />
        <h1 className="mt-3 text-xl font-semibold text-slate-100">Hoàn tất hồ sơ</h1>
        <p className="mt-1 text-sm text-slate-400">
          Chọn vai trò để hệ thống khởi tạo dữ liệu lớp học mô phỏng cho bạn.
        </p>
        <input
          className="mt-5 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-aurora-blue/60"
          placeholder="Họ và tên"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["student", "teacher"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-sm transition",
                role === r
                  ? "border-aurora-blue/60 bg-aurora-blue/20 text-slate-100"
                  : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10",
              )}
            >
              {r === "student" ? "Học sinh" : "Giáo viên"}
            </button>
          ))}
        </div>
        <button
          onClick={save}
          disabled={loading}
          className="mt-5 w-full rounded-xl bg-gradient-to-r from-aurora-blue to-aurora-violet px-4 py-2.5 text-sm font-semibold text-slate-50 disabled:opacity-60"
        >
          {loading ? "Đang khởi tạo dữ liệu…" : "Bắt đầu"}
        </button>
      </LiquidPanel>
    </div>
  );
}
