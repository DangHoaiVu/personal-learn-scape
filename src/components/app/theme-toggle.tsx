import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

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
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      className={
        className ??
        "rounded-full border border-white/15 bg-white/5 p-2 text-slate-300 transition hover:bg-white/15"
      }
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
