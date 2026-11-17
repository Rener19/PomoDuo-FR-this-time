import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from './authStore';
import { useTimerStore } from './timerStore';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import notifee, { AndroidImportance } from 'react-native-notify-kit';

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}

export interface SessionInvite {
  id: string;
  session_id: string;
  inviter_id: string;
  invitee_id: string;
  status: string;
  created_at: string;
  inviter?: { id: string; username: string };
  session?: { focus_time_minutes: number; break_time_minutes: number };
}

interface DuoState {
  // Session
  sessionId: string | null;
  hostId: string | null;
  isHost: boolean;
  participants: { id: string; username: string }[];
  waitingForFriends: boolean;
  sessionStartTime: number | null;
  completedFocusMinutes: number;
  completedBreakMinutes: number;
  kickedModalVisible: boolean;
  kickedUserIds: string[];
  hasReceivedInitialSync: boolean;
  isConnectingToSession: boolean;
  
  // Actions
  setKickedModalVisible: (visible: boolean) => void;
  kickParticipant: (userId: string, username: string) => void;


  // Timer (synced via Realtime)
  focusTime: number;
  breakTime: number;
  timeLeft: number;
  mode: 'focus' | 'break';
  isRunning: boolean;
  targetEndTime: number | null;
  savedFocusTimeLeft: number | null;
  savedBreakTimeLeft: number | null;

  // Chat
  chatMessages: ChatMessage[];
  isChatEnabled: boolean;
  chatOnlyOnBreak: boolean;

  // Invites
  pendingInvites: SessionInvite[];
  sentInvites: string[];

  // Realtime
  channel: RealtimeChannel | null;
  inviteChannel: RealtimeChannel | null;

  // Invite actions
  loadPendingInvites: (userId: string) => Promise<void>;
  inviteFriends: (hostId: string, hostUsername: string, friendIds: string[], focusMin: number, breakMin: number, mode?: 'focus' | 'break', timeLeft?: number, isRunning?: boolean) => Promise<void>;
  inviteMoreFriends: (hostId: string, friendIds: string[]) => Promise<void>;
  acceptInvite: (invite: SessionInvite, userId: string, username: string) => Promise<boolean>;
  declineInvite: (inviteId: string) => Promise<void>;
  cancelSentInvite: (friendId: string) => Promise<void>;
  subscribeToInvites: (userId: string) => void;
  unsubscribeFromInvites: () => void;

  // Session actions
  joinSessionChannel: (sessionId: string, userId: string, username: string, focusMin: number, breakMin: number, chatEnabled: boolean, chatOnBreak: boolean, asHost: boolean, initialMode?: 'focus' | 'break', initialTimeLeft?: number, initialIsRunning?: boolean) => Promise<void>;
  leaveSession: (userId: string) => void;

  // Host timer controls
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  switchMode: () => void;
  setFocusTime: (minutes: number) => void;
  setBreakTime: (minutes: number) => void;

  // Chat
  sendMessage: (userId: string, username: string, text: string) => void;
  toggleChat: (enabled: boolean) => void;
  toggleChatOnBreak: (enabled: boolean) => void;

  // Local tick
  tick: () => void;
  syncFromBackground: () => void;
  syncChatMessages: () => Promise<void>;
  cleanupGhostSessions: (userId: string) => Promise<void>;
}

function setupChannel(channel: RealtimeChannel, set: any, get: any) {
  channel
    .on('broadcast', { event: 'host_changed' }, ({ payload }) => {
      if (payload.newHostId) {
        set({ hostId: payload.newHostId });
        const currentUser = useAuthStore.getState().user;
        if (currentUser && currentUser.id === payload.newHostId) {
          set({ isHost: true });
        }
      }
    })
    .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
      const msg = payload as ChatMessage;
      // Deduplicate: skip if we already added this message optimistically
      set((state: DuoState) => {
        if (state.chatMessages.find((m) => m.id === msg.id)) return state;
        
        if (AppState.currentState === 'background' || AppState.currentState === 'inactive') {
          notifee.createChannel({
            id: 'pomoduo_chat',
            name: 'Chat Messages',
            importance: AndroidImportance.DEFAULT,
          }).then(channelId => {
            notifee.displayNotification({
              title: msg.username,
              body: msg.text,
              android: {
                channelId,
                smallIcon: 'ic_launcher',
                pressAction: { id: 'default' },
              },
            }).catch(e => console.error('Error showing chat notification:', e));
          });
        }

        return { chatMessages: [...state.chatMessages, msg] };
      });
    })
    .on('broadcast', { event: 'participant_joined' }, ({ payload }) => {
      const currentState = get();
      
      // If the host was using the solo timer while waiting for friends, sync the latest solo timer state to the duo session!
      if (currentState.isHost && currentState.waitingForFriends) {
        const soloState = useTimerStore.getState();
        set({
          timeLeft: soloState.timeLeft,
          mode: soloState.mode,
          isRunning: soloState.isRunning,
          targetEndTime: soloState.targetEndTime,
          focusTime: soloState.totalFocusTime,
          breakTime: soloState.breakTime,
          savedFocusTimeLeft: soloState.savedFocusTimeLeft,
          savedBreakTimeLeft: soloState.savedBreakTimeLeft,
        });
      } else if (currentState.isHost && currentState.isRunning && currentState.targetEndTime) {
        // Otherwise just update our background timer
        get().syncFromBackground();
      }

      const state = get();
      if (state.isHost && state.channel) {
        state.channel.send({
          type: 'broadcast',
          event: 'timer_sync',
          payload: {
            timeLeft: state.timeLeft,
            mode: state.mode,
            isRunning: state.isRunning,
            targetEndTime: state.targetEndTime,
            focusTime: state.focusTime,
            breakTime: state.breakTime,
          },
        });
      }

      set((state: DuoState) => {
        const newParticipants = [...state.participants.filter((p: any) => p.id !== payload.id), payload];
        return {
          participants: newParticipants,
          kickedUserIds: state.kickedUserIds.filter(id => id !== payload.id),
          waitingForFriends: state.isHost ? newParticipants.length <= 1 : state.waitingForFriends,
        };
      });
    })
    .on('broadcast', { event: 'participant_left' }, ({ payload }) => {
      set((state: DuoState) => {
        const newParticipants = state.participants.filter((p: any) => p.id !== payload.id);
        const shouldWait = newParticipants.length <= 1;
        
        // If host is the only one left, transition back to solo mode
        if (state.isHost && shouldWait && !state.waitingForFriends) {
           useTimerStore.setState({
             timeLeft: state.timeLeft,
             mode: state.mode,
             isRunning: state.isRunning,
             targetEndTime: state.targetEndTime,
             totalFocusTime: state.focusTime,
             breakTime: state.breakTime,
             savedFocusTimeLeft: state.savedFocusTimeLeft,
             savedBreakTimeLeft: state.savedBreakTimeLeft,
           });
           
           // Burn chat history when room becomes empty (except for host)
           if (state.sessionId) {
              supabase.from('duo_chat_messages').delete().eq('session_id', state.sessionId).then(({ error }) => {
                if (error) console.error('Failed to delete chat messages:', error);
              });
           }
        }
        
        return {
          participants: newParticipants,
          chatMessages: shouldWait ? [] : state.chatMessages,
          waitingForFriends: state.isHost ? shouldWait : state.waitingForFriends,
        };
      });
    })
    .on('presence', { event: 'leave' }, ({ key }) => {
      // Supabase Presence automatically detects if a user's app crashes or connection drops.
      set((state: DuoState) => {
        const newParticipants = state.participants.filter((p: any) => p.id !== key);
        // If they were already removed by participant_left, do nothing to avoid redundant state updates
        if (newParticipants.length === state.participants.length) return state;

        const shouldWait = newParticipants.length <= 1;
        
        if (state.isHost && shouldWait && !state.waitingForFriends) {
           useTimerStore.setState({
             timeLeft: state.timeLeft,
             mode: state.mode,
             isRunning: state.isRunning,
             targetEndTime: state.targetEndTime,
             totalFocusTime: state.focusTime,
             breakTime: state.breakTime,
             savedFocusTimeLeft: state.savedFocusTimeLeft,
             savedBreakTimeLeft: state.savedBreakTimeLeft,
           });
        }

        // --- Database Cleanup for Crashes ---
        const { sessionId, isHost, hostId } = state;
        
        // If I am the host, and someone else crashed, delete them from the database
        if (isHost && sessionId && key !== state.hostId) {
           supabase.from('session_participants').delete().match({ session_id: sessionId, user_id: key }).then();
        }

        // If the HOST crashed, and I am the remaining participant, I should claim host
        if (!isHost && sessionId && key === hostId) {
           // We claim host ownership in the database
           const myId = useAuthStore.getState().user?.id;
           if (myId) {
              supabase.from('duo_sessions').update({ host_id: myId }).eq('id', sessionId).then(() => {
                 set({ hostId: myId, isHost: true, waitingForFriends: true, chatMessages: [] });
                 // If the session is empty after I claim host (e.g., I was the only one left and I leave later), 
                 // the normal leaveSession logic will cleanly wipe it out.
                 supabase.from('duo_chat_messages').delete().eq('session_id', sessionId).then();
              });
           }
        }
        
        if (isHost && shouldWait) {
           if (sessionId) {
              supabase.from('duo_chat_messages').delete().eq('session_id', sessionId).then();
           }
        }
        
        return {
          participants: newParticipants,
          chatMessages: shouldWait ? [] : state.chatMessages,
          waitingForFriends: state.isHost ? shouldWait : state.waitingForFriends,
        };
      });
    })
    .on('broadcast', { event: 'kick_user' }, ({ payload }) => {
      const { id: kickedUserId, username: kickedUsername } = payload;
      const currentUser = useAuthStore.getState().user;
      
      if (currentUser?.id === kickedUserId) {
        // I am the one kicked
        useTimerStore.setState({
           totalFocusTime: 25,
           breakTime: 5,
           timeLeft: 25 * 60,
           mode: 'focus',
           isRunning: false,
           targetEndTime: null,
           savedFocusTimeLeft: null,
           savedBreakTimeLeft: null,
        });
        get().setKickedModalVisible(true);
        get().leaveSession(currentUser!.id);
      } else {
        // Someone else was kicked
        set((s: DuoState) => ({ kickedUserIds: [...s.kickedUserIds, kickedUserId] }));
      }
    })
    .on('broadcast', { event: 'timer_sync' }, ({ payload }) => {
      // The host is the source of truth and already updated local state before broadcasting.
      // Ignoring own broadcast prevents network delay from shifting the host's UI clock out of sync with the alarm.
      if (get().isHost) return;

      // Use payload.timeLeft to calculate our local targetEndTime to avoid device clock drift
      let timeLeft = payload.timeLeft;
      let localTargetEndTime = null;
      if (payload.isRunning) {
        localTargetEndTime = Date.now() + timeLeft * 1000;
      }
      set({
        timeLeft,
        mode: payload.mode,
        isRunning: payload.isRunning,
        targetEndTime: localTargetEndTime,
        focusTime: payload.focusTime,
        breakTime: payload.breakTime,
        hasReceivedInitialSync: true,
      });
    })
    .on('broadcast', { event: 'chat_settings' }, ({ payload }) => {
      set({
        isChatEnabled: payload.isChatEnabled,
        chatOnlyOnBreak: payload.chatOnlyOnBreak,
      });
    });
}

export const useDuoStore = create<DuoState>((set, get) => ({
  sessionId: null,
  hostId: null,
  isHost: false,
  participants: [],
  waitingForFriends: false,
  focusTime: 25,
  breakTime: 5,
  timeLeft: 25 * 60,
  mode: 'focus',
  isRunning: false,
  targetEndTime: null,
  savedFocusTimeLeft: null,
  savedBreakTimeLeft: null,
  chatMessages: [],
  isChatEnabled: true,
  chatOnlyOnBreak: false,
  pendingInvites: [],
  sentInvites: [],
  channel: null,
  inviteChannel: null,
  completedFocusMinutes: 0,
  completedBreakMinutes: 0,
  sessionStartTime: null,
  kickedModalVisible: false,
  kickedUserIds: [],
  hasReceivedInitialSync: false,
  isConnectingToSession: false,

  setKickedModalVisible: (visible) => set({ kickedModalVisible: visible }),
  kickParticipant: (userId: string, username: string) => {
    const state = get();
    if (state.isHost && state.channel) {
      state.channel.send({
        type: 'broadcast',
        event: 'kick_user',
        payload: { id: userId, username },
      });
      set(s => ({ kickedUserIds: [...s.kickedUserIds, userId] }));
    }
  },

  // ─── Invites ────────────────────────────────────────────────

  loadPendingInvites: async (userId) => {
    const { data } = await supabase
      .from('session_invites')
      .select('*, inviter:profiles!session_invites_inviter_id_fkey(id, username), session:duo_sessions!session_invites_session_id_fkey(focus_time_minutes, break_time_minutes)')
      .eq('invitee_id', userId)
      .eq('status', 'pending');
    if (data) set({ pendingInvites: data as SessionInvite[] });
  },

  subscribeToInvites: (userId) => {
    const existing = get().inviteChannel;
    if (existing) supabase.removeChannel(existing);

    const ch = supabase
      .channel('my-invites')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_invites', filter: `invitee_id=eq.${userId}` },
        () => get().loadPendingInvites(userId),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_invites', filter: `inviter_id=eq.${userId}` },
        (payload) => {
          // Sync sent invites status
          if (payload.eventType === 'UPDATE' && (payload.new as any).status !== 'pending') {
            set((state) => ({ sentInvites: state.sentInvites.filter((id) => id !== (payload.new as any).invitee_id) }));
          } else if (payload.eventType === 'DELETE') {
            set((state) => ({ sentInvites: state.sentInvites.filter((id) => id !== (payload.old as any).invitee_id) }));
          } else if (payload.eventType === 'INSERT') {
            if (!get().sentInvites.includes((payload.new as any).invitee_id)) {
              set((state) => ({ sentInvites: [...state.sentInvites, (payload.new as any).invitee_id] }));
            }
          }

          // If someone accepted our invite, maybe reload things if needed
          if (payload.eventType === 'UPDATE' && (payload.new as any).status === 'accepted') {
            const state = get();
            if (state.waitingForFriends && state.sessionId) {
              get().loadPendingInvites(userId);
            }
          }
        },
      )
      .subscribe();

    set({ inviteChannel: ch });
  },

  unsubscribeFromInvites: () => {
    const ch = get().inviteChannel;
    if (ch) supabase.removeChannel(ch);
    set({ inviteChannel: null });
  },

  inviteFriends: async (hostId, hostUsername, friendIds, focusMin, breakMin, mode = 'focus', timeLeft, isRunning = false) => {
    // Optimistic update
    set((state) => ({ sentInvites: [...state.sentInvites, ...friendIds] }));

    // 1. Create the duo session
    const { data: session, error } = await supabase
      .from('duo_sessions')
      .insert({
        host_id: hostId,
        status: 'waiting',
        focus_time_minutes: focusMin,
        break_time_minutes: breakMin,
        is_chat_enabled: true,
        chat_only_on_break: false,
      })
      .select()
      .single();

    if (error || !session) {
      console.error('Error creating session:', error);
      return;
    }

    // 2. Add host as participant
    await supabase.from('session_participants').insert({
      session_id: session.id,
      user_id: hostId,
    });

    // 3. Create invites for each friend
    const invites = friendIds.map((fid) => ({
      session_id: session.id,
      inviter_id: hostId,
      invitee_id: fid,
      status: 'pending',
    }));
    // Note: session is newly created, so no need to delete existing invites here
    await supabase.from('session_invites').insert(invites);

    // 4. Join the Realtime channel and wait
    const initialTimeLeft = timeLeft !== undefined ? timeLeft : focusMin * 60;
    get().joinSessionChannel(session.id, hostId, hostUsername, focusMin, breakMin, true, false, true, mode, initialTimeLeft, isRunning);
    // waitingForFriends is now handled correctly by the SUBSCRIBED callback

    // Auto-cancel invites after 10 seconds
    setTimeout(() => {
      const currentSentInvites = get().sentInvites;
      friendIds.forEach(fid => {
        if (currentSentInvites.includes(fid)) {
          get().cancelSentInvite(fid);
        }
      });
    }, 10000);
  },

  inviteMoreFriends: async (hostId, friendIds) => {
    // Optimistic update
    set((state) => ({ sentInvites: [...state.sentInvites, ...friendIds] }));

    const sessionId = get().sessionId;
    if (!sessionId) return;
    const invites = friendIds.map((fid) => ({
      session_id: sessionId,
      inviter_id: hostId,
      invitee_id: fid,
      status: 'pending',
    }));
    // Delete existing invites to avoid unique constraint and RLS update issues
    await Promise.all(
      friendIds.map((fid) => 
        supabase.from('session_invites').delete().match({ session_id: sessionId, invitee_id: fid })
      )
    );
    const { error } = await supabase.from('session_invites').insert(invites);
    if (error) console.error('Error inviting more friends:', error);

    // Auto-cancel invites after 10 seconds
    setTimeout(() => {
      const currentSentInvites = get().sentInvites;
      friendIds.forEach(fid => {
        if (currentSentInvites.includes(fid)) {
          get().cancelSentInvite(fid);
        }
      });
    }, 10000);
  },

  cancelSentInvite: async (friendId: string) => {
    // Optimistic update
    set((state) => ({ sentInvites: state.sentInvites.filter((id) => id !== friendId) }));

    const sessionId = get().sessionId;
    if (!sessionId) return;
    const { error } = await supabase.from('session_invites').delete().match({ session_id: sessionId, invitee_id: friendId });
    if (error) console.error('Error canceling invite:', error);
  },

  acceptInvite: async (invite, userId, username) => {
    // If currently in another session, leave it first to clear stale state
    if (get().sessionId) {
      await get().leaveSession(userId);
    }

    // Optimistic update and set connecting state
    set((state) => ({
      pendingInvites: state.pendingInvites.filter((i) => i.id !== invite.id),
      isConnectingToSession: true,
    }));

    // Update invite status
    const { error } = await supabase
      .from('session_invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id);

    if (error) {
      console.error('Error accepting invite:', error);
      set({ isConnectingToSession: false });
      return false;
    }

    // Add as participant
    await supabase.from('session_participants').insert({
      session_id: invite.session_id,
      user_id: userId,
    });

    // Fetch full session details
    const { data: session } = await supabase
      .from('duo_sessions')
      .select('*')
      .eq('id', invite.session_id)
      .single();

    if (!session) {
      set({ isConnectingToSession: false });
      return false;
    }

    // Join the channel — default chat to enabled if columns don't exist
    await get().joinSessionChannel(
      invite.session_id,
      userId,
      username,
      session.focus_time_minutes || 25,
      session.break_time_minutes || 5,
      session.is_chat_enabled ?? true,
      session.chat_only_on_break ?? false,
      false,
    );

    // Also update hostId from session
    set({ hostId: session.host_id });

    // Remove from pending and reset connecting state
    set((state) => ({
      pendingInvites: state.pendingInvites.filter((i) => i.id !== invite.id),
      waitingForFriends: false,
      isConnectingToSession: false,
    }));

    return true;
  },

  declineInvite: async (inviteId) => {
    // Optimistic update
    set((state) => ({
      pendingInvites: state.pendingInvites.filter((i) => i.id !== inviteId),
    }));
    await supabase.from('session_invites').update({ status: 'declined' }).eq('id', inviteId);
  },

  // ─── Session Channel ────────────────────────────────────────

  joinSessionChannel: async (sessionId, userId, username, focusMin, breakMin, chatEnabled, chatOnBreak, isHost, initialMode = 'focus', initialTimeLeft, initialIsRunning = false) => {
    const existing = get().channel;
    if (existing) supabase.removeChannel(existing);

    const channel = supabase.channel(`session:${sessionId}`, {
      config: { 
        presence: { key: userId },
        broadcast: { self: true }
      },
    });

    // Load existing participants from the database so we see everyone
    const { data: existingParticipants } = await supabase
      .from('session_participants')
      .select('user_id, joined_at, profile:profiles!session_participants_user_id_fkey(id, username)')
      .eq('session_id', sessionId)
      .order('joined_at', { ascending: true });

    const participants: { id: string; username: string }[] = [];
    if (existingParticipants) {
      existingParticipants.forEach((p: any) => {
        if (p.profile) {
          participants.push({ id: p.profile.id, username: p.profile.username });
        }
      });
    }
    // Make sure we're in the list
    if (!participants.find((p) => p.id === userId)) {
      participants.push({ id: userId, username });
    }

    setupChannel(channel, set, get);

    if (isHost) {
      set({ waitingForFriends: participants.length <= 1 });
    }

    set({
      sessionId,
      hostId: isHost ? userId : get().hostId,
      isHost: isHost,
      participants,
      focusTime: focusMin,
      breakTime: breakMin,
      mode: initialMode,
      timeLeft: initialTimeLeft !== undefined ? initialTimeLeft : focusMin * 60,
      isRunning: initialIsRunning,
      targetEndTime: initialIsRunning ? Date.now() + (initialTimeLeft !== undefined ? initialTimeLeft : focusMin * 60) * 1000 : null,
      isChatEnabled: chatEnabled ?? true,
      chatOnlyOnBreak: chatOnBreak ?? false,
      channel,
      chatMessages: [],
      sessionStartTime: Date.now(),
      completedFocusMinutes: 0,
      completedBreakMinutes: 0,
      hasReceivedInitialSync: isHost,
      kickedUserIds: [],
    });
    
    // Clear any pending triggers from solo mode to prevent rogue alarms
    notifee.cancelTriggerNotification('timer-end-focus');
    notifee.cancelTriggerNotification('timer-end-break');

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Track presence so the server knows we are here and can detect if we crash
        channel.track({ id: userId, username });
        
        channel.send({
          type: 'broadcast',
          event: 'participant_joined',
          payload: { id: userId, username },
        });
      }
    });

    // Fetch existing chat messages for this session
    const { data: messages } = await supabase
      .from('duo_chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (messages && messages.length > 0) {
      const initialMessages = messages.map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        username: m.username,
        text: m.text,
        timestamp: m.timestamp,
      }));
      set({ chatMessages: initialMessages });
    }
  },

  leaveSession: async (userId) => {
    const { channel, sessionId, isHost, participants } = get();

    if (sessionId && isHost) {
      // Find the next participant to be the host
      const nextHost = participants.find(p => p.id !== userId);
      if (nextHost) {
        // Transfer ownership in database
        await supabase.from('duo_sessions').update({ host_id: nextHost.id }).eq('id', sessionId);
        
        // Broadcast host change
        if (channel) {
          channel.send({
            type: 'broadcast',
            event: 'host_changed',
            payload: { newHostId: nextHost.id },
          });
        }
      } else {
        // No participants left, delete the entire session
        // This will trigger ON DELETE CASCADE and wipe all chat messages for this session
        await supabase.from('duo_sessions').delete().eq('id', sessionId);
      }
    }

    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'participant_left',
        payload: { id: userId },
      });
      supabase.removeChannel(channel);
    }

    if (sessionId) {
      // Sync the timer to the solo mode before leaving so it continues seamlessly
      // Wait, user explicitly requested to reset to 25 and 5 instead of transferring
      useTimerStore.setState({
         totalFocusTime: 25,
         breakTime: 5,
         timeLeft: 25 * 60,
         mode: 'focus',
         isRunning: false,
         targetEndTime: null,
         savedFocusTimeLeft: null,
         savedBreakTimeLeft: null,
      });
      await supabase.from('session_participants').delete().match({ session_id: sessionId, user_id: userId });
    }

    set({
      sessionId: null,
      hostId: null,
      isHost: false,
      participants: [],
      channel: null,
      chatMessages: [],
      isRunning: false,
      targetEndTime: null,
      savedFocusTimeLeft: null,
      savedBreakTimeLeft: null,
      timeLeft: 25 * 60,
      mode: 'focus',
      waitingForFriends: false,
      kickedUserIds: [],
      hasReceivedInitialSync: false,
      isConnectingToSession: false,
    });
    
    // Clear any pending triggers from the session
    notifee.cancelTriggerNotification('timer-end-focus');
    notifee.cancelTriggerNotification('timer-end-break');
  },

  cleanupGhostSessions: async (userId) => {
    // If both users crash, ghost sessions stay in the database forever.
    // This function runs when the app boots up. It checks if the user is the host
    // of any session that is older than 12 hours, and explicitly deletes it.
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    
    await supabase
      .from('duo_sessions')
      .delete()
      .match({ host_id: userId })
      .lt('created_at', twelveHoursAgo);
  },

  // ─── Host Timer Controls ─────────────────────────────────────────

  startTimer: () => {
    const { channel, timeLeft, focusTime, breakTime, mode } = get();
    const targetEndTime = Date.now() + timeLeft * 1000;
    set({ isRunning: true, targetEndTime });
    channel?.send({
      type: 'broadcast',
      event: 'timer_sync',
      payload: { timeLeft, mode, isRunning: true, targetEndTime, focusTime, breakTime },
    });
  },

  pauseTimer: () => {
    const { channel, focusTime, breakTime, timeLeft, mode } = get();
    set({ isRunning: false, targetEndTime: null });
    channel?.send({
      type: 'broadcast',
      event: 'timer_sync',
      payload: { timeLeft, mode, isRunning: false, targetEndTime: null, focusTime, breakTime },
    });
  },

  resetTimer: () => {
    const { channel, mode, focusTime, breakTime } = get();
    const newTimeLeft = mode === 'focus' ? focusTime * 60 : breakTime * 60;
    set({ timeLeft: newTimeLeft, savedFocusTimeLeft: null, savedBreakTimeLeft: null, isRunning: false, targetEndTime: null });
    channel?.send({
      type: 'broadcast',
      event: 'timer_sync',
      payload: { timeLeft: newTimeLeft, mode, isRunning: false, targetEndTime: null, focusTime, breakTime },
    });
  },

  switchMode: () => {
    const { mode, timeLeft, focusTime, breakTime, savedFocusTimeLeft, savedBreakTimeLeft, channel } = get();
    const newMode = mode === 'focus' ? 'break' : 'focus';
    
    const savedFocus = mode === 'focus' ? timeLeft : savedFocusTimeLeft;
    const savedBreak = mode === 'break' ? timeLeft : savedBreakTimeLeft;
    
    let restoredTime = newMode === 'focus' ? savedFocus : savedBreak;
    if (restoredTime === null) {
      restoredTime = newMode === 'focus' ? focusTime * 60 : breakTime * 60;
    }

    set({ 
      mode: newMode, 
      timeLeft: restoredTime, 
      savedFocusTimeLeft: savedFocus, 
      savedBreakTimeLeft: savedBreak, 
      isRunning: false, 
      targetEndTime: null 
    });
    
    channel?.send({
      type: 'broadcast',
      event: 'timer_sync',
      payload: { timeLeft: restoredTime, mode: newMode, isRunning: false, targetEndTime: null, focusTime, breakTime },
    });
  },

  setFocusTime: (minutes) => {
    const { mode, focusTime, timeLeft, savedFocusTimeLeft, channel } = get();
    const diffMinutes = minutes - focusTime;
    if (diffMinutes < 0) {
      if (mode === 'focus' && timeLeft + (diffMinutes * 60) <= 0) return;
      if (mode !== 'focus' && savedFocusTimeLeft !== null && savedFocusTimeLeft + (diffMinutes * 60) <= 0) return;
    }

    let newTimeLeft = timeLeft;
    let newSavedFocus = savedFocusTimeLeft;

    if (mode === 'focus') {
      newTimeLeft = Math.max(0, timeLeft + (diffMinutes * 60));
    } else {
      if (savedFocusTimeLeft !== null) {
        newSavedFocus = Math.max(0, savedFocusTimeLeft + (diffMinutes * 60));
      }
    }
    
    set({ focusTime: minutes, timeLeft: newTimeLeft, savedFocusTimeLeft: newSavedFocus, isRunning: false, targetEndTime: null });
    if (mode === 'focus') {
      channel?.send({
        type: 'broadcast',
        event: 'timer_sync',
        payload: { timeLeft: newTimeLeft, mode, isRunning: false, targetEndTime: null, focusTime: minutes, breakTime: get().breakTime },
      });
    }
  },

  setBreakTime: (minutes) => {
    const { mode, breakTime, timeLeft, savedBreakTimeLeft, channel } = get();
    const diffMinutes = minutes - breakTime;
    if (diffMinutes < 0) {
      if (mode === 'break' && timeLeft + (diffMinutes * 60) <= 0) return;
      if (mode !== 'break' && savedBreakTimeLeft !== null && savedBreakTimeLeft + (diffMinutes * 60) <= 0) return;
    }

    let newTimeLeft = timeLeft;
    let newSavedBreak = savedBreakTimeLeft;

    if (mode === 'break') {
      newTimeLeft = Math.max(0, timeLeft + (diffMinutes * 60));
    } else {
      if (savedBreakTimeLeft !== null) {
        newSavedBreak = Math.max(0, savedBreakTimeLeft + (diffMinutes * 60));
      }
    }
    
    set({ breakTime: minutes, timeLeft: newTimeLeft, savedBreakTimeLeft: newSavedBreak, isRunning: false, targetEndTime: null });
    if (mode === 'break') {
      channel?.send({
        type: 'broadcast',
        event: 'timer_sync',
        payload: { timeLeft: newTimeLeft, mode, isRunning: false, targetEndTime: null, focusTime: get().focusTime, breakTime: minutes },
      });
    }
  },

  // ─── Chat ───────────────────────────────────────────────────

  sendMessage: async (userId, username, text) => {
    const { channel, sessionId } = get();
    const message: ChatMessage = {
      id: `${userId}-${Date.now()}`,
      userId,
      username,
      text,
      timestamp: Date.now(),
    };
    // Optimistic update — show the message locally right away
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    }));
    // Broadcast to other participants for instant UI update
    channel?.send({
      type: 'broadcast',
      event: 'chat_message',
      payload: message,
    });
    // Persist to database so offline/background users can sync it when they return
    if (sessionId) {
      await supabase.from('duo_chat_messages').insert({
        id: message.id,
        session_id: sessionId,
        user_id: userId,
        username,
        text,
        timestamp: message.timestamp,
      });
    }
  },

  toggleChat: (enabled) => {
    const { channel } = get();
    set({ isChatEnabled: enabled });
    channel?.send({
      type: 'broadcast',
      event: 'chat_settings',
      payload: { isChatEnabled: enabled, chatOnlyOnBreak: get().chatOnlyOnBreak },
    });
  },

  toggleChatOnBreak: (enabled) => {
    const { channel } = get();
    set({ chatOnlyOnBreak: enabled });
    channel?.send({
      type: 'broadcast',
      event: 'chat_settings',
      payload: { isChatEnabled: get().isChatEnabled, chatOnlyOnBreak: enabled },
    });
  },

  // ─── Local Tick ─────────────────────────────────────────────

  tick: () => {
    set((state) => {
      if (!state.isRunning || !state.targetEndTime) return state;
      const remainingMs = state.targetEndTime - Date.now();
      const newTimeLeft = Math.max(0, Math.ceil(remainingMs / 1000));
      
      if (remainingMs <= -1000) {
        // Log focus time if finishing focus mode
        if (state.mode === 'focus') {
          const user = useAuthStore.getState().user;
          if (user) {
            (async () => {
              const { error } = await supabase.rpc('log_focus_time', {
                user_id: user.id,
                minutes_added: state.focusTime
              });
              if (error) console.error('Failed to log focus time:', error);
            })();
          }
        }

        const nextMode = state.mode === 'focus' ? 'break' : 'focus';
        const nextTimeLeft = nextMode === 'focus' ? state.focusTime * 60 : state.breakTime * 60;
        
        let newTargetEndTime = state.targetEndTime + (nextTimeLeft * 1000);
        if (newTargetEndTime <= Date.now()) {
          newTargetEndTime = Date.now() + (nextTimeLeft * 1000);
        }
        
        if (state.isHost && state.channel) {
          state.channel.send({
            type: 'broadcast',
            event: 'timer_sync',
            payload: { timeLeft: nextTimeLeft, mode: nextMode, isRunning: true, targetEndTime: newTargetEndTime, focusTime: state.focusTime, breakTime: state.breakTime },
          });
        }

        return { 
          mode: nextMode, 
          timeLeft: nextTimeLeft, 
          isRunning: true, 
          targetEndTime: newTargetEndTime,
          savedFocusTimeLeft: nextMode === 'focus' ? null : state.savedFocusTimeLeft,
          savedBreakTimeLeft: nextMode === 'break' ? null : state.savedBreakTimeLeft,
          completedFocusMinutes: state.mode === 'focus' ? state.completedFocusMinutes + state.focusTime : state.completedFocusMinutes,
          completedBreakMinutes: state.mode === 'break' ? state.completedBreakMinutes + state.breakTime : state.completedBreakMinutes,
        };
      }
      return { timeLeft: newTimeLeft };
    });
  },

  syncFromBackground: () => {
    get().syncChatMessages();
    set((state) => {
      if (!state.isRunning || !state.targetEndTime) return state;
      const remainingMs = state.targetEndTime - Date.now();
      
      if (remainingMs <= 0) {
        // Log focus time if finished in background
        if (state.mode === 'focus') {
          const user = useAuthStore.getState().user;
          if (user) {
            (async () => {
              const { error } = await supabase.rpc('log_focus_time', {
                user_id: user.id,
                minutes_added: state.focusTime
              });
              if (error) console.error(error);
            })();
          }
        }

        const nextMode = state.mode === 'focus' ? 'break' : 'focus';
        const nextTimeLeft = nextMode === 'focus' ? state.focusTime * 60 : state.breakTime * 60;
        
        let newTargetEndTime = state.targetEndTime + (nextTimeLeft * 1000);
        if (newTargetEndTime <= Date.now()) {
          newTargetEndTime = Date.now() + (nextTimeLeft * 1000);
        }
        
        if (state.isHost && state.channel) {
          state.channel.send({
            type: 'broadcast',
            event: 'timer_sync',
            payload: { timeLeft: nextTimeLeft, mode: nextMode, isRunning: true, targetEndTime: newTargetEndTime, focusTime: state.focusTime, breakTime: state.breakTime },
          });
        }

        return { 
          mode: nextMode, 
          timeLeft: nextTimeLeft, 
          isRunning: true, 
          targetEndTime: newTargetEndTime,
          savedFocusTimeLeft: nextMode === 'focus' ? null : state.savedFocusTimeLeft,
          savedBreakTimeLeft: nextMode === 'break' ? null : state.savedBreakTimeLeft,
          completedFocusMinutes: state.mode === 'focus' ? state.completedFocusMinutes + state.focusTime : state.completedFocusMinutes,
          completedBreakMinutes: state.mode === 'break' ? state.completedBreakMinutes + state.breakTime : state.completedBreakMinutes,
        };
      }
      return { timeLeft: Math.ceil(remainingMs / 1000) };
    });
  },

  syncChatMessages: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    const { data } = await supabase
      .from('duo_chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });
    
    if (data) {
      const messages = data.map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        username: m.username,
        text: m.text,
        timestamp: m.timestamp,
      }));
      set({ chatMessages: messages });
    }
  },
}));
