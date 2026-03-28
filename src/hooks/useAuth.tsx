import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Profile = { name: string | null; avatar_url: string | null };
type StyleProfile = {
  model_image_url: string | null;
  body_type: string | null;
  skin_tone: string | null;
  face_shape: string | null;
  style_type: string | null;
  gender: string | null;
  ai_body_analysis: any | null;
  ai_face_analysis: any | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  profile: Profile | null;
  styleProfile: StyleProfile | null;
  refreshProfile: () => Promise<void>;
  hasCompletedOnboarding: boolean | null;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
  profile: null,
  styleProfile: null,
  refreshProfile: async () => {},
  hasCompletedOnboarding: null,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("name, avatar_url")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) {
      const { data: newProfile } = await supabase
        .from("profiles")
        .insert({ user_id: userId, name: null })
        .select("name, avatar_url")
        .single();
      setProfile(newProfile);
      toast("Welcome to Dripd!", { description: "Let's set up your style profile." });
    } else {
      setProfile(data);
    }
  }, []);

  const fetchStyleProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("style_profiles")
      .select("model_image_url, body_type, skin_tone, face_shape, style_type, gender, ai_body_analysis, ai_face_analysis")
      .eq("user_id", userId)
      .maybeSingle();
    setStyleProfile(data);
    setHasCompletedOnboarding(!!data);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
      await fetchStyleProfile(user.id);
    }
  }, [user, fetchProfile, fetchStyleProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setTimeout(() => {
          fetchProfile(session.user.id);
          fetchStyleProfile(session.user.id);
        }, 0);
      } else {
        setProfile(null);
        setStyleProfile(null);
        setHasCompletedOnboarding(null);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
  setSession(session);
  setUser(session?.user ?? null);

  if (session?.user) {
    await fetchProfile(session.user.id);
    await fetchStyleProfile(session.user.id);
  }

  setLoading(false);
});

    return () => subscription.unsubscribe();
  }, [fetchProfile, fetchStyleProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut, profile, styleProfile, refreshProfile, hasCompletedOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
