import notifee, { AndroidImportance, TimestampTrigger, TriggerType } from 'react-native-notify-kit';
import { useSettingsStore } from '@/store/settingsStore';

let isServiceRunning = false;
let channelId: string | null = null;
let stopServiceCallback: ((value?: unknown) => void) | null = null;

const formatEndTime = (timeLeftSeconds: number) => {
  const endTime = new Date(Date.now() + timeLeftSeconds * 1000);
  return endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export async function startForegroundService(mode: string, timeLeft: number) {
  if (isServiceRunning) return;
  isServiceRunning = true;

  if (!channelId) {
    channelId = await notifee.createChannel({
      id: 'pomoduo_timer',
      name: 'Timer Service',
      importance: AndroidImportance.HIGH,
    });
  }

  // Register the service and keep the promise pending until we stop it
  notifee.registerForegroundService((notification) => {
    return new Promise((resolve) => {
      stopServiceCallback = resolve;
    });
  });

  await updateTimerNotification(mode, timeLeft, true);
}

export async function updateTimerNotification(mode: string, timeLeft: number, isRunning: boolean) {
  if (!channelId) {
    channelId = await notifee.createChannel({
      id: 'pomoduo_timer',
      name: 'Timer Service',
      importance: AndroidImportance.HIGH,
    });
  }

  const modeStr = mode === 'focus' ? 'Focusing' : 'Break Time';

  if (!isRunning) {
    // Stop the alarm trigger if paused
    await notifee.cancelNotification('timer-end');
    
    if (isServiceRunning) {
      await notifee.displayNotification({
        id: 'timer-service',
        title: `PomoDuo - ${modeStr} (Paused)`,
        body: `Timer paused.`,
        android: {
          channelId,
          asForegroundService: true,
          ongoing: true,
          smallIcon: 'ic_launcher',
          onlyAlertOnce: true,
        },
      });
    }
    return;
  }

  const endStr = formatEndTime(timeLeft);

  // Update foreground static notification
  if (isServiceRunning) {
    await notifee.displayNotification({
      id: 'timer-service',
      title: `PomoDuo - ${modeStr}`,
      body: `Ends at ${endStr}`,
      android: {
        channelId,
        asForegroundService: true,
        ongoing: true,
        smallIcon: 'ic_launcher',
        onlyAlertOnce: true,
      },
    });
  }

  // Schedule Native Trigger Alarm
  await notifee.cancelNotification('timer-end');
  
  const { soundEnabled } = useSettingsStore.getState();
  
  if (timeLeft > 0) {
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: Date.now() + (timeLeft * 1000),
      alarmManager: true, // Guarantees exact delivery on Android
    };

    const notificationPayload = {
      id: 'timer-end',
      title: `Time's up!`,
      body: `Your ${mode} session has ended.`,
      android: {
        channelId,
        smallIcon: 'ic_launcher',
        importance: AndroidImportance.HIGH,
        sound: soundEnabled ? 'default' : undefined,
      },
    };

    try {
      await notifee.createTriggerNotification(notificationPayload, trigger);
    } catch (e) {
      // Fallback if SCHEDULE_EXACT_ALARM permission is denied on Android 12+
      console.warn('AlarmManager failed, falling back without exact delivery.', e);
      trigger.alarmManager = false;
      await notifee.createTriggerNotification(notificationPayload, trigger).catch(console.error);
    }
  }
}

export async function stopForegroundService() {
  isServiceRunning = false;
  await notifee.cancelNotification('timer-end');
  await notifee.stopForegroundService();
  if (stopServiceCallback) {
    stopServiceCallback();
    stopServiceCallback = null;
  }
}
