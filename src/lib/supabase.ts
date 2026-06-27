import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// TODO: Replace with your actual Supabase URL and Anon Key when ready.
// You can use a .env file (e.g. process.env.EXPO_PUBLIC_SUPABASE_URL) for security.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // You can configure secure storage for Expo here later.
    // Example: using expo-secure-store for persisting the session
    // storage: ExpoSecureStoreAdapter
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
