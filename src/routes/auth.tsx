import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Brain } from "lucide-react";
import { toast } from "sonner";
import { localDb } from "@/lib/local-client";
import { LiquidPanel } from "@/components/app/glass";
import { LiquidButton, LiquidSegmentedControl, LiquidSegmentedItem } from "@/components/app/liquid";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Đăng nhập · EduSense Local" },
      {
        name: "description",
        content: "Đăng nhập hoặc tạo tài khoản local trên EduSense.",
      },
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

  useEffect(() => {
    let active = true;
    localDb.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate({ to: "/app", replace: true });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (mode === "signup") {
        const { error } = await localDb.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { name: name.trim(), role } },
        });
        if (error) throw new Error(error.message);

        const { error: bootstrapError } = await localDb.rpc("bootstrap_demo", {
          _name: name.trim() || normalizedEmail.split("@")[0] || "Người dùng",
          _role: role,
        });
        if (bootstrapError) throw new Error(bootstrapError.message);
        toast.success("Tạo tài khoản local thành công.");
      } else {
        const { error } = await localDb.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw new Error(error.message);
      }
      navigate({ to: "/app" });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  const input =
    "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-aurora-blue/60 focus:bg-white/10";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <LiquidPanel className="w-full max-w-md p-7">
        <div className="mb-6 flex items-center gap-2">
          <Brain className="h-5 w-5 text-aurora-blue" />
          <span className="font-semibold tracking-tight text-slate-100">EduSense Local</span>
        </div>

        <LiquidSegmentedControl
          value={mode}
          aria-label="Chế độ tài khoản"
          className="mb-5 grid grid-cols-2 rounded-xl"
        >
          {(["signin", "signup"] as const).map((item) => (
            <LiquidSegmentedItem
              key={item}
              value={item}
              onClick={() => setMode(item)}
              aria-selected={mode === item}
              className="rounded-lg px-3 py-2 text-sm font-medium"
            >
              {item === "signin" ? "Đăng nhập" : "Đăng ký"}
            </LiquidSegmentedItem>
          ))}
        </LiquidSegmentedControl>

        <h1 className="text-2xl font-semibold text-slate-100">
          {mode === "signup" ? "Tạo tài khoản" : "Đăng nhập"}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {mode === "signup"
            ? "Tài khoản và dữ liệu mẫu được lưu trong SQLite trên máy này."
            : "Tiếp tục với tài khoản local của bạn."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === "signup" ? (
            <>
              <input
                className={input}
                placeholder="Họ và tên"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
              <LiquidSegmentedControl
                value={role}
                aria-label="Chọn vai trò"
                className="grid grid-cols-2 rounded-xl"
              >
                {(["student", "teacher"] as const).map((item) => (
                  <LiquidSegmentedItem
                    key={item}
                    value={item}
                    onClick={() => setRole(item)}
                    aria-selected={role === item}
                    className="rounded-lg px-3 py-2.5 text-sm"
                  >
                    {item === "student" ? "Học sinh" : "Giáo viên"}
                  </LiquidSegmentedItem>
                ))}
              </LiquidSegmentedControl>
            </>
          ) : null}
          <input
            className={input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
          <input
            className={input}
            type="password"
            placeholder="Mật khẩu"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
          />
          <LiquidButton type="submit" loading={loading} className="w-full py-3">
            {mode === "signup" ? "Đăng ký" : "Đăng nhập"}
          </LiquidButton>
        </form>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-400">
          <p className="font-medium text-slate-300">Tài khoản mẫu</p>
          <p className="mt-1">Học sinh: student1@edusense.local / 123456</p>
          <p>Giáo viên: teacher@edusense.local / 123456</p>
        </div>
      </LiquidPanel>
    </main>
  );
}
