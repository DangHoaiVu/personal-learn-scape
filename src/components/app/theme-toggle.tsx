import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { LiquidIconButton } from "@/components/app/liquid";

const KEY = "edusense-theme";

export function applyTheme(theme: "dark" | "light") {
  document.documentElement.classList.toggle("theme-light", theme === "light");
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as "dark" | "light" | null) ?? "dark";
    setTheme(saved);
    applyTheme(saved);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(KEY, next);
    applyTheme(next);
  }

  return (
    <LiquidIconButton
      onClick={toggle}
      aria-label={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      variant="outline"
      className={className ?? "text-slate-300"}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </LiquidIconButton>
  );
}
