import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
    
    // Add a class to the body for transition animation
    document.body.classList.add('theme-transition');
    
    // Remove the class after animation completes
    setTimeout(() => {
      document.body.classList.remove('theme-transition');
    }, 600);
  };

  return (
    <button
      onClick={toggleTheme}
      className="toggle-button"
      aria-label="Toggle theme"
    >
      <div className="toggle-icon-wrapper">
        {theme === "light" ? (
          <Moon className="toggle-icon moon" size={18} />
        ) : (
          <Sun className="toggle-icon sun" size={18} />
        )}
      </div>
      <span className="sr-only">Toggle theme</span>
    </button>
  );
} 