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
import { GoogleSignin } from '@react-native-google-signin/google-signin';



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
  const [showFacebookModal, setShowFacebookModal] = useState(false);
  const { background, text } = useTheme();

  async function signInWithOAuth(provider: 'google' | 'facebook') {
    setLoading(true);
    try {
      if (provider === 'google') {
        const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
        console.log('--- GOOGLE SIGN IN DEBUG ---');
        console.log('webClientId:', webClientId);
        console.log('----------------------------');
        
        if (!webClientId) {
          Alert.alert('Configuration Error', 'Web Client ID is missing from .env!');
          setLoading(false);
          return;
        }

        // Configure dynamically
        GoogleSignin.configure({
          webClientId,
        });

        // Native Google Sign-In
        await GoogleSignin.hasPlayServices();
        const userInfo = await GoogleSignin.signIn();
        // Handle both older v12 (userInfo.idToken) and newer v13 (userInfo.data.idToken)
        const idToken = (userInfo as any).data?.idToken || (userInfo as any).idToken;

        if (idToken) {
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: idToken,
          });
          if (error) throw error;
        } else {
          throw new Error('No ID token found!');
        }
      } else {
        // Fallback for other providers
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

        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (res.type === 'success' && res.url) {
          await createSessionFromUrl(res.url);
        }
      }
    } catch (e: any) {
      if (e.code === 'SIGN_IN_CANCELLED' || e.code === '12501') {
        // user cancelled the login flow
      } else {
        Alert.alert('Auth Error', e.message || 'An error occurred during sign in.');
      }
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
          onPress={() => setShowFacebookModal(true)}
          disabled={loading}
        >
          <ThemedText style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
            Continue with Facebook
          </ThemedText>
        </Pressable>
      </View>

      {/* Coming Soon Modal */}
      {showFacebookModal && (
        <Pressable 
          style={[styles.modalOverlay, { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 9999, elevation: 9999 }]}
          onPress={() => setShowFacebookModal(false)}
        >
          <Pressable style={[styles.modalContent, { backgroundColor: background }]} onPress={(e) => e.stopPropagation()}>
            <ThemedText type="title" style={{ textAlign: 'center', marginBottom: Spacing.four }}>Coming Soon</ThemedText>
            <ThemedText style={{ textAlign: 'center', marginBottom: Spacing.four }}>Facebook login is currently in development and will be available in a future update.</ThemedText>
            <Pressable 
              style={[styles.button, { backgroundColor: '#4267B2', width: '100%' }]} 
              onPress={() => setShowFacebookModal(false)}
            >
              <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Close</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      )}
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
  modalOverlay: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    padding: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
  }
});
