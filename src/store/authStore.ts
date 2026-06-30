import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: { id: string; username: string } | null;
  initialized: boolean;
  setSession: (session: Session | null) => void;
  ensureProfile: (user: User | null) => Promise<void>;
  initialize: () => void;
  signOut: () => Promise<void>;
  updateProfile: (profile: { id: string; username: string } | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  initialized: false,
  
  setSession: (session) => {
    set({ session, user: session?.user || null });
    get().ensureProfile(session?.user || null);
  },
  
  ensureProfile: async (user: User | null) => {
    if (!user) return;
    try {
      const { data } = await supabase.from('profiles').select('id, username').eq('id', user.id).maybeSingle();
      if (!data) {
        // Create profile using email prefix or random string for username
        const defaultUsername = user.email ? user.email.split('@')[0] : `user_${Math.floor(Math.random() * 10000)}`;
        const { error, data: newProfile } = await supabase.from('profiles').insert({
          id: user.id,
          username: defaultUsername,
          avatar_url: user.user_metadata?.avatar_url || null,
        }).select().single();
        
        if (error) {
          // Ignore unique constraint violations caused by concurrent inserts
          if (error.code !== '23505') {
            console.error('Error creating profile:', error);
          }
        } else if (newProfile) {
          set({ profile: { id: newProfile.id, username: newProfile.username } });
        }
      } else {
        set({ profile: { id: data.id, username: data.username } });
      }
    } catch (err) {
      console.error('ensureProfile error:', err);
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
    set({ session: null, user: null, profile: null });
  },
  
  updateProfile: (profile: { id: string; username: string } | null) => set({ profile }),
}));
