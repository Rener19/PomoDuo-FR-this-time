import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthScreen } from '@/components/AuthScreen';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

// MUST be at the module level so it runs before any component mounts.
// This completes any pending auth sessions from a previous app launch.
WebBrowser.maybeCompleteAuthSession();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { session, initialized, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Warm up the browser on Android so the first login opens instantly
  useEffect(() => {
    WebBrowser.warmUpAsync();
    return () => {
      WebBrowser.coolDownAsync();
    };
  }, []);

  // Global deep link listener removed to prevent race conditions with WebBrowser.openAuthSessionAsync

  if (!initialized) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {session ? <AppTabs /> : <AuthScreen />}
    </ThemeProvider>
  );
}
