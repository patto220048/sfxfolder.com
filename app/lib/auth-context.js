"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/app/context/ToastContext";
import { supabase } from "@/app/lib/supabase";

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isPremium: false,
  loginWithGoogle: () => {},
  loginWithEmail: () => {},
  signup: () => {},
  logout: () => {},
  resetPassword: () => {},
  updatePassword: () => {},
  resendVerificationEmail: () => {},
  refreshProfile: () => {},
  setIsPasswordSettled: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { showToast } = useToast();
  const pathname = usePathname();
  const router = useRouter();
  
  // Flag to explicitly track if the user finished the password reset process
  const [isPasswordSettled, setIsPasswordSettled] = useState(false);
  // Flag to prevent onAuthStateChange from triggering profile fetches during internal auth updates
  const isAuthUpdating = useRef(false);

  // Fetch user profile from profiles table
  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return null;
    }
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.warn("Failed to fetch profile:", error.message);
        setProfile(null);
        return null;
      }
      setProfile(data);
      return data;
    } catch (e) {
      console.warn("Profile fetch error:", e);
      setProfile(null);
      return null;
    }
  }, [supabase]);

  // Handle URL hash/params for auth errors and successful email verification redirects
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Supabase often sets errors in the URL hash (e.g. #error=access_denied&error_description=...)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);
    let shouldCleanUrl = false;

    const errorDesc = hashParams.get("error_description");
    const errorString = hashParams.get("error");
    const authError = searchParams.get("auth_error");
    const authSuccess = searchParams.get("auth_success");
    const crossDeviceEmail = searchParams.get("email");
    const authType = searchParams.get("type");

    if (errorDesc) {
      showToast(errorDesc.replace(/\+/g, " "), "error");
      shouldCleanUrl = true;
    } else if (errorString) {
      showToast("Authentication error: " + errorString, "error");
      shouldCleanUrl = true;
    } else if (authError && crossDeviceEmail) {
      // Cross-browser/device verification handled locally without native confirm for professional UX
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("need-auth", { 
            detail: { mode: "login", email: crossDeviceEmail, successMsg: "✅ Email verified successfully. Please log in." } 
          })
        );
      }, 300);
      shouldCleanUrl = true;
    } else if (authError && authType === "recovery") {
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("need-auth", { 
            detail: { mode: "forgot", error: "Reset link invalid or opened on a different browser. Please request a new one." } 
          })
        );
      }, 300);
      shouldCleanUrl = true;
    } else if (authError) {
      showToast("Authentication link is invalid or has expired.", "error");
      shouldCleanUrl = true;
    } 
    
    if (authSuccess === "true" || authSuccess === "recovery") {
      showToast(
        authSuccess === "recovery" 
          ? "Please reset your password." 
          : "Email verified successfully! You are now logged in.",
        "success"
      );
      shouldCleanUrl = true;
    }

    if (shouldCleanUrl) {
      // Clean up the URL without triggering a page reload
      const cleanUrl = window.location.pathname;
      window.history.replaceState(null, "", cleanUrl);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let previousPathname = pathname;

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      // If we are currently processing an internal update (like updatePassword), 
      // we skip the automatic profile fetch to avoid Lock Stolen errors.
      if (isAuthUpdating.current) {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          console.log(`[AuthListener] Event ${event} detected during update - suppressing profile fetch to prevent deadlock.`);
          const sessionUser = session?.user ?? null;
          setUser(sessionUser);
          if (mounted) setLoading(false);
          return;
        }
      }

      console.log(`[AuthListener] Event: ${event}`);
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      
      if (sessionUser) {
        await fetchProfile(sessionUser.id);
      } else {
        setProfile(null);
      }
      
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  // Handle "Logout on Exit" logic
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if we just left the reset page
    const wasOnResetPage = window.localStorage.getItem('was_on_reset_page') === 'true';
    
    if (pathname === '/auth/reset-password') {
      window.localStorage.setItem('was_on_reset_page', 'true');
    } else if (wasOnResetPage && pathname !== '/auth/reset-password') {
      // User moved away
      window.localStorage.removeItem('was_on_reset_page');
      
      // If NOT settled, force logout.
      // We check the settled state. Note: state might be stale if navigating, but 
      // setIsPasswordSettled(true) is called before router.push in the page.
      if (!isPasswordSettled) {
        console.log("[Auth] Abandoning reset flow. Forcing logout.");
        logout();
      }
    }
  }, [pathname, isPasswordSettled]);

  // ─── Auth Methods ───

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const loginWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    return data;
  };

  const signup = async (email, password, fullName = "") => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback?verify_email=${encodeURIComponent(email.trim())}`,
      },
    });
    
    if (error) throw error;

    // When "Prevent email enumeration" is enabled, Supabase obfuscates the error
    // and returns a fake user with an empty identities array if the email already exists.
    if (data?.user?.identities?.length === 0) {
      throw new Error("This email is already registered.");
    }

    return data;
  };

  const logout = async () => {
    setIsLoggingOut(true);
    setLoading(true);
    
    try {
      await supabase.auth.signOut();
      // Artificial delay for smooth transition
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (error) {
      console.warn("SignOut error:", error);
    } finally {
      setUser(null);
      setProfile(null);
      setIsLoggingOut(false);
      // Hard refresh to clear all client-side state and avoid UI hanging
      window.location.reload();
    }
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    if (error) throw error;
  };

  const resendVerificationEmail = async (email) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?verify_email=${encodeURIComponent(email.trim())}`,
      },
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword) => {
    try {
      console.log("[Auth] updatePassword: Start");
      isAuthUpdating.current = true;
      
      // Use a timeout guard to prevent infinite 'UPDATING...' state if the library deadlocks
      const updatePromise = supabase.auth.updateUser({
        password: newPassword,
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Update timed out after 10s. Please check your connection or try again.")), 10000)
      );

      const { data, error } = await Promise.race([updatePromise, timeoutPromise]);
      
      console.log("[Auth] updatePassword: API Response received", { data, error });
      
      if (error) throw error;
      
      // Removed session.getSession() as it's redundant and causes storage lock competition
      // in some browser environments when called immediately after updateUser.
      
      // Briefly maintain the lock suppression to allow storage to settle
      setTimeout(() => {
        isAuthUpdating.current = false;
        console.log("[Auth] updatePassword: Settled");
      }, 1500);
      
      return data;
    } catch (err) {
      isAuthUpdating.current = false;
      console.error("[Auth] updatePassword: Fatal error", err);
      throw err;
    }
  };

  const refreshProfile = () => {
    if (user?.id) return fetchProfile(user.id);
    return Promise.resolve(null);
  };

  // ─── Derived State ───
  const isAdmin = profile?.role === "admin";
  const isPremium =
    profile?.role === "premium" ||
    profile?.subscription_status === "active" ||
    (profile?.subscription_status === "suspended" && profile?.subscription_expires_at && new Date(profile.subscription_expires_at) > new Date());

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin,
        isPremium,
        isLoggingOut,
        loginWithGoogle,
        loginWithEmail,
        signup,
        logout,
        resetPassword,
        updatePassword,
        resendVerificationEmail,
        refreshProfile,
        setIsPasswordSettled,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
