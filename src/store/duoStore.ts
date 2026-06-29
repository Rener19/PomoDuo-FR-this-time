import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from './authStore';
import { RealtimeChannel } from '@supabase/supabase-js';

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
  isHost: boolean;
  participants: { id: string; username: string }[];
  waitingForFriends: boolean;
  sessionStartTime: number | null;
  completedFocusMinutes: number;
  completedBreakMinutes: number;

  // Timer (synced via Realtime)
  focusTime: number;
  breakTime: number;
  timeLeft: number;
  mode: 'focus' | 'break';
  isRunning: boolean;
  targetEndTime: number | null;

  // Chat
  chatMessages: ChatMessage[];
  isChatEnabled: boolean;
  chatOnlyOnBreak: boolean;

  // Invites
  pendingInvites: SessionInvite[];

  // Realtime
  channel: RealtimeChannel | null;
  inviteChannel: RealtimeChannel | null;

  // Invite actions
  loadPendingInvites: (userId: string) => Promise<void>;
  inviteFriends: (hostId: string, hostUsername: string, friendIds: string[], focusMin: number, breakMin: number, mode?: 'focus' | 'break', timeLeft?: number, isRunning?: boolean) => Promise<void>;
  inviteMoreFriends: (hostId: string, friendIds: string[]) => Promise<void>;
  acceptInvite: (invite: SessionInvite, userId: string, username: string) => Promise<boolean>;
  declineInvite: (inviteId: string) => Promise<void>;
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
}

function setupChannel(channel: RealtimeChannel, set: any, get: any) {
  channel
    .on('broadcast', { event: 'timer_sync' }, ({ payload }) => {
      // Always calculate timeLeft from targetEndTime to avoid drift
      let timeLeft = payload.timeLeft;
      if (payload.isRunning && payload.targetEndTime) {
        const remainingMs = payload.targetEndTime - Date.now();
        timeLeft = Math.max(0, Math.ceil(remainingMs / 1000));
      }
      set({
        timeLeft,
        mode: payload.mode,
        isRunning: payload.isRunning,
        targetEndTime: payload.targetEndTime,
      });
    })
    .on('broadcast', { event: 'host_changed' }, ({ payload }) => {
      if (payload.newHostId) {
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
        return { chatMessages: [...state.chatMessages, msg] };
      });
    })
    .on('broadcast', { event: 'participant_joined' }, ({ payload }) => {
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
          },
        });
      }
      set((state: DuoState) => ({
        participants: [...state.participants.filter((p: any) => p.id !== payload.id), payload],
        waitingForFriends: false,
      }));
    })
    .on('broadcast', { event: 'participant_left' }, ({ payload }) => {
      set((state: DuoState) => ({
        participants: state.participants.filter((p: any) => p.id !== payload.id),
      }));
    })
    .on('broadcast', { event: 'chat_settings' }, ({ payload }) => {
      set({
        isChatEnabled: payload.isChatEnabled,
        chatOnlyOnBreak: payload.chatOnlyOnBreak,
      });
    })
    .subscribe();
}

export const useDuoStore = create<DuoState>((set, get) => ({
  sessionId: null,
  isHost: false,
  participants: [],
  waitingForFriends: false,
  focusTime: 25,
  breakTime: 5,
  timeLeft: 25 * 60,
  mode: 'focus',
  isRunning: false,
  targetEndTime: null,
  chatMessages: [],
  isChatEnabled: true,
  chatOnlyOnBreak: false,
  pendingInvites: [],
  channel: null,
  inviteChannel: null,
  completedFocusMinutes: 0,
  completedBreakMinutes: 0,

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
          // If someone accepted our invite, join the session channel if we haven't already
          if (payload.eventType === 'UPDATE' && (payload.new as any).status === 'accepted') {
            const state = get();
            if (state.waitingForFriends && state.sessionId) {
              // Reload invites
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
    set({ waitingForFriends: true });
  },

  inviteMoreFriends: async (hostId, friendIds) => {
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
  },

  acceptInvite: async (invite, userId, username) => {
    // Update invite status
    const { error } = await supabase
      .from('session_invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id);

    if (error) {
      console.error('Error accepting invite:', error);
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

    if (!session) return false;

    // Join the channel — default chat to enabled if columns don't exist
    get().joinSessionChannel(
      invite.session_id,
      userId,
      username,
      session.focus_time_minutes,
      session.break_time_minutes,
      session.is_chat_enabled ?? true,
      session.chat_only_on_break ?? false,
      false,
    );

    // Remove from pending
    set((state) => ({
      pendingInvites: state.pendingInvites.filter((i) => i.id !== invite.id),
      waitingForFriends: false,
    }));

    return true;
  },

  declineInvite: async (inviteId) => {
    await supabase.from('session_invites').update({ status: 'declined' }).eq('id', inviteId);
    set((state) => ({
      pendingInvites: state.pendingInvites.filter((i) => i.id !== inviteId),
    }));
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
      .select('user_id, profile:profiles!session_participants_user_id_fkey(id, username)')
      .eq('session_id', sessionId);

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

    // Announce join so other clients add us to their list
    setTimeout(() => {
      channel.send({
        type: 'broadcast',
        event: 'participant_joined',
        payload: { id: userId, username },
      });
    }, 500);

    set({
      sessionId,
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
      sessionStartTime: Date.now(),
      completedFocusMinutes: 0,
      completedBreakMinutes: 0,
    });
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
      await supabase.from('session_participants').delete().match({ session_id: sessionId, user_id: userId });
    }

    set({
      sessionId: null,
      isHost: false,
      participants: [],
      channel: null,
      chatMessages: [],
      isRunning: false,
      targetEndTime: null,
      timeLeft: 25 * 60,
      mode: 'focus',
      waitingForFriends: false,
    });
  },

  // ─── Timer Controls (host only, broadcast to all) ───────────

  startTimer: () => {
    const { channel, timeLeft } = get();
    const targetEndTime = Date.now() + timeLeft * 1000;
    channel?.send({
      type: 'broadcast',
      event: 'timer_sync',
      payload: { timeLeft, mode: get().mode, isRunning: true, targetEndTime },
    });
  },

  pauseTimer: () => {
    const { channel } = get();
    channel?.send({
      type: 'broadcast',
      event: 'timer_sync',
      payload: { timeLeft: get().timeLeft, mode: get().mode, isRunning: false, targetEndTime: null },
    });
  },

  resetTimer: () => {
    const { channel, mode, focusTime, breakTime } = get();
    const newTimeLeft = mode === 'focus' ? focusTime * 60 : breakTime * 60;
    channel?.send({
      type: 'broadcast',
      event: 'timer_sync',
      payload: { timeLeft: newTimeLeft, mode, isRunning: false, targetEndTime: null },
    });
  },

  switchMode: () => {
    const { mode, focusTime, breakTime, channel } = get();
    const newMode = mode === 'focus' ? 'break' : 'focus';
    const newTimeLeft = newMode === 'focus' ? focusTime * 60 : breakTime * 60;
    set({ mode: newMode, timeLeft: newTimeLeft, isRunning: false, targetEndTime: null });
    channel?.send({
      type: 'broadcast',
      event: 'timer_sync',
      payload: { timeLeft: newTimeLeft, mode: newMode, isRunning: false, targetEndTime: null },
    });
  },

  setFocusTime: (minutes) => {
    const { mode, timeLeft, channel } = get();
    const newTimeLeft = mode === 'focus' ? minutes * 60 : timeLeft;
    set({ focusTime: minutes, timeLeft: newTimeLeft, isRunning: false, targetEndTime: null });
    if (mode === 'focus') {
      channel?.send({
        type: 'broadcast',
        event: 'timer_sync',
        payload: { timeLeft: newTimeLeft, mode, isRunning: false, targetEndTime: null },
      });
    }
  },

  setBreakTime: (minutes) => {
    const { mode, timeLeft, channel } = get();
    const newTimeLeft = mode === 'break' ? minutes * 60 : timeLeft;
    set({ breakTime: minutes, timeLeft: newTimeLeft, isRunning: false, targetEndTime: null });
    if (mode === 'break') {
      channel?.send({
        type: 'broadcast',
        event: 'timer_sync',
        payload: { timeLeft: newTimeLeft, mode, isRunning: false, targetEndTime: null },
      });
    }
  },

  // ─── Chat ───────────────────────────────────────────────────

  sendMessage: (userId, username, text) => {
    const { channel } = get();
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
    // Broadcast to other participants
    channel?.send({
      type: 'broadcast',
      event: 'chat_message',
      payload: message,
    });
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
      if (!state.isRunning || state.timeLeft <= 0) return state;
      const newTimeLeft = state.timeLeft - 1;
      
      if (newTimeLeft <= 0) {
        // Log focus time if finishing focus mode
        if (state.mode === 'focus') {
          const user = useAuthStore.getState().user;
          if (user) {
            supabase.rpc('log_focus_time', {
              user_id: user.id,
              minutes_added: state.focusTime
            }).then(({ error }) => {
              if (error) console.error('Failed to log focus time:', error);
            });
          }
        }

        const nextMode = state.mode === 'focus' ? 'break' : 'focus';
        const nextTimeLeft = nextMode === 'focus' ? state.focusTime * 60 : state.breakTime * 60;
        
        return { 
          mode: nextMode, 
          timeLeft: nextTimeLeft, 
          isRunning: true, 
          targetEndTime: Date.now() + nextTimeLeft * 1000,
          completedFocusMinutes: state.mode === 'focus' ? state.completedFocusMinutes + state.focusTime : state.completedFocusMinutes,
          completedBreakMinutes: state.mode === 'break' ? state.completedBreakMinutes + state.breakTime : state.completedBreakMinutes,
        };
      }
      return { timeLeft: newTimeLeft };
    });
  },

  syncFromBackground: () => {
    set((state) => {
      if (!state.isRunning || !state.targetEndTime) return state;
      const remainingMs = state.targetEndTime - Date.now();
      
      if (remainingMs <= 0) {
        // Log focus time if finished in background
        if (state.mode === 'focus') {
          const user = useAuthStore.getState().user;
          if (user) {
            supabase.rpc('log_focus_time', {
              user_id: user.id,
              minutes_added: state.focusTime
            }).catch(e => console.error(e));
          }
        }

        const nextMode = state.mode === 'focus' ? 'break' : 'focus';
        const nextTimeLeft = nextMode === 'focus' ? state.focusTime * 60 : state.breakTime * 60;
        return { 
          mode: nextMode, 
          timeLeft: nextTimeLeft, 
          isRunning: true, 
          targetEndTime: Date.now() + nextTimeLeft * 1000,
          completedFocusMinutes: state.mode === 'focus' ? state.completedFocusMinutes + state.focusTime : state.completedFocusMinutes,
          completedBreakMinutes: state.mode === 'break' ? state.completedBreakMinutes + state.breakTime : state.completedBreakMinutes,
        };
      }
      return { timeLeft: Math.ceil(remainingMs / 1000) };
    });
  },
}));
