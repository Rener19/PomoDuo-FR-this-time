import React, { useState } from 'react';
import { StyleSheet, View, Alert, Pressable, ActivityIndicator } from 'react-native';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';

// This generates the correct redirect URI for whatever environment we're in
// (Expo Go, dev build, standalone, web)
const redirectTo = makeRedirectUri();

async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;

  if (!access_token) return;

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  if (error) throw error;
  return data.session;
}

export function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const { background, text } = useTheme();

  // Log the redirect URI so the user knows exactly what to add to Supabase
  console.log('=== ADD THIS REDIRECT URL TO SUPABASE ===');
  console.log(redirectTo);
  console.log('==========================================');

  async function signInWithOAuth(provider: 'google' | 'facebook') {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        Alert.alert('Error', error.message);
        setLoading(false);
        return;
      }

      if (!data?.url) {
        Alert.alert('Error', 'Could not get auth URL.');
        setLoading(false);
        return;
      }

      // Open the auth URL and wait for the redirect back
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (res.type === 'success' && res.url) {
        await createSessionFromUrl(res.url);
      }
    } catch (e: any) {
      Alert.alert('Auth Error', e.message);
    }
    setLoading(false);
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <ThemedText type="title" style={[styles.title, { color: text }]}>PomoDuo</ThemedText>
      <ThemedText style={{ color: text, marginBottom: Spacing.two, textAlign: 'center' }}>
        Sign in to sync your pomodoros{'\n'}and connect with friends
      </ThemedText>

      {/* Show the redirect URI for debugging */}
      <ThemedText style={{ color: text, fontSize: 10, marginBottom: Spacing.four, textAlign: 'center', opacity: 0.5 }}>
        Redirect: {redirectTo}
      </ThemedText>

      <View style={styles.buttonContainer}>
        <Pressable
          style={[styles.button, { backgroundColor: '#DB4437', opacity: loading ? 0.6 : 1 }]}
          onPress={() => signInWithOAuth('google')}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
              Continue with Google
            </ThemedText>
          )}
        </Pressable>

        <Pressable
          style={[styles.button, { backgroundColor: '#4267B2', opacity: loading ? 0.6 : 1 }]}
          onPress={() => signInWithOAuth('facebook')}
          disabled={loading}
        >
          <ThemedText style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
            Continue with Facebook
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.four,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: Spacing.two,
  },
  buttonContainer: {
    width: '100%',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  button: {
    paddingVertical: Spacing.three,
    borderRadius: 30,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
});
