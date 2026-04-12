"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./ThemeToggle.module.css";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={styles.placeholder} />;
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={styles.toggle}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <Sun size={20} className={styles.icon} />
      ) : (
        <Moon size={20} className={styles.icon} />
      )}
    </button>
  );
}
