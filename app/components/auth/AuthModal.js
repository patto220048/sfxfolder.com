"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/app/lib/auth-context";
import { useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  X,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  AlertCircle,
  Check,
  ArrowLeft,
} from "lucide-react";
import styles from "./AuthModal.module.css";

/**
 * AuthModal — Login / Sign Up / Forgot Password
 * Glassmorphism design with tabs and Google OAuth.
 */
export default function AuthModal({ isOpen, onClose, config }) {
  const { loginWithEmail, signup, resetPassword, loginWithGoogle, resendVerificationEmail, setSession } =
    useAuth();
  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [syncCode, setSyncCode] = useState("");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isPlugin = searchParams.get("mode") === "plugin";
  const modalRef = useRef(null);

  // Helper to switch modes manually (e.g. from UI links)
  const switchMode = (newMode) => {
    setError("");
    setSuccessMsg("");
    setPassword("");
    setNeedsVerification(false);
    setMode(newMode);
  };

  // Reset all when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (config) {
        setMode(config.mode || "login");
        setEmail(config.email || "");
        setSuccessMsg(config.successMsg || config.msg || "");
        setError(config.error || "");
      } else {
        setMode("login");
        setEmail("");
        setSuccessMsg("");
        setError("");
      }
      setPassword("");
      setFullName("");
      setNeedsVerification(false);
    }
  }, [isOpen, config]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Close on backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setError("");
    try {
      await loginWithGoogle(pathname);
    } catch (err) {
      setError(err.message || "Google login failed");
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setNeedsVerification(false);
    try {
      await loginWithEmail(email, password);
      onClose();
    } catch (err) {
      if (err.message?.toLowerCase().includes("email not confirmed")) {
        setNeedsVerification(true);
        setError("Email not confirmed. Please use the button below to resend the verification link.");
      } else {
        setError(err.message || "Invalid email or password");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
      setError("Password must contain at least one letter and one number");
      return;
    }

    setLoading(true);
    setNeedsVerification(false);
    try {
      const { user } = await signup(email, password, fullName);
      if (user && !user.confirmed_at) {
        setSuccessMsg(
          "Check your email for a confirmation link to complete sign up."
        );
      } else {
        onClose();
      }
    } catch (err) {
      if (err.message === "This email is already registered" || err.message?.includes("already registered")) {
        setNeedsVerification(false);
        setMode("login");
        setError("This email is already registered. Please log in.");
      } else {
        setError(err.message || "Sign up failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await resendVerificationEmail(email);
      setSuccessMsg("Verification email resent! Check your inbox/spam.");
      setNeedsVerification(false);
    } catch (err) {
      setError(err.message || "Failed to resend verification email");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await resetPassword(email);
      setSuccessMsg("Password reset link sent! Check your email.");
    } catch (err) {
      setError(err.message || "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSyncBrowser = () => {
    const syncUrl = `${window.location.origin}/plugin-auth`;
    if (window.cep) {
      window.cep.util.openURLInDefaultBrowser(syncUrl);
    } else {
      window.open(syncUrl, "_blank");
    }
  };

  const handleTokenSync = async (e) => {
    e.preventDefault();
    const cleanCode = syncCode.trim();
    if (!cleanCode) return;
    
    setLoading(true);
    setError("");
    try {
      let decoded;
      try {
        decoded = JSON.parse(atob(cleanCode));
      } catch (e) {
        throw new Error("The code you pasted is invalid. Please make sure you copied the entire code correctly.");
      }

      const { access_token, refresh_token } = decoded;
      
      if (!access_token || !refresh_token) {
        throw new Error("Missing session data in sync code.");
      }

      await setSession(access_token, refresh_token);
      
      setSuccessMsg("Connected successfully! Syncing your account...");
      
      // Give the context a moment to update before closing
      setTimeout(() => {
        onClose();
        // Skip reload as it might clear session in some plugin environments if persistence is unstable
      }, 800);
      
    } catch (err) {
      console.error("Sync error:", err);
      setError(err.message || "Failed to sync. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.modal} ref={modalRef}>
        {/* Close button */}
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        {/* Header */}
        <div className={styles.header}>
          {mode === "forgot" && !isPlugin && (
            <button
              className={styles.backBtn}
              onClick={() => setMode("login")}
              aria-label="Back to login"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h2 className={styles.title}>
            {isPlugin 
              ? "Sync Your Account"
              : mode === "login"
              ? "Welcome Back"
              : mode === "signup"
              ? "Create Account"
              : "Reset Password"}
          </h2>
          <p className={styles.subtitle}>
            {isPlugin
              ? "Login via browser to sync your premium access"
              : mode === "login"
              ? "Sign in to access premium resources"
              : mode === "signup"
              ? "Join to download exclusive content"
              : "Enter your email to receive a reset link"}
          </p>
        </div>

        {/* Success Message */}
        {successMsg && (
          <div className={styles.successAlert}>
            <Check size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className={styles.errorAlert}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {(!successMsg || mode === "login") && (
          <>
            {/* Plugin-only Simplified UI */}
            {isPlugin ? (
              <div className={styles.pluginSyncSection} style={{ marginTop: 0 }}>
                <p className={styles.pluginInfo}>
                  To ensure a secure and stable connection, please sign in using your system browser.
                </p>

                <button 
                  type="button" 
                  onClick={handleOpenSyncBrowser}
                  className={styles.syncBrowserBtn}
                >
                  OPEN BROWSER LOGIN
                </button>

                <div className={styles.divider} style={{ margin: '20px 0' }}>
                  <span>PASTE CODE BELOW</span>
                </div>

                <form onSubmit={handleTokenSync} className={styles.syncForm}>
                  <div className={styles.field}>
                    <div className={styles.inputWrap}>
                      <input
                        type="text"
                        value={syncCode}
                        onChange={(e) => setSyncCode(e.target.value)}
                        placeholder="Paste sync code here..."
                        className={styles.input}
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className={styles.connectBtn}
                    disabled={loading || !syncCode}
                  >
                    {loading ? "Connecting..." : "SYNC ACCOUNT NOW"}
                  </button>
                </form>
              </div>
            ) : (
              <>
                {/* Standard Web UI */}
                {/* Google OAuth (not for forgot password) */}
                {mode !== "forgot" && (
                  <>
                    <button
                      className={styles.googleBtn}
                      onClick={handleGoogleLogin}
                      type="button"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      <span>Continue with Google</span>
                    </button>

                    <div className={styles.divider}>
                      <span>or</span>
                    </div>
                  </>
                )}

                {/* Login Form */}
                {mode === "login" && (
                  <form onSubmit={handleEmailLogin} className={styles.form}>
                    <div className={styles.field}>
                      <div className={styles.inputWrap}>
                        <Mail size={18} className={styles.inputIcon} />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Email address"
                          className={styles.input}
                          required
                          id="auth-email"
                        />
                      </div>
                    </div>

                    <div className={styles.field}>
                      <div className={styles.inputWrap}>
                        <Lock size={18} className={styles.inputIcon} />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password"
                          className={styles.input}
                          required
                          id="auth-password"
                        />
                        <button
                          type="button"
                          className={styles.eyeBtn}
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label="Toggle password"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={styles.forgotLink}
                      onClick={() => switchMode("forgot")}
                    >
                      Forgot password?
                    </button>

                    <button
                      type="submit"
                      className={styles.submitBtn}
                      disabled={loading}
                    >
                      {loading ? "Signing in..." : "Sign In"}
                    </button>

                    {needsVerification && (
                      <div className={styles.resendVerificationWrap}>
                        <p className={styles.resendNotice}>Account not verified?</p>
                        <button
                          type="button"
                          className={styles.resendBtn}
                          onClick={handleResendVerification}
                          disabled={loading}
                        >
                          Resend Verification Email
                        </button>
                      </div>
                    )}
                  </form>
                )}

                {/* Signup Form */}
                {mode === "signup" && (
                  <form onSubmit={handleSignup} className={styles.form}>
                    <div className={styles.field}>
                      <div className={styles.inputWrap}>
                        <User size={18} className={styles.inputIcon} />
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Full name"
                          className={styles.input}
                          id="auth-fullname"
                        />
                      </div>
                    </div>

                    <div className={styles.field}>
                      <div className={styles.inputWrap}>
                        <Mail size={18} className={styles.inputIcon} />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Email address"
                          className={styles.input}
                          required
                          id="auth-signup-email"
                        />
                      </div>
                    </div>

                    <div className={styles.field}>
                      <div className={styles.inputWrap}>
                        <Lock size={18} className={styles.inputIcon} />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password (min 8 chars, letter & number)"
                          className={styles.input}
                          required
                          minLength={8}
                          id="auth-signup-password"
                        />
                        <button
                          type="button"
                          className={styles.eyeBtn}
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label="Toggle password"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className={styles.submitBtn}
                      disabled={loading}
                    >
                      {loading ? "Creating account..." : "Create Account"}
                    </button>
                  </form>
                )}

                {/* Forgot Password Form */}
                {mode === "forgot" && (
                  <form onSubmit={handleForgotPassword} className={styles.form}>
                    <div className={styles.field}>
                      <div className={styles.inputWrap}>
                        <Mail size={18} className={styles.inputIcon} />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Email address"
                          className={styles.input}
                          required
                          id="auth-forgot-email"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className={styles.submitBtn}
                      disabled={loading}
                    >
                      {loading ? "Sending..." : "Send Reset Link"}
                    </button>
                  </form>
                )}

                <div className={styles.legalDisclaimer}>
                  By continuing, you agree to our{" "}
                  <Link href="/terms" onClick={onClose}>Terms of Service</Link> and{" "}
                  <Link href="/privacy" onClick={onClose}>Privacy Policy</Link>.
                </div>

                {/* Mode Toggle */}
                {mode !== "forgot" && (
                  <div className={styles.toggle}>
                    {mode === "login" ? (
                      <span>
                        Don&apos;t have an account?{" "}
                        <button onClick={() => switchMode("signup")}>Sign Up</button>
                      </span>
                    ) : (
                      <span>
                        Already have an account?{" "}
                        <button onClick={() => switchMode("login")}>Sign In</button>
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
