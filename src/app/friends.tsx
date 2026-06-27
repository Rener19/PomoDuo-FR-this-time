import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, TextInput, Pressable, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useDuoStore } from '@/store/duoStore';

export default function FriendsScreen() {
  const { background, text, primary, secondary, backgroundElement } = useTheme();
  const { user } = useAuthStore();
  const { createSession, joinSession } = useDuoStore();

  const [showRequests, setShowRequests] = useState(false);
  const [requestsTab, setRequestsTab] = useState<'received' | 'sent'>('received');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [joinCode, setJoinCode] = useState('');

  // ─── Data loading ───────────────────────────────────────────
  const loadAll = useCallback(() => {
    if (!user) return;
    loadFriends();
    loadIncomingRequests();
    loadSentRequests();
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ─── Realtime subscription for live sync ────────────────────
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('friends-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friends', filter: `user_id=eq.${user.id}` },
        () => loadAll(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friends', filter: `friend_id=eq.${user.id}` },
        () => loadAll(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadAll]);

  async function loadFriends() {
    const { data } = await supabase
      .from('friends')
      .select('*, u1:profiles!friends_user_id_fkey(id, username), u2:profiles!friends_friend_id_fkey(id, username)')
      .or(`user_id.eq.${user?.id},friend_id.eq.${user?.id}`)
      .eq('status', 'accepted');
    if (data) setFriends(data);
  }

  async function loadIncomingRequests() {
    const { data } = await supabase
      .from('friends')
      .select('*, sender:profiles!friends_user_id_fkey(id, username)')
      .eq('friend_id', user?.id)
      .eq('status', 'pending');
    if (data) setIncomingRequests(data);
  }

  async function loadSentRequests() {
    const { data } = await supabase
      .from('friends')
      .select('*, receiver:profiles!friends_friend_id_fkey(id, username)')
      .eq('user_id', user?.id)
      .eq('status', 'pending');
    if (data) setSentRequests(data);
  }

  // ─── Actions ────────────────────────────────────────────────

  async function searchUsers() {
    if (!searchQuery.trim()) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', `%${searchQuery}%`)
      .neq('id', user?.id);
    if (data) setSearchResults(data);
  }

  function getSearchResultAction(resultUserId: string) {
    // Check if this user already sent US a pending request
    const incomingFromThisUser = incomingRequests.find(
      (req) => req.sender?.id === resultUserId
    );
    if (incomingFromThisUser) {
      return { type: 'accept' as const, requestId: incomingFromThisUser.id };
    }

    // Check if WE already sent them a request
    const sentToThisUser = sentRequests.find(
      (req) => req.receiver?.id === resultUserId
    );
    if (sentToThisUser) {
      return { type: 'pending' as const, requestId: sentToThisUser.id };
    }

    // Check if already friends
    const alreadyFriends = friends.find(
      (f) => f.u1?.id === resultUserId || f.u2?.id === resultUserId
    );
    if (alreadyFriends) {
      return { type: 'friends' as const, requestId: null };
    }

    return { type: 'add' as const, requestId: null };
  }

  async function sendFriendRequest(friendId: string) {
    const { error } = await supabase
      .from('friends')
      .insert({ user_id: user?.id, friend_id: friendId, status: 'pending' });
    if (error) Alert.alert('Error', error.message);
    else {
      Alert.alert('Success', 'Friend request sent!');
      setSearchResults([]);
      setSearchQuery('');
      loadSentRequests();
    }
  }

  async function acceptRequest(requestId: string) {
    const { error } = await supabase
      .from('friends')
      .update({ status: 'accepted' })
      .eq('id', requestId);
    if (!error) {
      loadIncomingRequests();
      loadFriends();
      // Also clear search results since state changed
      if (searchResults.length > 0) searchUsers();
    }
  }

  async function rejectRequest(requestId: string) {
    const { error } = await supabase
      .from('friends')
      .delete()
      .eq('id', requestId);
    if (!error) loadIncomingRequests();
  }

  async function cancelRequest(requestId: string) {
    const { error } = await supabase
      .from('friends')
      .delete()
      .eq('id', requestId);
    if (!error) loadSentRequests();
  }

  async function removeFriend(friendshipId: string) {
    Alert.alert('Remove Friend', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('friends').delete().eq('id', friendshipId);
          loadFriends();
        },
      },
    ]);
  }

  async function handleCreateDuo(friendUsername: string) {
    if (!user) return;
    const username = user.email?.split('@')[0] || 'Host';
    const newSessionId = await createSession(user.id, username, 25, 5, true, false);
    if (newSessionId) {
      Alert.alert(
        'Duo Session Created!',
        `Share this code with ${friendUsername}:\n\n${newSessionId}\n\nThey can join from their Friends tab.`,
      );
    }
  }

  async function handleJoinDuo() {
    if (!user || !joinCode.trim()) return;
    const username = user.email?.split('@')[0] || 'Guest';
    const success = await joinSession(joinCode.trim(), user.id, username);
    if (success) {
      Alert.alert('Joined!', 'You have joined the duo session. Head to the Timer tab!');
      setJoinCode('');
    } else {
      Alert.alert('Error', 'Could not join session. Check the code and try again.');
    }
  }

  // ─── Requests Overlay ──────────────────────────────────────
  if (showRequests) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: background }]}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.headerRow}>
              <Pressable onPress={() => setShowRequests(false)}>
                <ThemedText style={{ color: primary, fontWeight: 'bold', fontSize: 16 }}>← Back</ThemedText>
              </Pressable>
              <ThemedText type="title" style={{ color: text }}>Requests</ThemedText>
              <View style={{ width: 50 }} />
            </View>

            {/* Tab toggle */}
            <View style={[styles.tabBar, { backgroundColor: backgroundElement }]}>
              <Pressable
                style={[styles.tab, requestsTab === 'received' && { backgroundColor: primary }]}
                onPress={() => setRequestsTab('received')}
              >
                <ThemedText style={[styles.tabText, requestsTab === 'received' && { color: background }]}>
                  Received ({incomingRequests.length})
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.tab, requestsTab === 'sent' && { backgroundColor: primary }]}
                onPress={() => setRequestsTab('sent')}
              >
                <ThemedText style={[styles.tabText, requestsTab === 'sent' && { color: background }]}>
                  Sent ({sentRequests.length})
                </ThemedText>
              </Pressable>
            </View>

            {/* Content */}
            {requestsTab === 'received' ? (
              <View style={{ marginTop: Spacing.three }}>
                {incomingRequests.length === 0 ? (
                  <ThemedText style={{ color: secondary, textAlign: 'center', marginTop: Spacing.four }}>
                    No incoming requests.
                  </ThemedText>
                ) : (
                  incomingRequests.map((req) => (
                    <View key={req.id} style={[styles.row, { backgroundColor: backgroundElement }]}>
                      <ThemedText style={{ color: text, fontWeight: 'bold' }}>
                        {req.sender?.username || 'Unknown'}
                      </ThemedText>
                      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                        <Pressable
                          style={[styles.btnSmall, { backgroundColor: primary }]}
                          onPress={() => acceptRequest(req.id)}
                        >
                          <ThemedText style={styles.btnText}>Accept</ThemedText>
                        </Pressable>
                        <Pressable
                          style={[styles.btnSmall, { backgroundColor: '#E74C3C' }]}
                          onPress={() => rejectRequest(req.id)}
                        >
                          <ThemedText style={styles.btnText}>Reject</ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </View>
            ) : (
              <View style={{ marginTop: Spacing.three }}>
                {sentRequests.length === 0 ? (
                  <ThemedText style={{ color: secondary, textAlign: 'center', marginTop: Spacing.four }}>
                    No pending sent requests.
                  </ThemedText>
                ) : (
                  sentRequests.map((req) => (
                    <View key={req.id} style={[styles.row, { backgroundColor: backgroundElement }]}>
                      <ThemedText style={{ color: text, fontWeight: 'bold' }}>
                        {req.receiver?.username || 'Unknown'}
                      </ThemedText>
                      <Pressable
                        style={[styles.btnSmall, { backgroundColor: '#E74C3C' }]}
                        onPress={() => cancelRequest(req.id)}
                      >
                        <ThemedText style={styles.btnText}>Cancel</ThemedText>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ─── Main Friends View ──────────────────────────────────────
  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header with Requests button */}
          <View style={styles.headerRow}>
            <ThemedText type="title" style={{ color: text }}>Friends</ThemedText>
            <Pressable
              style={[styles.requestsBtn, { backgroundColor: primary }]}
              onPress={() => setShowRequests(true)}
            >
              <ThemedText style={{ color: background, fontWeight: 'bold', fontSize: 13 }}>
                Requests{incomingRequests.length > 0 ? ` (${incomingRequests.length})` : ''}
              </ThemedText>
            </Pressable>
          </View>

          {/* Join a Duo Session */}
          <View style={[styles.section, { backgroundColor: backgroundElement }]}>
            <ThemedText style={{ fontWeight: 'bold', color: text, marginBottom: Spacing.two }}>
              🎯 Join a Duo Session
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <TextInput
                style={[styles.input, { borderColor: secondary, color: text, flex: 1 }]}
                placeholder="Paste session code..."
                placeholderTextColor={secondary}
                value={joinCode}
                onChangeText={setJoinCode}
              />
              <Pressable style={[styles.btn, { backgroundColor: primary }]} onPress={handleJoinDuo}>
                <ThemedText style={{ color: background, fontWeight: 'bold' }}>Join</ThemedText>
              </Pressable>
            </View>
          </View>

          {/* Search Users */}
          <View style={{ marginTop: Spacing.three }}>
            <ThemedText style={{ fontWeight: 'bold', color: text, marginBottom: Spacing.two }}>
              🔍 Find Friends
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <TextInput
                style={[styles.input, { borderColor: secondary, color: text, flex: 1 }]}
                placeholder="Search by username..."
                placeholderTextColor={secondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={searchUsers}
              />
              <Pressable style={[styles.btn, { backgroundColor: primary }]} onPress={searchUsers}>
                <ThemedText style={{ color: background, fontWeight: 'bold' }}>Search</ThemedText>
              </Pressable>
            </View>
          </View>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <View style={{ marginTop: Spacing.three }}>
              <ThemedText style={{ fontWeight: 'bold', marginBottom: Spacing.two, color: text }}>
                Results
              </ThemedText>
              {searchResults.map((u) => {
                const action = getSearchResultAction(u.id);
                return (
                  <View key={u.id} style={[styles.row, { backgroundColor: backgroundElement }]}>
                    <ThemedText style={{ color: text }}>{u.username}</ThemedText>
                    {action.type === 'add' && (
                      <Pressable
                        style={[styles.btnSmall, { backgroundColor: secondary }]}
                        onPress={() => sendFriendRequest(u.id)}
                      >
                        <ThemedText style={styles.btnText}>Add</ThemedText>
                      </Pressable>
                    )}
                    {action.type === 'accept' && (
                      <Pressable
                        style={[styles.btnSmall, { backgroundColor: '#27AE60' }]}
                        onPress={() => acceptRequest(action.requestId!)}
                      >
                        <ThemedText style={styles.btnText}>Accept Req</ThemedText>
                      </Pressable>
                    )}
                    {action.type === 'pending' && (
                      <View style={[styles.btnSmall, { backgroundColor: secondary, opacity: 0.6 }]}>
                        <ThemedText style={styles.btnText}>Pending</ThemedText>
                      </View>
                    )}
                    {action.type === 'friends' && (
                      <View style={[styles.btnSmall, { backgroundColor: '#27AE60', opacity: 0.6 }]}>
                        <ThemedText style={styles.btnText}>Friends ✓</ThemedText>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* My Friends */}
          <View style={{ marginTop: Spacing.four, marginBottom: Spacing.six }}>
            <ThemedText style={{ fontWeight: 'bold', marginBottom: Spacing.two, color: text }}>
              👥 My Friends
            </ThemedText>
            {friends.length === 0 ? (
              <ThemedText style={{ color: secondary }}>No friends yet. Search and add someone!</ThemedText>
            ) : (
              friends.map((item) => {
                const friend = item.user_id === user?.id ? item.u2 : item.u1;
                return (
                  <View key={item.id} style={[styles.row, { backgroundColor: backgroundElement }]}>
                    <ThemedText style={{ color: text, fontWeight: 'bold' }}>{friend?.username}</ThemedText>
                    <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                      <Pressable
                        style={[styles.btnSmall, { backgroundColor: primary }]}
                        onPress={() => handleCreateDuo(friend?.username || '')}
                      >
                        <ThemedText style={styles.btnText}>Start Duo</ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.btnSmall, { backgroundColor: '#E74C3C' }]}
                        onPress={() => removeFriend(item.id)}
                      >
                        <ThemedText style={styles.btnText}>Remove</ThemedText>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.four },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  requestsBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 20,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  tabText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  section: { padding: Spacing.three, borderRadius: Spacing.two },
  input: { borderWidth: 1, padding: Spacing.two, borderRadius: Spacing.two },
  btn: { padding: Spacing.two, borderRadius: Spacing.two, justifyContent: 'center' },
  btnSmall: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Spacing.two },
  btnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
  },
});
