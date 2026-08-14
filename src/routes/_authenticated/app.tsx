import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useProfile } from "@/lib/session";
import { Loading } from "@/components/app/glass";

export const Route = createFileRoute("/_authenticated/app")({
  component: RoleRedirect,
});

function RoleRedirect() {
  const { data: profile, isLoading } = useProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile) return;
    navigate({ to: profile.role === "teacher" ? "/teacher" : "/student", replace: true });
  }, [profile, navigate]);

  if (isLoading || profile) return <Loading label="Đang chuyển tới bảng điều khiển…" />;
  return <Loading />;
}
