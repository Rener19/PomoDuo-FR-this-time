import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const { background, text, primary, secondary, backgroundElement } = useTheme();
  const { user, signOut } = useAuthStore();
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  async function loadProfile() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();
        
      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Sign Out', 
        style: 'destructive', 
        onPress: async () => {
          await signOut();
        } 
      },
    ]);
  }

  if (loading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={primary} />
      </ThemedView>
    );
  }

  const hoursFocused = profile?.total_focus_time_minutes 
    ? (profile.total_focus_time_minutes / 60).toFixed(1) 
    : '0';

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          <ThemedText type="title" style={{ color: text, marginBottom: Spacing.four }}>
            Profile
          </ThemedText>

          {/* Avatar & Username */}
          <View style={[styles.card, { backgroundColor: backgroundElement }]}>
            <View style={[styles.avatarPlaceholder, { backgroundColor: primary }]}>
              <ThemedText style={{ color: '#fff', fontSize: 32, fontWeight: 'bold' }}>
                {profile?.username?.charAt(0).toUpperCase() || '?'}
              </ThemedText>
            </View>
            <ThemedText style={{ color: text, fontSize: 24, fontWeight: 'bold', marginTop: Spacing.three }}>
              {profile?.username || 'User'}
            </ThemedText>
            <ThemedText style={{ color: secondary, fontSize: 14 }}>
              {user?.email}
            </ThemedText>
          </View>

          {/* Stats */}
          <ThemedText style={{ color: text, fontWeight: 'bold', fontSize: 18, marginTop: Spacing.four, marginBottom: Spacing.two }}>
            Your Stats
          </ThemedText>
          
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: backgroundElement }]}>
              <ThemedText style={{ color: primary, fontSize: 24, fontWeight: 'bold' }}>
                {hoursFocused}h
              </ThemedText>
              <ThemedText style={{ color: secondary, fontSize: 12, marginTop: Spacing.one }}>
                Total Focus Time
              </ThemedText>
            </View>
            
            <View style={[styles.statCard, { backgroundColor: backgroundElement }]}>
              <ThemedText style={{ color: primary, fontSize: 24, fontWeight: 'bold' }}>
                {profile?.current_streak_days || 0}
              </ThemedText>
              <ThemedText style={{ color: secondary, fontSize: 12, marginTop: Spacing.one }}>
                Day Streak 🔥
              </ThemedText>
            </View>
          </View>

          {/* Actions */}
          <View style={{ marginTop: Spacing.six }}>
            <Pressable 
              style={[styles.btn, { backgroundColor: backgroundElement, borderColor: '#E74C3C', borderWidth: 1 }]} 
              onPress={handleSignOut}
            >
              <ThemedText style={{ color: '#E74C3C', fontWeight: 'bold', fontSize: 16 }}>
                Sign Out
              </ThemedText>
            </Pressable>
          </View>

        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  statCard: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
