import { useState } from "react";
import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
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
  X,
  Compass,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { localDb } from "@/lib/local-client";
import { useProfile } from "@/lib/session";
import { LiquidBar, LiquidPanel, Loading } from "@/components/app/glass";
import { ThemeToggle } from "@/components/app/theme-toggle";
import {
  LiquidButton,
  LiquidIconButton,
  LiquidNav,
  LiquidNavItem,
  LiquidSegmentedControl,
  LiquidSegmentedItem,
} from "@/components/app/liquid";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await localDb.auth.getUser();
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

function isNavActive(pathname: string, to: string) {
  if (to === "/student" || to === "/teacher" || to === "/profile") return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

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
  const activeNav = nav.find((item) => isNavActive(pathname, item.to))?.to ?? null;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await localDb.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen overflow-x-clip">
      <header className="sticky top-0 z-40 px-2.5 pt-2.5 sm:px-4 sm:pt-4 lg:px-6">
        <div className="mx-auto w-full max-w-[1600px]">
          <LiquidBar
            className={cn("w-full px-2.5 py-2.5 sm:px-3 lg:px-4", open ? "rounded-3xl" : "")}
          >
            <div className="flex min-w-0 items-center justify-between gap-1.5 sm:gap-2">
              <div className="flex shrink-0 items-center gap-2 pl-1 text-slate-100">
                <Brain className="h-5 w-5 shrink-0 text-aurora-blue" />
                <span className="hidden font-semibold tracking-tight min-[360px]:inline">
                  EduSense
                </span>
                <span className="ml-1 hidden rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs text-slate-300 2xl:inline">
                  {profile.role === "teacher" ? "Giáo viên" : "Học sinh"}
                </span>
              </div>

              <LiquidNav
                value={activeNav}
                aria-label="Điều hướng chính"
                className="mx-1 hidden min-w-0 flex-1 justify-center border-0 bg-transparent shadow-none xl:flex"
              >
                {nav.map((item) => (
                  <LiquidNavItem key={item.to} value={item.to} asChild>
                    <Link
                      key={item.to}
                      to={item.to}
                      aria-current={isNavActive(pathname, item.to) ? "page" : undefined}
                      className="gap-1.5 px-2.5 text-xs 2xl:gap-2 2xl:px-4 2xl:text-sm"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  </LiquidNavItem>
                ))}
              </LiquidNav>

              <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                <span className="hidden max-w-36 truncate text-sm text-slate-300 2xl:inline">
                  {profile.name}
                </span>
                <ThemeToggle />
                <LiquidIconButton
                  onClick={signOut}
                  aria-label="Đăng xuất"
                  variant="outline"
                  className="text-slate-300"
                >
                  <LogOut className="h-4 w-4" />
                </LiquidIconButton>
                <LiquidIconButton
                  onClick={() => setOpen((value) => !value)}
                  aria-label={open ? "Đóng menu" : "Mở menu"}
                  aria-expanded={open}
                  aria-controls="mobile-navigation"
                  variant="outline"
                  className="text-slate-300 xl:hidden"
                >
                  {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </LiquidIconButton>
              </div>
            </div>

            {open ? (
              <nav
                id="mobile-navigation"
                aria-label="Điều hướng mobile"
                className="mt-2 grid max-h-[calc(100dvh-6.5rem)] grid-cols-1 gap-1 overflow-y-auto overscroll-contain border-t border-white/10 pt-2 sm:grid-cols-2 xl:hidden"
              >
                <div className="mb-1 flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 sm:col-span-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">{profile.name}</p>
                    <p className="text-xs text-slate-400">
                      {profile.role === "teacher" ? "Giáo viên" : "Học sinh"}
                    </p>
                  </div>
                  <UserRound className="h-5 w-5 shrink-0 text-aurora-blue" />
                </div>
                {nav.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    aria-current={isNavActive(pathname, item.to) ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                      isNavActive(pathname, item.to)
                        ? "liquid-control-selected border-[var(--glass-border-strong)]"
                        : "border-transparent text-slate-300 hover:bg-[var(--glass-surface-hover)]",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                ))}
              </nav>
            ) : null}
          </LiquidBar>
        </div>
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
    const { error } = await localDb.rpc("bootstrap_demo", {
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
        <LiquidSegmentedControl
          value={role}
          aria-label="Chọn vai trò"
          className="mt-3 grid grid-cols-2 rounded-xl"
        >
          {(["student", "teacher"] as const).map((r) => (
            <LiquidSegmentedItem
              key={r}
              value={r}
              onClick={() => setRole(r)}
              aria-selected={role === r}
              className="rounded-lg px-3 py-2.5 text-sm"
            >
              {r === "student" ? "Học sinh" : "Giáo viên"}
            </LiquidSegmentedItem>
          ))}
        </LiquidSegmentedControl>
        <LiquidButton onClick={save} loading={loading} className="mt-5 w-full">
          {loading ? "Đang khởi tạo dữ liệu…" : "Bắt đầu"}
        </LiquidButton>
      </LiquidPanel>
    </div>
  );
}
