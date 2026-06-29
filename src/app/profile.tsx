import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Pressable, ScrollView, Alert, ActivityIndicator, Switch, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const theme = useTheme();
  const { background, text, primary, secondary, backgroundElement, destructive } = theme;
  const { user, signOut } = useAuthStore();
  const { isDarkMode, toggleDarkMode, soundEnabled, toggleSound } = useSettingsStore();
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');

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
      setNewUsername(data.username);
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
        <View style={styles.responsiveWrapper}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          <ThemedText type="title" style={{ color: primary, marginBottom: Spacing.four, textAlign: 'center' }}>
            Profile
          </ThemedText>

          {/* Avatar & Username */}
          <View style={[styles.card, { backgroundColor: backgroundElement }]}>
            <View style={[styles.avatarPlaceholder, { backgroundColor: primary }]}>
              <ThemedText style={{ color: '#fff', fontSize: 32, fontFamily: Fonts.sansBold }}>
                {profile?.username?.charAt(0).toUpperCase() || '?'}
              </ThemedText>
            </View>
            
            {editingUsername ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: Spacing.three, gap: Spacing.two }}>
                <TextInput
                  style={[styles.input, { color: text, borderColor: secondary }]}
                  value={newUsername}
                  onChangeText={setNewUsername}
                  placeholder="New username"
                  placeholderTextColor={secondary}
                  autoCapitalize="none"
                />
                <Pressable onPress={async () => {
                  if (!newUsername.trim()) return;
                  await supabase.from('profiles').update({ username: newUsername }).eq('id', user?.id);
                  setProfile({ ...profile, username: newUsername });
                  useAuthStore.getState().updateProfile({ id: user!.id, username: newUsername });
                  setEditingUsername(false);
                }} style={{ backgroundColor: primary, padding: Spacing.two, borderRadius: Spacing.one }}>
                  <ThemedText style={{ color: '#fff', fontFamily: Fonts.sansBold }}>Save</ThemedText>
                </Pressable>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: Spacing.three, gap: Spacing.two }}>
                <ThemedText style={{ color: text, fontSize: 24, fontFamily: Fonts.sansBold }}>
                  {profile?.username || 'User'}
                </ThemedText>
                <Pressable onPress={() => setEditingUsername(true)}>
                  <ThemedText style={{ color: primary, fontSize: 16 }}>✎</ThemedText>
                </Pressable>
              </View>
            )}

            <ThemedText style={{ color: secondary, fontSize: 14, marginTop: Spacing.one }}>
              {user?.email}
            </ThemedText>
          </View>
          
          {/* Settings */}
          <ThemedText style={{ color: text, fontFamily: Fonts.sansBold, fontSize: 18, marginTop: Spacing.four, marginBottom: Spacing.two }}>
            Settings
          </ThemedText>
          <View style={[styles.card, { backgroundColor: backgroundElement, paddingVertical: Spacing.two }]}>
            <View style={styles.settingRow}>
              <ThemedText style={{ color: text, fontSize: 16 }}>Dark Mode</ThemedText>
              <Switch value={isDarkMode} onValueChange={toggleDarkMode} trackColor={{ true: primary }} />
            </View>
            <View style={[styles.settingRow, { marginTop: Spacing.three }]}>
              <ThemedText style={{ color: text, fontSize: 16 }}>Timer End Alarms</ThemedText>
              <Switch value={soundEnabled} onValueChange={toggleSound} trackColor={{ true: primary }} />
            </View>
          </View>

          {/* Stats */}
          <ThemedText style={{ color: text, fontFamily: Fonts.sansBold, fontSize: 18, marginTop: Spacing.four, marginBottom: Spacing.two }}>
            Your Stats
          </ThemedText>
          
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: backgroundElement }]}>
              <ThemedText style={{ color: primary, fontSize: 24, fontFamily: Fonts.sansBold }}>
                {hoursFocused}h
              </ThemedText>
              <ThemedText style={{ color: secondary, fontSize: 12, marginTop: Spacing.one }}>
                Total Focus Time
              </ThemedText>
            </View>
            
            <View style={[styles.statCard, { backgroundColor: backgroundElement }]}>
              <ThemedText style={{ color: primary, fontSize: 24, fontFamily: Fonts.sansBold }}>
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
              style={[styles.btn, { backgroundColor: backgroundElement, borderColor: destructive, borderWidth: 1 }]} 
              onPress={handleSignOut}
            >
              <ThemedText style={{ color: destructive, fontFamily: Fonts.sansBold, fontSize: 16 }}>
                Sign Out
              </ThemedText>
            </Pressable>
          </View>

        </ScrollView>
        </View>
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
    alignItems: 'center',
  },
  responsiveWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
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
  input: {
    borderWidth: 1,
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    minWidth: 150,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
});
