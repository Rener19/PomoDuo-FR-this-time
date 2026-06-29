import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Pressable, Modal, ScrollView, Alert, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimerRing } from '@/components/TimerRing';
import { DuoTimer } from '@/components/DuoTimer';
import { useTimerStore } from '@/store/timerStore';
import { useDuoStore } from '@/store/duoStore';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const { isRunning, start, pause, reset, tick, syncFromBackground, mode, switchMode, totalFocusTime, breakTime, setTotalFocusTime, setBreakTime, timeLeft } = useTimerStore();
  const duo = useDuoStore();
  const { user } = useAuthStore();
  const { background, text: textColor, primary, secondary, backgroundElement } = useTheme();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

  // All hooks must run before any conditional returns
  useEffect(() => {
    syncFromBackground();
    let interval: ReturnType<typeof setInterval>;
    if (isRunning && !duo.sessionId) {
      interval = setInterval(() => tick(), 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, duo.sessionId]);

  // Handle app background/foreground for solo timer
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && !duo.sessionId) {
        syncFromBackground();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [syncFromBackground, duo.sessionId]);

  // Subscribe to invites when user is logged in
  useEffect(() => {
    if (user) {
      duo.loadPendingInvites(user.id);
      duo.subscribeToInvites(user.id);
    }
    return () => duo.unsubscribeFromInvites();
  }, [user?.id]);

  // Load friends when invite modal opens
  useEffect(() => {
    if (showInviteModal && user) {
      loadFriends();
    }
  }, [showInviteModal]);

  async function loadFriends() {
    const { data } = await supabase
      .from('friends')
      .select('*, u1:profiles!friends_user_id_fkey(id, username), u2:profiles!friends_friend_id_fkey(id, username)')
      .or(`user_id.eq.${user?.id},friend_id.eq.${user?.id}`)
      .eq('status', 'accepted');
    if (data) setFriends(data);
  }

  function toggleFriend(friendId: string) {
    setSelectedFriends((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  }

  async function handleSendInvites() {
    if (!user || selectedFriends.length === 0) return;
    const username = user.email?.split('@')[0] || 'Host';
    const currentTimer = useTimerStore.getState();
    await duo.inviteFriends(
      user.id,
      username,
      selectedFriends,
      currentTimer.totalFocusTime,
      currentTimer.breakTime,
      currentTimer.mode,
      currentTimer.timeLeft,
      currentTimer.isRunning
    );
    setShowInviteModal(false);
    setSelectedFriends([]);
  }

  async function handleAcceptInvite(invite: any) {
    if (!user) return;
    const username = user.email?.split('@')[0] || 'User';
    const success = await duo.acceptInvite(invite, user.id, username);
    if (!success) Alert.alert('Error', 'Could not join session.');
  }

  // ─── Duo Mode ──────────────────────────────────────────────
  if (duo.sessionId) {
    return <DuoTimer onLeave={() => { if (user) duo.leaveSession(user.id); }} />;
  }

  // ─── Solo / Waiting Mode ───────────────────────────────────
  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <SafeAreaView style={styles.safeArea}>

        <View style={styles.bannerContainer}>
          {/* Pending invites banner */}
          {duo.pendingInvites.length > 0 && (
            <View style={[styles.inviteBanner, { backgroundColor: primary }]}>
              <ThemedText style={{ color: '#fff', fontWeight: 'bold', fontSize: 14, marginBottom: Spacing.two }}>
                🔔 You have {duo.pendingInvites.length} session invite{duo.pendingInvites.length > 1 ? 's' : ''}
              </ThemedText>
              {duo.pendingInvites.map((inv) => (
                <View key={inv.id} style={styles.inviteRow}>
                  <ThemedText style={{ color: '#fff', flex: 1 }}>
                    {inv.inviter?.username || 'Someone'} invited you
                  </ThemedText>
                  <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                    <Pressable style={[styles.inviteBtn, { backgroundColor: '#27AE60' }]} onPress={() => handleAcceptInvite(inv)}>
                      <ThemedText style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Accept</ThemedText>
                    </Pressable>
                    <Pressable style={[styles.inviteBtn, { backgroundColor: '#E74C3C' }]} onPress={() => duo.declineInvite(inv.id)}>
                      <ThemedText style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Decline</ThemedText>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}


        </View>

        <ThemedText type="title" style={[styles.title, { color: textColor }]}>
          PomoDuo
        </ThemedText>

        <ThemedView style={[styles.timerContainer, { backgroundColor: 'transparent' }]}>
          <TimerRing />
        </ThemedView>

        {/* Time Settings */}
        {!isRunning && !duo.waitingForFriends && (
          <View style={styles.timeSettingsRow}>
            <View style={styles.timeSetting}>
              <ThemedText style={{ color: secondary, fontSize: 12, fontWeight: 'bold' }}>FOCUS</ThemedText>
              <View style={styles.timeAdjuster}>
                <Pressable onPress={() => setTotalFocusTime(Math.max(1, totalFocusTime - 1))}>
                  <ThemedText style={{ color: textColor, fontSize: 24, paddingHorizontal: 10 }}>-</ThemedText>
                </Pressable>
                <ThemedText style={{ color: textColor, fontSize: 18, fontWeight: 'bold', width: 40, textAlign: 'center' }}>
                  {totalFocusTime}
                </ThemedText>
                <Pressable onPress={() => setTotalFocusTime(Math.min(120, totalFocusTime + 1))}>
                  <ThemedText style={{ color: textColor, fontSize: 24, paddingHorizontal: 10 }}>+</ThemedText>
                </Pressable>
              </View>
            </View>
            <View style={styles.timeSetting}>
              <ThemedText style={{ color: secondary, fontSize: 12, fontWeight: 'bold' }}>BREAK</ThemedText>
              <View style={styles.timeAdjuster}>
                <Pressable onPress={() => setBreakTime(Math.max(1, breakTime - 1))}>
                  <ThemedText style={{ color: textColor, fontSize: 24, paddingHorizontal: 10 }}>-</ThemedText>
                </Pressable>
                <ThemedText style={{ color: textColor, fontSize: 18, fontWeight: 'bold', width: 40, textAlign: 'center' }}>
                  {breakTime}
                </ThemedText>
                <Pressable onPress={() => setBreakTime(Math.min(60, breakTime + 1))}>
                  <ThemedText style={{ color: textColor, fontSize: 24, paddingHorizontal: 10 }}>+</ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        <ThemedView style={[styles.controls, { backgroundColor: 'transparent' }]}>
          {!duo.waitingForFriends && (
            <>
              <Pressable
                style={[styles.button, { backgroundColor: primary }]}
                onPress={isRunning ? pause : start}
              >
                <ThemedText style={{ color: background, fontWeight: 'bold', fontSize: 18, letterSpacing: 1 }}>
                  {isRunning ? 'PAUSE' : 'START'}
                </ThemedText>
              </Pressable>

              <Pressable style={[styles.buttonSecondary, { borderColor: secondary }]} onPress={reset}>
                <ThemedText style={{ color: textColor, fontWeight: 'bold', fontSize: 16 }}>RESET</ThemedText>
              </Pressable>

              <Pressable style={[styles.buttonSecondary, { borderColor: secondary }]} onPress={switchMode}>
                <ThemedText style={{ color: textColor, fontWeight: 'bold', fontSize: 16 }}>
                  SWITCH TO {mode === 'focus' ? 'BREAK' : 'FOCUS'}
                </ThemedText>
              </Pressable>

              {/* Invite Friends Button */}
              <Pressable
                style={[styles.button, { backgroundColor: '#27AE60' }]}
                onPress={() => setShowInviteModal(true)}
              >
                <ThemedText style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                  👥 Invite Friends to Session
                </ThemedText>
              </Pressable>
            </>
          )}
        </ThemedView>

        {/* Invite Friends Modal */}
        <Modal visible={showInviteModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: background }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three }}>
                <ThemedText type="title" style={{ color: textColor, fontSize: 22 }}>Invite Friends</ThemedText>
                <Pressable onPress={() => { setShowInviteModal(false); setSelectedFriends([]); }}>
                  <ThemedText style={{ color: '#E74C3C', fontWeight: 'bold', fontSize: 16 }}>Close</ThemedText>
                </Pressable>
              </View>

              <ScrollView style={{ maxHeight: 400 }}>
                {friends.length === 0 ? (
                  <ThemedText style={{ color: secondary, textAlign: 'center', marginTop: Spacing.four }}>
                    No friends yet. Add friends first!
                  </ThemedText>
                ) : (
                  friends.map((item) => {
                    const friend = item.user_id === user?.id ? item.u2 : item.u1;
                    if (!friend) return null;
                    const isSelected = selectedFriends.includes(friend.id);
                    return (
                      <Pressable
                        key={friend.id}
                        style={[styles.friendRow, { backgroundColor: isSelected ? primary : backgroundElement }]}
                        onPress={() => toggleFriend(friend.id)}
                      >
                        <ThemedText style={{ color: isSelected ? '#fff' : textColor, fontWeight: 'bold' }}>
                          {friend.username}
                        </ThemedText>
                        <ThemedText style={{ color: isSelected ? '#fff' : secondary, fontSize: 20 }}>
                          {isSelected ? '✓' : '○'}
                        </ThemedText>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>

              {selectedFriends.length > 0 && (
                <Pressable
                  style={[styles.button, { backgroundColor: primary, marginTop: Spacing.three }]}
                  onPress={handleSendInvites}
                >
                  <ThemedText style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                    Send Invite to {selectedFriends.length} friend{selectedFriends.length > 1 ? 's' : ''}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: Spacing.four,
  },
  timeSettingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.six,
  },
  timeSetting: {
    alignItems: 'center',
  },
  timeAdjuster: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  controls: {
    gap: Spacing.three,
    alignItems: 'center',
    width: '100%',
    paddingBottom: Spacing.four,
  },
  button: {
    paddingVertical: Spacing.three,
    borderRadius: 30,
    width: '80%',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    paddingVertical: Spacing.two,
    borderRadius: 30,
    borderWidth: 2,
    width: '80%',
    alignItems: 'center',
  },
  bannerContainer: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.four,
    right: Spacing.four,
    zIndex: 100,
    gap: Spacing.two,
  },
  inviteBanner: {
    width: '100%',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  inviteBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
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
  friendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
  },
});
