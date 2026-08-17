import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Brain, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { LiquidPanel } from "@/components/app/glass";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Đăng nhập · EduSense" },
      { name: "description", content: "Đăng nhập hoặc tạo tài khoản học sinh / giáo viên trên EduSense." },
      { property: "og:title", content: "Đăng nhập · EduSense" },
      { property: "og:description", content: "Truy cập hồ sơ năng lực và bảng phân tích lớp học." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [loading, setLoading] = useState(false);

  // Sau khi quay lại từ Google OAuth, nếu đã có phiên thì vào thẳng ứng dụng.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate({ to: "/app", replace: true });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name, role },
          },
        });
        if (error) throw error;
        // Nếu chưa có session (email cần xác nhận), thử đăng nhập ngay.
        if (!signUpData.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) {
            toast.success("Hãy kiểm tra email để xác nhận tài khoản.");
            return;
          }
        }
        const { error: rpcError } = await supabase.rpc("bootstrap_demo", {
          _name: name || email.split("@")[0] || "Người dùng",
          _role: role,
        });
        if (rpcError) throw rpcError;
        toast.success("Tạo tài khoản thành công, đang khởi tạo dữ liệu lớp học…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth`,
    });
    if (result.error) {
      toast.error("Không đăng nhập được bằng Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/app" });
  }

  const input =
    "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-aurora-blue/60 focus:bg-white/10";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <LiquidPanel className="w-full max-w-md p-7">
        <div className="mb-6 flex items-center gap-2">
          <Brain className="h-5 w-5 text-aurora-blue" />
          <span className="font-semibold tracking-tight text-slate-100">EduSense</span>
        </div>
        <h1 className="text-2xl font-semibold text-slate-100">
          {mode === "signup" ? "Tạo tài khoản" : "Đăng nhập"}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {mode === "signup"
            ? "Tài khoản mới sẽ được khởi tạo kèm dữ liệu lớp học mô phỏng."
            : "Tiếp tục với tài khoản của bạn."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === "signup" ? (
            <>
              <input
                className={input}
                placeholder="Họ và tên"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <div className="grid grid-cols-2 gap-2">
                {(["student", "teacher"] as const).map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRole(r)}
                    className={`rounded-xl border px-3 py-2.5 text-sm transition ${
                      role === r
                        ? "border-aurora-blue/60 bg-aurora-blue/20 text-slate-100"
                        : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {r === "student" ? "Học sinh" : "Giáo viên"}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          <input
            className={input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className={input}
            type="password"
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-aurora-blue to-aurora-violet px-4 py-2.5 text-sm font-semibold text-slate-50 shadow-lg shadow-aurora-violet/25 transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "signup" ? "Đăng ký" : "Đăng nhập"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-white/10" /> hoặc <span className="h-px flex-1 bg-white/10" />
        </div>
        <button
          onClick={google}
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
        >
          Tiếp tục với Google
        </button>

        <p className="mt-5 text-center text-sm text-slate-400">
          {mode === "signup" ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
          <button
            className="font-medium text-aurora-blue hover:underline"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          >
            {mode === "signup" ? "Đăng nhập" : "Đăng ký"}
          </button>
        </p>
      </LiquidPanel>
    </main>
  );
}
