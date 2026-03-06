import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = { name: string | null; avatar_url: string | null };

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  hasCompletedOnboarding: boolean | null;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
  profile: null,
  refreshProfile: async () => {},
  hasCompletedOnboarding: null,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("name, avatar_url")
      .eq("user_id", userId)
      .single();
    setProfile(data);
  }, []);

  const checkOnboarding = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("style_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    setHasCompletedOnboarding(!!data);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
      await checkOnboarding(user.id);
    }
  }, [user, fetchProfile, checkOnboarding]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setTimeout(() => {
          fetchProfile(session.user.id);
          checkOnboarding(session.user.id);
        }, 0);
      } else {
        setProfile(null);
        setHasCompletedOnboarding(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, checkOnboarding]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut, profile, refreshProfile, hasCompletedOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
