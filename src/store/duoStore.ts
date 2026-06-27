import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}

interface DuoState {
  // Session info
  sessionId: string | null;
  isHost: boolean;
  participants: { id: string; username: string }[];
  
  // Timer state (synced via Realtime)
  focusTime: number;   // minutes
  breakTime: number;   // minutes
  timeLeft: number;    // seconds
  mode: 'focus' | 'break';
  isRunning: boolean;
  targetEndTime: number | null;
  
  // Chat
  chatMessages: ChatMessage[];
  isChatEnabled: boolean;
  chatOnlyOnBreak: boolean;
  
  // Realtime channel
  channel: RealtimeChannel | null;
  
  // Actions
  createSession: (hostId: string, hostUsername: string, focusMin: number, breakMin: number, chatEnabled: boolean, chatOnBreak: boolean) => Promise<string | null>;
  joinSession: (sessionId: string, userId: string, username: string) => Promise<boolean>;
  leaveSession: (userId: string) => void;
  
  // Host-only timer controls (broadcast to all)
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  switchMode: () => void;
  
  // Chat
  sendMessage: (userId: string, username: string, text: string) => void;
  toggleChat: (enabled: boolean) => void;
  toggleChatOnBreak: (enabled: boolean) => void;
  
  // Local tick
  tick: () => void;
  syncFromBackground: () => void;
}

export const useDuoStore = create<DuoState>((set, get) => ({
  sessionId: null,
  isHost: false,
  participants: [],
  focusTime: 25,
  breakTime: 5,
  timeLeft: 25 * 60,
  mode: 'focus',
  isRunning: false,
  targetEndTime: null,
  chatMessages: [],
  isChatEnabled: true,
  chatOnlyOnBreak: false,
  channel: null,

  createSession: async (hostId, hostUsername, focusMin, breakMin, chatEnabled, chatOnBreak) => {
    // Create the session in the database
    const { data, error } = await supabase
      .from('duo_sessions')
      .insert({
        host_id: hostId,
        status: 'waiting',
        focus_time_minutes: focusMin,
        break_time_minutes: breakMin,
        is_chat_enabled: chatEnabled,
        chat_only_on_break: chatOnBreak,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Error creating session:', error);
      return null;
    }

    // Add host as participant
    await supabase.from('session_participants').insert({
      session_id: data.id,
      user_id: hostId,
    });

    // Subscribe to Realtime channel
    const channel = supabase.channel(`duo:${data.id}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on('broadcast', { event: 'timer_sync' }, ({ payload }) => {
        set({
          timeLeft: payload.timeLeft,
          mode: payload.mode,
          isRunning: payload.isRunning,
          targetEndTime: payload.targetEndTime,
        });
      })
      .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
        set((state) => ({
          chatMessages: [...state.chatMessages, payload as ChatMessage],
        }));
      })
      .on('broadcast', { event: 'participant_joined' }, ({ payload }) => {
        set((state) => ({
          participants: [...state.participants.filter(p => p.id !== payload.id), payload],
        }));
      })
      .on('broadcast', { event: 'participant_left' }, ({ payload }) => {
        set((state) => ({
          participants: state.participants.filter(p => p.id !== payload.id),
        }));
      })
      .on('broadcast', { event: 'chat_settings' }, ({ payload }) => {
        set({
          isChatEnabled: payload.isChatEnabled,
          chatOnlyOnBreak: payload.chatOnlyOnBreak,
        });
      })
      .subscribe();

    set({
      sessionId: data.id,
      isHost: true,
      participants: [{ id: hostId, username: hostUsername }],
      focusTime: focusMin,
      breakTime: breakMin,
      timeLeft: focusMin * 60,
      mode: 'focus',
      isRunning: false,
      targetEndTime: null,
      chatMessages: [],
      isChatEnabled: chatEnabled,
      chatOnlyOnBreak: chatOnBreak,
      channel,
    });

    return data.id;
  },

  joinSession: async (sessionId, userId, username) => {
    // Fetch session details
    const { data: session, error } = await supabase
      .from('duo_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      console.error('Error fetching session:', error);
      return false;
    }

    // Add as participant
    await supabase.from('session_participants').insert({
      session_id: sessionId,
      user_id: userId,
    });

    // Subscribe to Realtime channel
    const channel = supabase.channel(`duo:${sessionId}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on('broadcast', { event: 'timer_sync' }, ({ payload }) => {
        set({
          timeLeft: payload.timeLeft,
          mode: payload.mode,
          isRunning: payload.isRunning,
          targetEndTime: payload.targetEndTime,
        });
      })
      .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
        set((state) => ({
          chatMessages: [...state.chatMessages, payload as ChatMessage],
        }));
      })
      .on('broadcast', { event: 'participant_joined' }, ({ payload }) => {
        set((state) => ({
          participants: [...state.participants.filter(p => p.id !== payload.id), payload],
        }));
      })
      .on('broadcast', { event: 'participant_left' }, ({ payload }) => {
        set((state) => ({
          participants: state.participants.filter(p => p.id !== payload.id),
        }));
      })
      .on('broadcast', { event: 'chat_settings' }, ({ payload }) => {
        set({
          isChatEnabled: payload.isChatEnabled,
          chatOnlyOnBreak: payload.chatOnlyOnBreak,
        });
      })
      .subscribe();

    // Announce to others
    channel.send({
      type: 'broadcast',
      event: 'participant_joined',
      payload: { id: userId, username },
    });

    set({
      sessionId,
      isHost: false,
      participants: [{ id: userId, username }],
      focusTime: session.focus_time_minutes,
      breakTime: session.break_time_minutes,
      timeLeft: session.focus_time_minutes * 60,
      mode: 'focus',
      isRunning: false,
      targetEndTime: null,
      chatMessages: [],
      isChatEnabled: session.is_chat_enabled,
      chatOnlyOnBreak: session.chat_only_on_break,
      channel,
    });

    return true;
  },

  leaveSession: (userId) => {
    const { channel, sessionId } = get();
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'participant_left',
        payload: { id: userId },
      });
      supabase.removeChannel(channel);
    }

    if (sessionId) {
      supabase.from('session_participants').delete().match({ session_id: sessionId, user_id: userId });
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
    });
  },

  startTimer: () => {
    const { channel, timeLeft } = get();
    const targetEndTime = Date.now() + timeLeft * 1000;
    
    // Broadcast to all participants
    channel?.send({
      type: 'broadcast',
      event: 'timer_sync',
      payload: {
        timeLeft,
        mode: get().mode,
        isRunning: true,
        targetEndTime,
      },
    });
  },

  pauseTimer: () => {
    const { channel } = get();
    channel?.send({
      type: 'broadcast',
      event: 'timer_sync',
      payload: {
        timeLeft: get().timeLeft,
        mode: get().mode,
        isRunning: false,
        targetEndTime: null,
      },
    });
  },

  resetTimer: () => {
    const { channel, mode, focusTime, breakTime } = get();
    const newTimeLeft = mode === 'focus' ? focusTime * 60 : breakTime * 60;
    channel?.send({
      type: 'broadcast',
      event: 'timer_sync',
      payload: {
        timeLeft: newTimeLeft,
        mode,
        isRunning: false,
        targetEndTime: null,
      },
    });
  },

  switchMode: () => {
    const { channel, mode, focusTime, breakTime } = get();
    const newMode = mode === 'focus' ? 'break' : 'focus';
    const newTimeLeft = newMode === 'focus' ? focusTime * 60 : breakTime * 60;
    channel?.send({
      type: 'broadcast',
      event: 'timer_sync',
      payload: {
        timeLeft: newTimeLeft,
        mode: newMode,
        isRunning: false,
        targetEndTime: null,
      },
    });
  },

  sendMessage: (userId, username, text) => {
    const { channel } = get();
    const message: ChatMessage = {
      id: `${userId}-${Date.now()}`,
      userId,
      username,
      text,
      timestamp: Date.now(),
    };
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

  tick: () => {
    set((state) => {
      if (!state.isRunning || state.timeLeft <= 0) return state;
      const newTimeLeft = state.timeLeft - 1;
      if (newTimeLeft <= 0) {
        return { timeLeft: 0, isRunning: false, targetEndTime: null };
      }
      return { timeLeft: newTimeLeft };
    });
  },

  syncFromBackground: () => {
    set((state) => {
      if (!state.isRunning || !state.targetEndTime) return state;
      const now = Date.now();
      const remainingMs = state.targetEndTime - now;
      if (remainingMs <= 0) {
        return { timeLeft: 0, isRunning: false, targetEndTime: null };
      }
      return { timeLeft: Math.ceil(remainingMs / 1000) };
    });
  },
}));
