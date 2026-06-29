import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from './authStore';

type TimerMode = 'focus' | 'break';

interface TimerState {
  totalFocusTime: number; // in minutes
  breakTime: number; // in minutes
  timeLeft: number; // in seconds
  mode: TimerMode;
  isRunning: boolean;
  targetEndTime: number | null; // Used for calculating time passed in background
  
  // Actions
  setTotalFocusTime: (minutes: number) => void;
  setBreakTime: (minutes: number) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  tick: () => void;
  switchMode: () => void;
  syncFromBackground: () => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  totalFocusTime: 25,
  breakTime: 5,
  timeLeft: 25 * 60,
  mode: 'focus',
  isRunning: false,
  targetEndTime: null,

  setTotalFocusTime: (minutes: number) => {
    set((state) => {
      const newTimeLeft = state.mode === 'focus' ? minutes * 60 : state.timeLeft;
      return { totalFocusTime: minutes, timeLeft: newTimeLeft, isRunning: false, targetEndTime: null };
    });
  },
  
  setBreakTime: (minutes: number) => {
    set((state) => {
      const newTimeLeft = state.mode === 'break' ? minutes * 60 : state.timeLeft;
      return { breakTime: minutes, timeLeft: newTimeLeft, isRunning: false, targetEndTime: null };
    });
  },

  start: () => {
    set((state) => {
      if (state.isRunning) return state;
      return {
        isRunning: true,
        targetEndTime: Date.now() + state.timeLeft * 1000,
      };
    });
  },

  pause: () => {
    set({ isRunning: false, targetEndTime: null });
  },

  reset: () => {
    set((state) => ({
      isRunning: false,
      targetEndTime: null,
      timeLeft: state.mode === 'focus' ? state.totalFocusTime * 60 : state.breakTime * 60,
    }));
  },

  tick: () => {
    set((state) => {
      if (!state.isRunning || state.timeLeft <= 0) return state;
      const newTimeLeft = state.timeLeft - 1;
      // Auto-switch mode when timer hits zero and auto-start
      if (newTimeLeft <= 0) {
        // Log focus time if finishing focus mode
        if (state.mode === 'focus') {
          const user = useAuthStore.getState().user;
          if (user) {
            supabase.rpc('log_focus_time', {
              user_id: user.id,
              minutes_added: state.totalFocusTime
            }).then(({ error }) => {
              if (error) console.error('Failed to log focus time:', error);
            });
          }
        }

        const nextMode = state.mode === 'focus' ? 'break' : 'focus';
        const nextTimeLeft = nextMode === 'focus' ? state.totalFocusTime * 60 : state.breakTime * 60;
        
        return { 
          mode: nextMode, 
          timeLeft: nextTimeLeft, 
          isRunning: true, 
          targetEndTime: Date.now() + nextTimeLeft * 1000 
        };
      }
      
      return { timeLeft: newTimeLeft };
    });
  },
  
  switchMode: () => {
    set((state) => {
      const newMode = state.mode === 'focus' ? 'break' : 'focus';
      const newTimeLeft = newMode === 'focus' ? state.totalFocusTime * 60 : state.breakTime * 60;
      return {
        mode: newMode,
        timeLeft: newTimeLeft,
        isRunning: false,
        targetEndTime: null,
      };
    });
  },

  syncFromBackground: () => {
    set((state) => {
      if (!state.isRunning || !state.targetEndTime) return state;
      
      const now = Date.now();
      const remainingMs = state.targetEndTime - now;
      
      if (remainingMs <= 0) {
        // Log focus time if finished in background
        if (state.mode === 'focus') {
          const user = useAuthStore.getState().user;
          if (user) {
            supabase.rpc('log_focus_time', {
              user_id: user.id,
              minutes_added: state.totalFocusTime
            }).catch(e => console.error(e));
          }
        }

        const nextMode = state.mode === 'focus' ? 'break' : 'focus';
        const nextTimeLeft = nextMode === 'focus' ? state.totalFocusTime * 60 : state.breakTime * 60;
        // In background, auto-start might drift or be blocked, but we'll try to auto-start anyway
        // Or actually, it's safer to just start it.
        return { 
          mode: nextMode, 
          timeLeft: nextTimeLeft, 
          isRunning: true, 
          targetEndTime: Date.now() + nextTimeLeft * 1000 
        };
      }
      
      return { timeLeft: Math.ceil(remainingMs / 1000) };
    });
  },
}));
