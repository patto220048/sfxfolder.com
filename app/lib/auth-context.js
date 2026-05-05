"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/app/context/ToastContext";
import { supabase } from "@/app/lib/supabase";
import { getProfile } from "@/app/lib/api";

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
  setSession: () => {},
  setIsPasswordSettled: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSessionState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSyncingProfile, setIsSyncingProfile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { showToast } = useToast();
  const pathname = usePathname();
  const router = useRouter();
  
  // Flag to explicitly track if the user finished the password reset process
  const [isPasswordSettled, setIsPasswordSettled] = useState(false);
  // Flag to prevent onAuthStateChange from triggering profile fetches during internal auth updates
  const isAuthUpdating = useRef(false);

  // Environment detection
  const isDev = process.env.NODE_ENV === 'development';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  // Fetch user profile from profiles table
  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return null;
    }
    setIsSyncingProfile(true);
    try {
      // Use the proxied getProfile from api.js to bypass connection limits
      const data = await getProfile(userId);
      setProfile(data);
      return data;
    } catch (e) {
      console.warn("Profile fetch error:", e);
      setProfile(null);
      return null;
    } finally {
      setIsSyncingProfile(false);
    }
  }, []);

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

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[Auth] Initial getSession:", session?.user?.email);
      if (mounted) {
        setSessionState(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        }
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Auth] onAuthStateChange event:", event, session?.user?.email);
      if (!mounted) return;
      
      console.log(`[AuthListener] Event: ${event}`);
      setSessionState(session);
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      
      // If we are currently processing an internal update (like updatePassword), 
      // we skip the automatic profile fetch to avoid Lock Stolen errors.
      if (isAuthUpdating.current) {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          if (mounted) setLoading(false);
          return;
        }
      }

      if (sessionUser) {
        await fetchProfile(sessionUser.id);
        // Save to plugin vault if in plugin mode
        if (typeof window !== 'undefined' && window.parent && session) {
           window.parent.postMessage({
              type: 'SAVE_AUTH',
              payload: { access_token: session.access_token, refresh_token: session.refresh_token }
           }, '*');
        }
      } else {
        setProfile(null);
      }
      
      if (mounted) setLoading(false);
    });

    // Listen for AUTH_DATA from plugin vault
    const handleMessage = async (event) => {
      if (event.data?.type === 'AUTH_DATA') {
        const { access_token, refresh_token } = event.data.payload;
        if (access_token && refresh_token) {
          try {
             await supabase.auth.setSession({ access_token, refresh_token });
          } catch (e) {
             console.warn("Failed to set session from vault", e);
          }
        }
      }
    };
    
    if (typeof window !== 'undefined') {
       window.addEventListener('message', handleMessage);
       // Ask vault for auth if we are in plugin mode
       if (window.location.search.includes('mode=plugin')) {
          if (window.parent) {
             window.parent.postMessage({ type: 'GET_AUTH' }, '*');
          }
       }
    }

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (typeof window !== 'undefined') {
         window.removeEventListener('message', handleMessage);
      }
    };
  }, [supabase, fetchProfile]);

  // Subscribe to real-time changes on the user's profile
  useEffect(() => {
    if (!user?.id) return;
    
    const channel = supabase.channel(`public:profiles:id=eq.${user.id}`)
      .on('postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, 
          (payload) => {
            console.log('[Auth] Profile updated via realtime!', payload);
            fetchProfile(user.id);
          }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchProfile]);

  // Fallback Polling / Window Focus sync for Plugin
  useEffect(() => {
    const isPremiumUser = profile?.role === "admin" ||
      (["active", "suspended", "cancelled"].includes(profile?.subscription_status) && 
       profile?.subscription_expires_at && 
       new Date(profile.subscription_expires_at) > new Date());

    // If no user or user is already premium, no need to aggressively sync on focus
    if (!user?.id || isPremiumUser) return;
    
    let lastFetchTime = 0;
    const handleFocus = () => {
      const awaitingTimeStr = window.localStorage.getItem('awaiting_payment_sync');
      if (!awaitingTimeStr) return; // Only sync if they expressed intent
      
      const awaitingTime = parseInt(awaitingTimeStr, 10);
      const now = Date.now();
      
      // If intent was more than 15 minutes ago, expire it
      if (now - awaitingTime > 15 * 60 * 1000) {
        window.localStorage.removeItem('awaiting_payment_sync');
        return;
      }

      // Only fetch if 10 seconds have passed since the last focus-triggered fetch
      if (now - lastFetchTime > 10000) {
        lastFetchTime = now;
        console.log("[Auth] Window focused/visible, syncing profile due to recent payment intent...");
        fetchProfile(user.id).then(data => {
            const isNowPremium = data?.role === "admin" ||
              (["active", "suspended", "cancelled"].includes(data?.subscription_status) && 
               data?.subscription_expires_at && 
               new Date(data.subscription_expires_at) > new Date());
            // If they successfully upgraded, clear the intent flag
            if (isNowPremium) {
                window.localStorage.removeItem('awaiting_payment_sync');
            }
        });
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') handleFocus();
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
    };
  }, [user?.id, profile, fetchProfile]);

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

  const loginWithGoogle = async (next = "") => {
    // Check if we are inside the Adobe Premiere Plugin environment
    const isPlugin = typeof window !== "undefined" && !!window.__adobe_cep__;

    if (isPlugin) {
      // If in Plugin, open the dedicated sync page in the system browser
      const loginUrl = `${window.location.origin}/plugin-auth`;
      window.cep.util.openURLInDefaultBrowser(loginUrl);
      showToast("Please complete login in your external browser.", "success");
      return;
    }

    const targetOrigin = window.location.origin;
    const redirectTo = new URL(`${targetOrigin}/auth/callback`);
    
    // Clean up next parameter
    let nextPath = next;
    if (nextPath && nextPath.startsWith('http')) {
      try {
        nextPath = new URL(nextPath).pathname + new URL(nextPath).search;
      } catch (e) {
        nextPath = '/';
      }
    }

    if (nextPath && nextPath !== '/') {
      redirectTo.searchParams.set("next", nextPath);
    }

    console.log("[Auth] Google Login Redirecting to:", redirectTo.toString());

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo.toString(),
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
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

  const signup = async (email, password, fullName = "", next = "") => {
    const redirectUrl = new URL(`${currentOrigin}/auth/callback`);
    redirectUrl.searchParams.set("verify_email", email.trim());
    if (next) {
      redirectUrl.searchParams.set("next", next);
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: redirectUrl.toString(),
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
      // Clear plugin vault
      if (typeof window !== 'undefined' && window.parent) {
         window.parent.postMessage({ type: 'CLEAR_AUTH' }, '*');
      }

      // Use a timeout race to prevent hanging if signOut request is blocked by connection limits
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("SignOut timeout")), 3000))
      ]).catch(err => console.warn("SignOut timed out or failed:", err));
      
      // Artificial delay for smooth transition
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.warn("SignOut error:", error);
    } finally {
      setUser(null);
      setProfile(null);
      setSessionState(null);
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

  const resendVerificationEmail = async (email, next = "") => {
    const redirectUrl = new URL(`${currentOrigin}/auth/callback`);
    redirectUrl.searchParams.set("verify_email", email.trim());
    if (next) {
      redirectUrl.searchParams.set("next", next);
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: redirectUrl.toString(),
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

  const setSession = async (access_token, refresh_token) => {
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (error) throw error;
    
    setSessionState(data.session);
    setUser(data.session?.user ?? null);
    
    // Immediately fetch profile for the new session to ensure derived states (isPremium) are updated
    if (data.session?.user) {
      await fetchProfile(data.session.user.id);
    }
    
    return data;
  };

  const refreshProfile = () => {
    if (user?.id) return fetchProfile(user.id);
    return Promise.resolve(null);
  };

  const markAwaitingPayment = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('awaiting_payment_sync', Date.now().toString());
    }
  }, []);

  // ─── Derived State ───
  const isAdmin = profile?.role === "admin";
  
  const isPremium =
    profile?.role === "admin" ||
    (["active", "suspended", "cancelled"].includes(profile?.subscription_status) && 
     profile?.subscription_expires_at && 
     new Date(profile.subscription_expires_at) > new Date());

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        isAdmin,
        isPremium,
        isSyncingProfile,
        isLoggingOut,
        markAwaitingPayment,
        loginWithGoogle,
        loginWithEmail,
        signup,
        logout,
        resetPassword,
        updatePassword,
        resendVerificationEmail,
        refreshProfile,
        setSession,
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
