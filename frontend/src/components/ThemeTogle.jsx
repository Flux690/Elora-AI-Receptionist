import { useTheme } from "../context/ThemeContext";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button className="theme-toggle-button" onClick={toggleTheme}>
      {theme === "light" ? "Switch to Dark" : "Switch to Light"}
    </button>
  );
}

export default ThemeToggle;
