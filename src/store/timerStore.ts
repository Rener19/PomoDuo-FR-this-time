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
  savedFocusTimeLeft: number | null;
  savedBreakTimeLeft: number | null;
  
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
  savedFocusTimeLeft: null,
  savedBreakTimeLeft: null,

  setTotalFocusTime: (minutes: number) => {
    set((state) => {
      const diffMinutes = minutes - state.totalFocusTime;
      if (diffMinutes < 0) {
        if (state.mode === 'focus' && state.timeLeft < 60) return state;
        if (state.mode !== 'focus' && state.savedFocusTimeLeft !== null && state.savedFocusTimeLeft < 60) return state;
      }

      let newTimeLeft = state.timeLeft;
      let newSavedFocus = state.savedFocusTimeLeft;

      if (state.mode === 'focus') {
        newTimeLeft = Math.max(0, state.timeLeft + (diffMinutes * 60));
      } else {
        if (state.savedFocusTimeLeft !== null) {
          newSavedFocus = Math.max(0, state.savedFocusTimeLeft + (diffMinutes * 60));
        }
      }
      return { totalFocusTime: minutes, timeLeft: newTimeLeft, savedFocusTimeLeft: newSavedFocus, isRunning: false, targetEndTime: null };
    });
  },
  
  setBreakTime: (minutes: number) => {
    set((state) => {
      const diffMinutes = minutes - state.breakTime;
      if (diffMinutes < 0) {
        if (state.mode === 'break' && state.timeLeft < 60) return state;
        if (state.mode !== 'break' && state.savedBreakTimeLeft !== null && state.savedBreakTimeLeft < 60) return state;
      }

      let newTimeLeft = state.timeLeft;
      let newSavedBreak = state.savedBreakTimeLeft;

      if (state.mode === 'break') {
        newTimeLeft = Math.max(0, state.timeLeft + (diffMinutes * 60));
      } else {
        if (state.savedBreakTimeLeft !== null) {
          newSavedBreak = Math.max(0, state.savedBreakTimeLeft + (diffMinutes * 60));
        }
      }
      return { breakTime: minutes, timeLeft: newTimeLeft, savedBreakTimeLeft: newSavedBreak, isRunning: false, targetEndTime: null };
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
      savedFocusTimeLeft: null,
      savedBreakTimeLeft: null,
    }));
  },

  tick: () => {
    set((state) => {
      if (!state.isRunning || !state.targetEndTime || state.timeLeft <= 0) return state;
      const remainingMs = state.targetEndTime - Date.now();
      const newTimeLeft = Math.max(0, Math.ceil(remainingMs / 1000));

      // Auto-switch mode when timer hits zero and auto-start
      if (newTimeLeft <= 0) {
        // Log focus time if finishing focus mode
        if (state.mode === 'focus') {
          const user = useAuthStore.getState().user;
          if (user) {
            (async () => {
              const { error } = await supabase.rpc('log_focus_time', {
                user_id: user.id,
                minutes_added: state.totalFocusTime
              });
              if (error) console.error('Failed to log focus time:', error);
            })();
          }
        }

        const nextMode = state.mode === 'focus' ? 'break' : 'focus';
        const nextTimeLeft = nextMode === 'focus' ? state.totalFocusTime * 60 : state.breakTime * 60;
        const newTargetEndTime = state.targetEndTime + nextTimeLeft * 1000;
        
        return { 
          mode: nextMode, 
          timeLeft: nextTimeLeft, 
          isRunning: true, 
          targetEndTime: newTargetEndTime,
          savedFocusTimeLeft: nextMode === 'focus' ? null : state.savedFocusTimeLeft,
          savedBreakTimeLeft: nextMode === 'break' ? null : state.savedBreakTimeLeft,
        };
      }
      
      return { timeLeft: newTimeLeft };
    });
  },
  
  switchMode: () => {
    set((state) => {
      const newMode = state.mode === 'focus' ? 'break' : 'focus';
      const savedFocus = state.mode === 'focus' ? state.timeLeft : state.savedFocusTimeLeft;
      const savedBreak = state.mode === 'break' ? state.timeLeft : state.savedBreakTimeLeft;
      
      let restoredTime = newMode === 'focus' ? savedFocus : savedBreak;
      if (restoredTime === null) {
        restoredTime = newMode === 'focus' ? state.totalFocusTime * 60 : state.breakTime * 60;
      }

      return {
        mode: newMode,
        timeLeft: restoredTime,
        savedFocusTimeLeft: savedFocus,
        savedBreakTimeLeft: savedBreak,
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
            (async () => {
              const { error } = await supabase.rpc('log_focus_time', {
                user_id: user.id,
                minutes_added: state.totalFocusTime
              });
              if (error) console.error(error);
            })();
          }
        }

        const nextMode = state.mode === 'focus' ? 'break' : 'focus';
        const nextTimeLeft = nextMode === 'focus' ? state.totalFocusTime * 60 : state.breakTime * 60;
        const newTargetEndTime = state.targetEndTime + nextTimeLeft * 1000;
        
        return { 
          mode: nextMode, 
          timeLeft: nextTimeLeft, 
          isRunning: true, 
          targetEndTime: newTargetEndTime,
          savedFocusTimeLeft: nextMode === 'focus' ? null : state.savedFocusTimeLeft,
          savedBreakTimeLeft: nextMode === 'break' ? null : state.savedBreakTimeLeft,
        };
      }
      
      return { timeLeft: Math.ceil(remainingMs / 1000) };
    });
  },
}));
