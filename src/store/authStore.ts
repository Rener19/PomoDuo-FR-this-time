import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  initialized: boolean;
  setSession: (session: Session | null) => void;
  ensureProfile: (user: User | null) => Promise<void>;
  initialize: () => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  initialized: false,
  
  setSession: (session) => {
    set({ session, user: session?.user || null });
    get().ensureProfile(session?.user || null);
  },
  
  ensureProfile: async (user: User | null) => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('id').eq('id', user.id).single();
    if (!data) {
      // Create profile using email prefix or random string for username
      const defaultUsername = user.email ? user.email.split('@')[0] : `user_${Math.floor(Math.random() * 10000)}`;
      await supabase.from('profiles').insert({
        id: user.id,
        username: defaultUsername,
        avatar_url: user.user_metadata?.avatar_url || null,
      });
    }
  },
  
  initialize: () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ session, user: session?.user || null, initialized: true });
      get().ensureProfile(session?.user || null);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user || null, initialized: true });
      get().ensureProfile(session?.user || null);
    });
  },
  
  signOut: async () => {
    await supabase.auth.signOut();
  }
}));
