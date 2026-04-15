"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth-context";
import { LogIn, Eye, EyeOff } from "lucide-react";
import styles from "./page.module.css";

export default function AdminLogin() {
  const router = useRouter();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already logged in — redirect to dashboard
  useEffect(() => {
    if (user) {
      router.replace("/admin/dashboard");
    }
  }, [user, router]);

  if (user) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (authError) throw authError;
      
      router.push("/admin/dashboard");
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <form className={styles.form} onSubmit={handleLogin}>
        <div className={styles.header}>
          <h1 className={styles.title}>Admin Login</h1>
          <p className={styles.subtitle}>EditerLor Management</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.field}>
          <label className={styles.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@editerlor.com"
            className={styles.input}
            required
            id="admin-email"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Password</label>
          <div className={styles.passwordWrap}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className={styles.input}
              required
              id="admin-password"
            />
            <button
              type="button"
              className={styles.eyeBtn}
              onClick={() => setShowPassword(!showPassword)}
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          <LogIn size={18} />
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
