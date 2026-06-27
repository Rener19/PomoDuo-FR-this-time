import { create } from 'zustand';

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
      
      // Auto-switch mode when timer hits zero (this will be handled by components listening to timeLeft too)
      if (newTimeLeft <= 0) {
        return { timeLeft: 0, isRunning: false, targetEndTime: null };
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
        return { timeLeft: 0, isRunning: false, targetEndTime: null };
      }
      
      return { timeLeft: Math.ceil(remainingMs / 1000) };
    });
  },
}));
