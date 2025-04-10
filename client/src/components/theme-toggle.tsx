import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";
import '../styles/components/theme-toggle.css';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="toggle-button"
    >
      {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
} 