import { LogBox, UIManager, Platform } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useSettingsStore } from '@/store/settingsStore';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { Literata_400Regular, Literata_500Medium, Literata_600SemiBold, Literata_700Bold } from '@expo-google-fonts/literata';
LogBox.ignoreLogs(['new NativeEventEmitter']);

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthScreen } from '@/components/AuthScreen';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { NotificationManager } from '@/lib/NotificationManager';
import { ToastManager } from '@/components/ToastManager';
import { useDuoStore } from '@/store/duoStore';

// MUST be at the module level so it runs before any component mounts.
// This completes any pending auth sessions from a previous app launch.
WebBrowser.maybeCompleteAuthSession();

export default function TabLayout() {
  const { isDarkMode } = useSettingsStore();
  const { session, initialized, initialize } = useAuthStore();
  
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    Literata_400Regular,
    Literata_500Medium,
    Literata_600SemiBold,
    Literata_700Bold,
  });

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Warm up the browser on Android so the first login opens instantly
  useEffect(() => {
    try {
      WebBrowser.warmUpAsync().catch(() => {});
    } catch (e) {}
    return () => {
      try {
        WebBrowser.coolDownAsync().catch(() => {});
      } catch (e) {}
    };
  }, []);

  if (!initialized || !fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={isDarkMode ? DarkTheme : DefaultTheme}>
      <NotificationManager />
      <ToastManager />
      <AnimatedSplashOverlay />
      {session ? <AppTabs /> : <AuthScreen />}
    </ThemeProvider>
  );
}
