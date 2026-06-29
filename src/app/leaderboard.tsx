import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

export default function LeaderboardScreen() {
  const { background, text, primary, backgroundElement } = useTheme();
  const { user } = useAuthStore();
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'global' | 'friends'>('global');

  useEffect(() => {
    loadLeaderboard();
  }, [activeTab]);

  async function loadLeaderboard() {
    setLoading(true);
    if (activeTab === 'global') {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, total_focus_time_minutes, current_streak_days')
        .order('total_focus_time_minutes', { ascending: false })
        .limit(50);
      setLeaders(data || []);
    } else {
      // Friends leaderboard
      const { data: friendsData } = await supabase
        .from('friends')
        .select('user_id, friend_id')
        .or(`user_id.eq.${user?.id},friend_id.eq.${user?.id}`)
        .eq('status', 'accepted');
        
      const friendIds = friendsData ? friendsData.map(f => f.user_id === user?.id ? f.friend_id : f.user_id) : [];
      if (user?.id) friendIds.push(user.id); // Include self
      
      const { data } = await supabase
        .from('profiles')
        .select('id, username, total_focus_time_minutes, current_streak_days')
        .in('id', friendIds)
        .order('total_focus_time_minutes', { ascending: false });
        
      setLeaders(data || []);
    }
    setLoading(false);
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.responsiveWrapper}>
        <ThemedText type="title" style={{ color: primary, marginBottom: Spacing.four, textAlign: 'center' }}>
          Leaderboard
        </ThemedText>
        
        {/* Toggle */}
        <View style={{ flexDirection: 'row', marginBottom: Spacing.four, backgroundColor: backgroundElement, borderRadius: 30, padding: 4 }}>
          <ThemedText 
            style={[styles.tab, activeTab === 'global' && { backgroundColor: primary, color: background }]}
            onPress={() => setActiveTab('global')}
          >
            Global
          </ThemedText>
          <ThemedText 
            style={[styles.tab, activeTab === 'friends' && { backgroundColor: primary, color: background }]}
            onPress={() => setActiveTab('friends')}
          >
            Friends
          </ThemedText>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={primary} style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={leaders}
            keyExtractor={item => item.id}
            renderItem={({ item, index }) => (
              <View style={[styles.row, { backgroundColor: backgroundElement, borderColor: item.id === user?.id ? primary : 'transparent', borderWidth: 2 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
                  <ThemedText style={{ color: primary, fontFamily: Fonts.sansBold, fontSize: 18, width: 30 }}>
                    #{index + 1}
                  </ThemedText>
                  <ThemedText style={{ color: text, fontSize: 16, fontWeight: item.id === user?.id ? 'bold' : 'normal' }}>
                    {item.username} {item.id === user?.id ? '(You)' : ''}
                  </ThemedText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <ThemedText style={{ color: primary, fontFamily: Fonts.sansBold }}>{item.total_focus_time_minutes} mins</ThemedText>
                  <ThemedText style={{ color: text, fontSize: 12 }}>🔥 {item.current_streak_days} days</ThemedText>
                </View>
              </View>
            )}
            ListEmptyComponent={<ThemedText style={{ color: text, textAlign: 'center' }}>No data available.</ThemedText>}
          />
        )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.four, alignItems: 'center' },
  responsiveWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
  },
  tab: { flex: 1, textAlign: 'center', paddingVertical: Spacing.two, fontFamily: Fonts.sansBold, borderRadius: 30, overflow: 'hidden' },
  row: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: Spacing.three, 
    borderRadius: Spacing.two, 
    marginBottom: Spacing.two,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  }
});
