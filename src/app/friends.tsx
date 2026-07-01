import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, TextInput, Pressable, Alert, ScrollView, Modal, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useDuoStore } from '@/store/duoStore';
import { useTimerStore } from '@/store/timerStore';
import { router } from 'expo-router';

export default function FriendsScreen() {
  const theme = useTheme();
  const { background, text, primary, secondary, backgroundElement, success, destructive } = theme;
  const { user, profile } = useAuthStore();
  const { pendingInvites, acceptInvite, declineInvite } = useDuoStore();

  const [showRequests, setShowRequests] = useState(false);
  const [requestsTab, setRequestsTab] = useState<'received' | 'sent'>('received');
  const [friendToRemove, setFriendToRemove] = useState<{ id: string; username: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showToast = (message: string) => {
    setToastMessage(message);
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start(() => {
      setToastMessage(null);
    });
  };

  const loadAll = useCallback(() => {
    if (!user) return;
    loadFriends();
    loadIncomingRequests();
    loadSentRequests();
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Realtime sync
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('friends-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends', filter: `user_id=eq.${user.id}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends', filter: `friend_id=eq.${user.id}` }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
    const incomingFromThisUser = incomingRequests.find((req) => req.sender?.id === resultUserId);
    if (incomingFromThisUser) return { type: 'accept' as const, requestId: incomingFromThisUser.id };
    const sentToThisUser = sentRequests.find((req) => req.receiver?.id === resultUserId);
    if (sentToThisUser) return { type: 'pending' as const, requestId: sentToThisUser.id };
    const alreadyFriends = friends.find((f) => f.u1?.id === resultUserId || f.u2?.id === resultUserId);
    if (alreadyFriends) return { type: 'friends' as const, requestId: null };
    return { type: 'add' as const, requestId: null };
  }

  async function sendFriendRequest(friendId: string, username: string) {
    const { error } = await supabase
      .from('friends')
      .insert({ user_id: user?.id, friend_id: friendId, status: 'pending' });
    if (error) Alert.alert('Error', error.message);
    else { 
      showToast(`Request to ${username} sent`); 
      setSearchResults([]); 
      setSearchQuery(''); 
      loadSentRequests(); 
    }
  }

  async function acceptFriendRequest(requestId: string) {
    const { error } = await supabase.from('friends').update({ status: 'accepted' }).eq('id', requestId);
    if (!error) { loadIncomingRequests(); loadFriends(); if (searchResults.length > 0) searchUsers(); }
  }

  async function rejectRequest(requestId: string) {
    await supabase.from('friends').delete().eq('id', requestId);
    loadIncomingRequests();
  }

  async function cancelRequest(requestId: string) {
    await supabase.from('friends').delete().eq('id', requestId);
    loadSentRequests();
  }

  async function removeFriend(friendshipId: string) {
    await supabase.from('friends').delete().eq('id', friendshipId);
    setFriendToRemove(null);
    loadFriends();
  }

  async function handleAcceptSessionInvite(invite: any) {
    if (!user || !profile) return;
    const username = profile.username || 'User';
    
    // Navigate immediately to show the connecting screen
    router.navigate('/');
    
    const success = await acceptInvite(invite, user.id, username);
    if (!success) {
      Alert.alert('Error', 'Could not join session.');
    }
  }

  // ─── Requests Overlay ──────────────────────────────────────
  if (showRequests) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.responsiveWrapper}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.headerRow}>
              <Pressable onPress={() => setShowRequests(false)}>
                <ThemedText style={{ color: primary, fontFamily: Fonts.sansBold, fontSize: 16 }}>← Back</ThemedText>
              </Pressable>
              <ThemedText type="title" style={{ color: text }}>Requests</ThemedText>
              <View style={{ width: 50 }} />
            </View>

            <View style={[styles.tabBar, { backgroundColor: backgroundElement }]}>
              <Pressable style={[styles.tab, requestsTab === 'received' && { backgroundColor: primary }]} onPress={() => setRequestsTab('received')}>
                <ThemedText style={[styles.tabText, requestsTab === 'received' && { color: background }]}>Received ({incomingRequests.length})</ThemedText>
              </Pressable>
              <Pressable style={[styles.tab, requestsTab === 'sent' && { backgroundColor: primary }]} onPress={() => setRequestsTab('sent')}>
                <ThemedText style={[styles.tabText, requestsTab === 'sent' && { color: background }]}>Sent ({sentRequests.length})</ThemedText>
              </Pressable>
            </View>

            {requestsTab === 'received' ? (
              <View style={{ marginTop: Spacing.three }}>
                {incomingRequests.length === 0 ? (
                  <ThemedText style={{ color: secondary, textAlign: 'center', marginTop: Spacing.four }}>No incoming requests.</ThemedText>
                ) : (
                  incomingRequests.map((req) => (
                    <View key={req.id} style={[styles.row, { backgroundColor: backgroundElement }]}>
                      <ThemedText style={{ color: text, fontFamily: Fonts.sansBold }}>{req.sender?.username || 'Unknown'}</ThemedText>
                      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                        <Pressable style={[styles.btnSmall, { backgroundColor: success }]} onPress={() => acceptFriendRequest(req.id)}>
                          <ThemedText style={styles.btnText}>Accept</ThemedText>
                        </Pressable>
                        <Pressable style={[styles.btnSmall, { backgroundColor: destructive }]} onPress={() => rejectRequest(req.id)}>
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
                  <ThemedText style={{ color: secondary, textAlign: 'center', marginTop: Spacing.four }}>No pending sent requests.</ThemedText>
                ) : (
                  sentRequests.map((req) => (
                    <View key={req.id} style={[styles.row, { backgroundColor: backgroundElement }]}>
                      <ThemedText style={{ color: text, fontFamily: Fonts.sansBold }}>{req.receiver?.username || 'Unknown'}</ThemedText>
                      <Pressable style={[styles.btnSmall, { backgroundColor: destructive }]} onPress={() => cancelRequest(req.id)}>
                        <ThemedText style={styles.btnText}>Cancel</ThemedText>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            )}
          </ScrollView>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ─── Main Friends View ──────────────────────────────────────

  // Separate friends who have sent session invites to show them at the top
  const friendsWithInvites: any[] = [];
  const regularFriends: any[] = [];

  friends.forEach((item) => {
    const friend = item.user_id === user?.id ? item.u2 : item.u1;
    if (!friend) return;
    const hasInvite = pendingInvites.find((inv) => inv.inviter_id === friend.id);
    if (hasInvite) {
      friendsWithInvites.push({ ...item, _invite: hasInvite, _friend: friend });
    } else {
      regularFriends.push({ ...item, _friend: friend });
    }
  });

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.responsiveWrapper}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.headerRow}>
            <ThemedText type="title" style={{ color: text }}>Friends</ThemedText>
            <Pressable style={[styles.requestsBtn, { backgroundColor: primary }]} onPress={() => setShowRequests(true)}>
              <ThemedText style={{ color: background, fontFamily: Fonts.sansBold, fontSize: 13 }}>
                Requests{incomingRequests.length > 0 ? ` (${incomingRequests.length})` : ''}
              </ThemedText>
            </Pressable>
          </View>

          {/* Search */}
          <View style={{ marginBottom: Spacing.three }}>
            <ThemedText style={{ fontFamily: Fonts.sansBold, color: text, marginBottom: Spacing.two }}>🔍 Find Friends</ThemedText>
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
                <ThemedText style={{ color: background, fontFamily: Fonts.sansBold }}>Search</ThemedText>
              </Pressable>
            </View>
          </View>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <View style={{ marginBottom: Spacing.three }}>
              <ThemedText style={{ fontFamily: Fonts.sansBold, marginBottom: Spacing.two, color: text }}>Results</ThemedText>
              {searchResults.map((u) => {
                const action = getSearchResultAction(u.id);
                return (
                  <View key={u.id} style={[styles.row, { backgroundColor: backgroundElement }]}>
                    <ThemedText style={{ color: text }}>{u.username}</ThemedText>
                    {action.type === 'add' && (
                      <Pressable style={[styles.btnSmall, { backgroundColor: secondary }]} onPress={() => sendFriendRequest(u.id, u.username)}>
                        <ThemedText style={styles.btnText}>Add</ThemedText>
                      </Pressable>
                    )}
                    {action.type === 'accept' && (
                      <Pressable style={[styles.btnSmall, { backgroundColor: success }]} onPress={() => acceptFriendRequest(action.requestId!)}>
                        <ThemedText style={styles.btnText}>Accept Req</ThemedText>
                      </Pressable>
                    )}
                    {action.type === 'pending' && (
                      <View style={[styles.btnSmall, { backgroundColor: secondary, opacity: 0.6 }]}>
                        <ThemedText style={styles.btnText}>Pending</ThemedText>
                      </View>
                    )}
                    {action.type === 'friends' && (
                      <View style={[styles.btnSmall, { backgroundColor: success, opacity: 0.6 }]}>
                        <ThemedText style={styles.btnText}>Friends ✓</ThemedText>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Friends who invited you to a session — shown at the TOP */}
          {friendsWithInvites.length > 0 && (
            <View style={{ marginBottom: Spacing.three }}>
              <ThemedText style={{ fontFamily: Fonts.sansBold, marginBottom: Spacing.two, color: text }}>🔔 Session Invites</ThemedText>
              {friendsWithInvites.map((item) => (
                <View key={item.id} style={[styles.row, { backgroundColor: backgroundElement, borderWidth: 2, borderColor: primary }]}>
                  <View>
                    <ThemedText style={{ color: text, fontFamily: Fonts.sansBold }}>{item._friend.username}</ThemedText>
                    <ThemedText style={{ color: secondary, fontSize: 11 }}>Invited you to focus together!</ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                    <Pressable style={[styles.btnSmall, { backgroundColor: success }]} onPress={() => handleAcceptSessionInvite(item._invite)}>
                      <ThemedText style={styles.btnText}>Join</ThemedText>
                    </Pressable>
                    <Pressable style={[styles.btnSmall, { backgroundColor: destructive }]} onPress={() => declineInvite(item._invite.id)}>
                      <ThemedText style={styles.btnText}>Decline</ThemedText>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Regular Friends */}
          <View style={{ marginBottom: Spacing.six }}>
            <ThemedText style={{ fontFamily: Fonts.sansBold, marginBottom: Spacing.two, color: text }}>👥 My Friends</ThemedText>
            {regularFriends.length === 0 && friendsWithInvites.length === 0 ? (
              <ThemedText style={{ color: secondary }}>No friends yet. Search and add someone!</ThemedText>
            ) : (
              regularFriends.map((item) => (
                <View key={item.id} style={[styles.row, { backgroundColor: backgroundElement }]}>
                  <ThemedText style={{ color: text, fontFamily: Fonts.sansBold }}>{item._friend.username}</ThemedText>
                  <Pressable style={[styles.btnSmall, { backgroundColor: destructive }]} onPress={() => setFriendToRemove({ id: item.id, username: item._friend.username })}>
                    <ThemedText style={styles.btnText}>Remove</ThemedText>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </ScrollView>
        </View>
      </SafeAreaView>

      {/* Remove Friend Modal */}
      <Modal visible={!!friendToRemove} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: background }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three }}>
              <ThemedText type="title" style={{ color: text, fontSize: 22, fontFamily: Fonts.serifBold }}>Remove Friend</ThemedText>
              <Pressable onPress={() => setFriendToRemove(null)}>
                <ThemedText style={{ color: secondary, fontFamily: Fonts.sansBold, fontSize: 16 }}>Cancel</ThemedText>
              </Pressable>
            </View>

            <ThemedText style={{ color: text, fontFamily: Fonts.sans, marginBottom: Spacing.four, fontSize: 16 }}>
              Are you sure you want to remove <ThemedText style={{ fontFamily: Fonts.sansBold }}>{friendToRemove?.username}</ThemedText> from your friends list?
            </ThemedText>

            <Pressable 
              style={{ backgroundColor: destructive, paddingVertical: Spacing.three, borderRadius: Spacing.three, alignItems: 'center' }} 
              onPress={() => { if (friendToRemove) removeFriend(friendToRemove.id); }}
            >
              <ThemedText style={{ color: '#fff', fontFamily: Fonts.sansBold, fontSize: 16 }}>
                Yes, Remove
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Toast Notification */}
      {!!toastMessage && (
        <Animated.View style={[styles.toastContainer, { opacity: toastOpacity }]} pointerEvents="none">
          <View style={[styles.toastContent, { backgroundColor: primary }]}>
            <ThemedText style={{ color: '#fff', fontFamily: Fonts.sansBold }}>{toastMessage}</ThemedText>
          </View>
        </Animated.View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignItems: 'center' },
  responsiveWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three },
  requestsBtn: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 20 },
  tabBar: { flexDirection: 'row', borderRadius: 20, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: Spacing.two, alignItems: 'center' },
  tabText: { fontFamily: Fonts.sansBold, fontSize: 14 },
  input: { borderWidth: 1, padding: Spacing.two, borderRadius: Spacing.two },
  btn: { padding: Spacing.two, borderRadius: Spacing.two, justifyContent: 'center' },
  btnSmall: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Spacing.two },
  btnText: { color: '#fff', fontSize: 12, fontFamily: Fonts.sansBold },
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 200,
  },
  toastContent: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});
