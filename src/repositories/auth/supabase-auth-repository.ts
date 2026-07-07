import { createClient } from "@/clients/supabase/browser";
import type { AuthRepository, User, Session } from "./index";

export class SupabaseAuthRepository implements AuthRepository {
  private getSupabase() {
    return createClient();
  }

  async getCurrentUser(): Promise<User | null> {
    const supabase = this.getSupabase();
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return null;
    }

    // Query profiles table for display name, avatar, and is_approved status
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, is_approved")
      .eq("id", user.id)
      .maybeSingle();

    const isApproved = profile ? profile.is_approved : false;
    const displayName = profile ? profile.display_name : null;
    const avatarUrl = profile ? profile.avatar_url : null;

    return {
      id: user.id,
      email: user.email || "",
      createdAt: user.created_at,
      displayName,
      avatarUrl,
      isApproved,
    };
  }

  async getSession(): Promise<Session | null> {
    const supabase = this.getSupabase();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session || !session.user) {
      return null;
    }

    const user = await this.getCurrentUser();
    if (!user) {
      return null;
    }

    return {
      user,
      accessToken: session.access_token,
    };
  }

  async signInWithGoogle(): Promise<void> {
    const supabase = this.getSupabase();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    
    const isNative = typeof window !== "undefined" && (
      ((window as any).Capacitor && (window as any).Capacitor.isNativePlatform()) ||
      (typeof navigator !== "undefined" && (
        navigator.userAgent.includes("CloudCinemaAndroid") || 
        navigator.userAgent.includes("CloudCinemaIOS") ||
        // Also check if we overridden the user agent but platform=app is in URL/localStorage
        localStorage.getItem("platform") === "app"
      ))
    );

    // If native platform, set a cookie to indicate to our callback handler
    // that it should redirect directly to the home page inside the WebView.
    if (isNative && typeof document !== "undefined") {
      document.cookie = "auth_source=webview; path=/; max-age=3600; SameSite=Lax; Secure";
    }

    // Always redirect to the standard callback URL to avoid Supabase dashboard URL validation errors.
    const redirectTo = `${origin}/api/auth/google/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) {
      throw error;
    }
  }

  async signOut(): Promise<void> {
    const supabase = this.getSupabase();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }
}
