import { useRef, useEffect } from 'react';
import { initNotifications } from './notifications';
import { useTimerStore } from '@/store/timerStore';
import { useDuoStore } from '@/store/duoStore';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { startForegroundService, updateTimerNotification, stopForegroundService, clearAlarmNotification, triggerImmediateAlarm } from '@/services/timerForegroundService';

export function NotificationManager() {
  const soloTimer = useTimerStore();
  const duoTimer = useDuoStore();
  const { user } = useAuthStore();
  const { soundEnabled } = useSettingsStore();

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
  const lastSoundEnabledRef = useRef(soundEnabled);
  const lastSessionIdRef = useRef<string | null>(null);

  // Start foreground service when timer is running, stop when paused
  useEffect(() => {
    // If we have a sessionId BUT we are waitingForFriends, DuoTimer is unmounted 
    // and soloTimer is the one ticking on the screen. So we must use soloTimer.
    const activeTimer = (duoTimer.sessionId && !duoTimer.waitingForFriends) ? duoTimer : soloTimer;
    
    if (activeTimer.isRunning) {
      const targetEnd = Date.now() + (activeTimer.timeLeft * 1000);
      const isModeChange = lastModeRef.current !== activeTimer.mode;
      const isSoundChange = lastSoundEnabledRef.current !== soundEnabled;
      const isTimeAdjusted = Math.abs(targetEnd - lastTargetEndRef.current) > 2000; // changed by more than 2s
      const currentSessionId = activeTimer === duoTimer ? duoTimer.sessionId : null;
      const isSessionChange = lastSessionIdRef.current !== currentSessionId;

      if (isModeChange || isTimeAdjusted || isSoundChange || isSessionChange || lastTargetEndRef.current === 0) {
        const oldTargetEnd = lastTargetEndRef.current;
        lastTargetEndRef.current = targetEnd;
        lastModeRef.current = activeTimer.mode;
        lastSoundEnabledRef.current = soundEnabled;
        lastSessionIdRef.current = currentSessionId;
        
        if (isModeChange && oldTargetEnd !== 0) {
          const ringingMode = activeTimer.mode === 'focus' ? 'break' : 'focus';
          
          // Check if the timer ended naturally (Date.now() is past or very close to oldTargetEnd)
          // Use 2000ms buffer to account for JS interval timing
          const timerEndedNaturally = Date.now() >= oldTargetEnd - 2000;

          if (timerEndedNaturally) {
            // Force play the alarm immediately to bypass Android AlarmManager batching/delays
            triggerImmediateAlarm(ringingMode);
            
            // Let the alarm ring fully, then clear it from the notification tray after 8 seconds
            setTimeout(() => {
              clearAlarmNotification(ringingMode);
            }, 8000);
            
            // Delay updating the service by 2 seconds to allow the alarm sound to play without OS suppression
            setTimeout(() => {
              startForegroundService(activeTimer.mode, activeTimer.timeLeft, activeTimer.targetEndTime);
            }, 2000);
          } else {
            // User manually skipped the timer or joined a session!
            // Clear any pending old alarms immediately so they don't suddenly play
            clearAlarmNotification(ringingMode);
            startForegroundService(activeTimer.mode, activeTimer.timeLeft, activeTimer.targetEndTime);
          }
        } else {
          startForegroundService(activeTimer.mode, activeTimer.timeLeft, activeTimer.targetEndTime);
        }
      }
    } else {
      // Stopped or Paused
      if (lastTargetEndRef.current !== 0) {
        lastTargetEndRef.current = 0;
        updateTimerNotification(activeTimer.mode, activeTimer.timeLeft, false, null);
      }
      
      const initialFocus = 'totalFocusTime' in activeTimer ? activeTimer.totalFocusTime : activeTimer.focusTime;
      if (activeTimer.timeLeft === (activeTimer.mode === 'focus' ? initialFocus * 60 : activeTimer.breakTime * 60)) {
         // Reset pressed
         stopForegroundService();
      }
    }
  }, [
    soloTimer.isRunning, soloTimer.timeLeft, soloTimer.mode, soloTimer.totalFocusTime, soloTimer.breakTime,
    duoTimer.sessionId, duoTimer.isRunning, duoTimer.timeLeft, duoTimer.mode, duoTimer.focusTime, duoTimer.breakTime,
    soundEnabled
  ]);

  return null;
}
