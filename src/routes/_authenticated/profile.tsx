import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel, Loading, SectionTitle } from "@/components/app/glass";
import { localDb } from "@/lib/local-client";
import { useProfile } from "@/lib/session";
import { LiquidButton } from "@/components/app/liquid";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Hồ sơ cá nhân · EduSense" },
      {
        name: "description",
        content: "Cập nhật thông tin cá nhân, xem vai trò tài khoản và đăng xuất khỏi EduSense.",
      },
      { property: "og:title", content: "Hồ sơ cá nhân · EduSense" },
      { property: "og:description", content: "Quản lý thông tin tài khoản EduSense của bạn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: profile, isLoading, refetch } = useProfile();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (profile) setName(profile.name);
  }, [profile]);

  useEffect(() => {
    localDb.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  if (isLoading || !profile) return <Loading />;

  async function save() {
    if (!profile) return;
    setSaving(true);
    const { error } = await localDb
      .from("profiles")
      .update({ name: name.trim() })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Đã cập nhật hồ sơ");
    await refetch();
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await localDb.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <SectionTitle
        title="Hồ sơ cá nhân"
        subtitle="Thông tin tài khoản EduSense"
        icon={<UserRound className="h-5 w-5" />}
      />

      <GlassPanel>
        <label className="text-xs uppercase tracking-wide text-slate-400">Họ và tên</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-aurora-blue/60"
        />

        <label className="mt-4 block text-xs uppercase tracking-wide text-slate-400">Email</label>
        <input
          value={email}
          readOnly
          className="mt-2 w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-400 outline-none"
        />

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300">
          <ShieldCheck className="h-4 w-4 text-aurora-blue" />
          Vai trò: {profile.role === "teacher" ? "Giáo viên" : "Học sinh"}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <LiquidButton onClick={save} disabled={!name.trim()} loading={saving}>
            {saving ? "Đang lưu…" : "Lưu thay đổi"}
          </LiquidButton>
          <LiquidButton onClick={signOut} variant="outline">
            <LogOut className="h-4 w-4" /> Đăng xuất
          </LiquidButton>
        </div>
      </GlassPanel>
    </div>
  );
}
