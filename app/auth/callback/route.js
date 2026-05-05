import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase-server';

/**
 * OAuth callback + Email confirmation handler.
 * Supabase redirects here after:
 * - Google OAuth login
 * - Email signup confirmation
 * - Password reset link click
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  // In production, the origin from request.url might be internal, use environment variable if available
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const type = searchParams.get('type'); // 'recovery' for password reset

  console.log(`[Auth Callback] Origin: ${origin}, Next: ${next}, Code: ${code ? 'Yes' : 'No'}`);

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Auth callback exchange error:", error);
      const verifyEmail = searchParams.get('verify_email');
      const errUrl = new URL(`${origin}/?auth_error=true`);
      if (verifyEmail) {
        errUrl.searchParams.set('email', verifyEmail);
      }
      return NextResponse.redirect(errUrl);
    } else {
      // If this is a password recovery, redirect to reset-password page
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/reset-password?auth_success=recovery`);
      }
      
      // Ensure next path is valid and relative
      const safeNext = next.startsWith('/') ? next : '/' + next;
      const redirectUrl = new URL(`${origin}${safeNext}`);
      redirectUrl.searchParams.set('auth_success', 'true');
      
      console.log(`[Auth Callback] Redirecting to: ${redirectUrl.toString()}`);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // If code exchange fails or no code is present
  const fallbackUrl = new URL(`${origin}/?auth_error=true`);
  return NextResponse.redirect(fallbackUrl);
}
