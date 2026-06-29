import { useRef, useEffect } from 'react';
import { initNotifications } from './notifications';
import { useTimerStore } from '@/store/timerStore';
import { useDuoStore } from '@/store/duoStore';
import { useAuthStore } from '@/store/authStore';
import { startForegroundService, updateTimerNotification, stopForegroundService } from '@/services/timerForegroundService';

export function NotificationManager() {
  const soloTimer = useTimerStore();
  const duoTimer = useDuoStore();
  const { user } = useAuthStore();

  useEffect(() => {
    initNotifications();
  }, []);

  useEffect(() => {
    if (user) {
      duoTimer.subscribeToInvites(user.id);
    }
  }, [user]);

  const lastTargetEndRef = useRef(0);
  const lastModeRef = useRef('');

  // Start foreground service when timer is running, stop when paused
  useEffect(() => {
    const activeTimer = duoTimer.sessionId ? duoTimer : soloTimer;
    
    if (activeTimer.isRunning) {
      const targetEnd = Date.now() + (activeTimer.timeLeft * 1000);
      const isModeChange = lastModeRef.current !== activeTimer.mode;
      const isTimeAdjusted = Math.abs(targetEnd - lastTargetEndRef.current) > 2000; // changed by more than 2s

      if (isModeChange || isTimeAdjusted || lastTargetEndRef.current === 0) {
        lastTargetEndRef.current = targetEnd;
        lastModeRef.current = activeTimer.mode;
        startForegroundService(activeTimer.mode, activeTimer.timeLeft);
      }
    } else {
      // Stopped or Paused
      if (lastTargetEndRef.current !== 0) {
        lastTargetEndRef.current = 0;
        updateTimerNotification(activeTimer.mode, activeTimer.timeLeft, false);
      }
      
      if (activeTimer.timeLeft === (activeTimer.mode === 'focus' ? activeTimer.totalFocusTime * 60 : activeTimer.breakTime * 60)) {
         // Reset pressed
         stopForegroundService();
      }
    }
  }, [
    soloTimer.isRunning, soloTimer.timeLeft, soloTimer.mode, soloTimer.totalFocusTime, soloTimer.breakTime,
    duoTimer.sessionId, duoTimer.isRunning, duoTimer.timeLeft, duoTimer.mode, duoTimer.focusTime, duoTimer.breakTime
  ]);

  return null;
}
