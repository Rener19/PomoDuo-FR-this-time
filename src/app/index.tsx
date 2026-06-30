import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Pressable, Modal, ScrollView, Alert, AppState, LayoutAnimation } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimerRing } from '@/components/TimerRing';
import { ScrollPicker } from '@/components/ScrollPicker';
import { DuoTimer } from '@/components/DuoTimer';
import { useTimerStore } from '@/store/timerStore';
import { useDuoStore } from '@/store/duoStore';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { Spacing, Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import BackgroundTimer from 'react-native-background-timer';
import { safeSetInterval, safeClearInterval } from '@/lib/timerUtils';

export default function HomeScreen() {
  const { isRunning, start, pause, reset, tick, syncFromBackground, mode, switchMode, totalFocusTime, breakTime, setTotalFocusTime, setBreakTime, timeLeft } = useTimerStore();
  const duo = useDuoStore();
  const { user, profile } = useAuthStore();
  const theme = useTheme();
  const { background, text: textColor, primary, secondary, backgroundElement, success, destructive } = theme;

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);

  // All hooks must run before any conditional returns
  useEffect(() => {
    syncFromBackground();
    let interval: any;
    const isDuoActive = duo.sessionId && !duo.waitingForFriends;
    if (isRunning && !isDuoActive) {
      interval = safeSetInterval(() => tick(), 1000);
    }
    return () => safeClearInterval(interval);
  }, [isRunning, duo.sessionId, duo.waitingForFriends]);

  // Handle app background/foreground for solo timer
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const isDuoActive = duo.sessionId && !duo.waitingForFriends;
      if (nextAppState === 'active' && !isDuoActive) {
        syncFromBackground();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [syncFromBackground, duo.sessionId, duo.waitingForFriends]);

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

  async function handleIndividualInvite(friendId: string) {
    if (!user || !profile) return;
    const username = profile.username || 'Host';
    const currentTimer = useTimerStore.getState();
    
    if (!duo.sessionId) {
      await duo.inviteFriends(
        user.id,
        username,
        [friendId],
        currentTimer.totalFocusTime,
        currentTimer.breakTime,
        currentTimer.mode,
        currentTimer.timeLeft,
        currentTimer.isRunning
      );
    } else {
      await duo.inviteMoreFriends(user.id, [friendId]);
    }
  }

  async function handleCancelInvite(friendId: string) {
    await duo.cancelSentInvite(friendId);
  }

  async function handleAcceptInvite(invite: any) {
    if (!user || !profile) return;
    const username = profile.username || 'User';
    const success = await duo.acceptInvite(invite, user.id, username);
    if (!success) Alert.alert('Error', 'Could not join session.');
  }

  // ─── Duo Mode ──────────────────────────────────────────────
  const isDuoActive = duo.sessionId && !duo.waitingForFriends;
  
  if (isDuoActive) {
    return <DuoTimer onLeave={() => { if (user) duo.leaveSession(user.id); }} />;
  }

  // ─── Solo / Waiting Mode ───────────────────────────────────
  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.responsiveWrapper}>

        <View style={styles.bannerContainer}>
          {/* Pending invites banner */}
          {duo.pendingInvites.length > 0 && (
            <ThemedView type="primary" style={styles.inviteBanner}>
              <ThemedText style={{ color: '#fff', fontWeight: 'bold', fontSize: 14, marginBottom: Spacing.two }}>
                🔔 You have {duo.pendingInvites.length} session invite{duo.pendingInvites.length > 1 ? 's' : ''}
              </ThemedText>
              {duo.pendingInvites.map((inv) => (
                <View key={inv.id} style={styles.inviteRow}>
                  <ThemedText style={{ color: '#fff', flex: 1 }}>
                    {inv.inviter?.username || 'Someone'} invited you
                  </ThemedText>
                  <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                    <Pressable style={[styles.inviteBtn, { backgroundColor: success }]} onPress={() => handleAcceptInvite(inv)}>
                      <ThemedText style={{ color: '#fff', fontSize: 12, fontFamily: Fonts.sansBold }}>Accept</ThemedText>
                    </Pressable>
                    <Pressable style={[styles.inviteBtn, { backgroundColor: destructive }]} onPress={() => duo.declineInvite(inv.id)}>
                      <ThemedText style={{ color: '#fff', fontSize: 12, fontFamily: Fonts.sansBold }}>Decline</ThemedText>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ThemedView>
          )}


        </View>

        <ThemedText type="title" themeColor="primary" style={styles.title}>
          Pomodoro
        </ThemedText>

        <ThemedView style={[styles.timerContainer, { backgroundColor: 'transparent', flex: 2 }]}>
          <TimerRing />
        </ThemedView>

        {/* Time Settings */}
        {!isRunning && (
          <View style={{ flex: 1, justifyContent: 'center', width: '100%' }}>
            <View style={[styles.timeSettingsRow, { marginBottom: 0 }]}>
              <View style={styles.timeSetting}>
                <ThemedText style={{ color: secondary, fontSize: 12, fontFamily: Fonts.sansBold }}>FOCUS</ThemedText>
                <View style={{ width: 120, height: 60, marginTop: 4 }}>
                  <ScrollPicker
                    items={Array.from({ length: 60 }, (_, i) => i + 1)}
                    selectedValue={totalFocusTime}
                    onValueChange={(val) => setTotalFocusTime(val)}
                    textColor={textColor}
                    itemWidth={40}
                  />
                </View>
              </View>
              <View style={styles.timeSetting}>
                <ThemedText style={{ color: secondary, fontSize: 12, fontFamily: Fonts.sansBold }}>BREAK</ThemedText>
                <View style={{ width: 120, height: 60, marginTop: 4 }}>
                  <ScrollPicker
                    items={Array.from({ length: 60 }, (_, i) => i + 1)}
                    selectedValue={breakTime}
                    onValueChange={(val) => setBreakTime(val)}
                    textColor={textColor}
                    itemWidth={40}
                  />
                </View>
              </View>
            </View>
          </View>
        )}

        <ThemedView style={[styles.controls, { backgroundColor: 'transparent' }]}>
          <View style={[styles.controls, { backgroundColor: 'transparent' }]}>
            <>
              <Pressable style={{ width: '80%' }} onPress={isRunning ? pause : start}>
                <ThemedView type="primary" style={[styles.button, { width: '100%' }]}>
                  <ThemedText themeColor="background" style={{ fontFamily: Fonts.sansBold, fontSize: 18, letterSpacing: 1 }}>
                    {isRunning ? 'PAUSE' : 'START'}
                  </ThemedText>
                </ThemedView>
              </Pressable>

              <Pressable style={[styles.buttonSecondary, { borderColor: secondary }]} onPress={reset}>
                <ThemedText style={{ color: textColor, fontFamily: Fonts.sansBold, fontSize: 16 }}>RESET</ThemedText>
              </Pressable>

              <Pressable style={[styles.buttonSecondary, { borderColor: secondary }]} onPress={switchMode}>
                <ThemedText style={{ color: textColor, fontFamily: Fonts.sansBold, fontSize: 16 }}>
                  SWITCH TO {mode === 'focus' ? 'BREAK' : 'FOCUS'}
                </ThemedText>
              </Pressable>
              <Pressable style={{ width: '80%' }} onPress={() => setShowInviteModal(true)}>
                <ThemedView type="success" style={[styles.button, { width: '100%' }]}>
                  <ThemedText style={{ color: '#fff', fontFamily: Fonts.sansBold, fontSize: 16 }}>
                    Invite Friends to Session
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </>
          </View>
        </ThemedView>

        {/* Invite Friends Modal */}
        <Modal visible={showInviteModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: background }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three }}>
                <ThemedText type="title" style={{ color: textColor, fontSize: 22, fontFamily: Fonts.serifBold }}>Invite Friends</ThemedText>
                <Pressable onPress={() => setShowInviteModal(false)}>
                  <ThemedText style={{ color: destructive, fontFamily: Fonts.sansBold, fontSize: 16 }}>Close</ThemedText>
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
                    const isInvited = duo.sentInvites.includes(friend.id);
                    return (
                      <ThemedView key={friend.id} type="backgroundElement" style={[styles.friendRow, { paddingVertical: Spacing.two }]}>
                        <ThemedText themeColor="text" style={{ fontFamily: Fonts.sansBold, flex: 1 }}>
                          {friend.username}
                        </ThemedText>
                        
                        {isInvited ? (
                          <Pressable style={[styles.inviteBtn, { backgroundColor: destructive }]} onPress={() => handleCancelInvite(friend.id)}>
                            <ThemedText style={{ color: '#fff', fontFamily: Fonts.sansBold, fontSize: 12 }}>Cancel</ThemedText>
                          </Pressable>
                        ) : (
                          <Pressable style={[styles.inviteBtn, { backgroundColor: success }]} onPress={() => handleIndividualInvite(friend.id)}>
                            <ThemedText style={{ color: '#fff', fontFamily: Fonts.sansBold, fontSize: 12 }}>Invite</ThemedText>
                          </Pressable>
                        )}
                      </ThemedView>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  responsiveWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  title: {
    fontFamily: Fonts.serifBold,
    fontSize: 48,
    letterSpacing: -0.5,
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
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    paddingVertical: Spacing.two,
    borderRadius: 30,
    borderWidth: 1.5,
    width: '80%',
    alignItems: 'center',
  },
  bannerContainer: {
    position: 'absolute',
    bottom: Spacing.four,
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
