import notifee, { AndroidImportance, TimestampTrigger, TriggerType, AndroidVisibility, AndroidCategory } from 'react-native-notify-kit';
import { useSettingsStore } from '@/store/settingsStore';

let isServiceRunning = false;
let serviceChannelId: string | null = null;
let alarmChannelSoundId: string | null = null;
let alarmChannelSilentId: string | null = null;
let stopServiceCallback: ((value?: unknown) => void) | null = null;

const formatEndTime = (timeLeftSeconds: number) => {
  const endTime = new Date(Date.now() + timeLeftSeconds * 1000);
  return endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export async function startForegroundService(mode: string, timeLeft: number, targetEndTime: number | null = null) {
  if (!serviceChannelId) {
    serviceChannelId = await notifee.createChannel({
      id: 'pomoduo_timer_service',
      name: 'Timer Service',
      importance: AndroidImportance.LOW, // Low importance for persistent timer (no sound)
    });
  }

  if (!isServiceRunning) {
    isServiceRunning = true;
    notifee.registerForegroundService((notification) => {
      return new Promise((resolve) => {
        stopServiceCallback = resolve;
      });
    });
  }

  await updateTimerNotification(mode, timeLeft, true, targetEndTime);
}

export async function updateTimerNotification(mode: string, timeLeft: number, isRunning: boolean, targetEndTime: number | null = null) {
  if (!serviceChannelId) {
    serviceChannelId = await notifee.createChannel({
      id: 'pomoduo_timer_service',
      name: 'Timer Service',
      importance: AndroidImportance.LOW,
    });
  }
  if (!alarmChannelSoundId) {
    alarmChannelSoundId = await notifee.createChannel({
      id: 'pomoduo_alarms_custom_v1',
      name: 'Timer Alarms (Sound)',
      importance: AndroidImportance.HIGH,
      sound: 'pomoduo_alarm',
      visibility: AndroidVisibility.PUBLIC,
    });
  }
  if (!alarmChannelSilentId) {
    alarmChannelSilentId = await notifee.createChannel({
      id: 'pomoduo_alarms_silent_v1',
      name: 'Timer Alarms (Silent)',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
    });
  }

  const modeStr = mode === 'focus' ? 'Focusing' : 'Break Time';

  if (!isRunning) {
    // Stop the alarm if paused
    await notifee.cancelNotification(`timer-end-${mode}`);
    await notifee.cancelTriggerNotification(`timer-end-${mode}`);
    
    if (isServiceRunning) {
      await notifee.displayNotification({
        id: 'timer-service',
        title: `PomoDuo - ${modeStr} (Paused)`,
        body: `Timer paused.`,
        android: {
          channelId: serviceChannelId,
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
        channelId: serviceChannelId,
        asForegroundService: true,
        ongoing: true,
        smallIcon: 'ic_launcher',
        onlyAlertOnce: true,
      },
    });
  }

  // Cancel previous pending trigger for this mode before setting a new one
  await notifee.cancelTriggerNotification(`timer-end-${mode}`);
  
  const { soundEnabled } = useSettingsStore.getState();
  
  if (timeLeft > 0) {
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: targetEndTime || Date.now() + (timeLeft * 1000),
      alarmManager: true, // Guarantees exact delivery on Android
    };

    const notificationPayload = {
      id: `timer-end-${mode}`,
      title: `Time's up!`,
      body: `Your ${mode} session has ended.`,
      android: {
        channelId: soundEnabled ? alarmChannelSoundId : alarmChannelSilentId,
        smallIcon: 'ic_launcher',
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
        category: AndroidCategory.ALARM,
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

export async function clearAlarmNotification(mode: string) {
  await notifee.cancelNotification(`timer-end-${mode}`);
}

export async function stopForegroundService() {
  isServiceRunning = false;
  await notifee.cancelNotification('timer-end-focus');
  await notifee.cancelTriggerNotification('timer-end-focus');
  await notifee.cancelNotification('timer-end-break');
  await notifee.cancelTriggerNotification('timer-end-break');
  await notifee.stopForegroundService();
  if (stopServiceCallback) {
    stopServiceCallback();
    stopServiceCallback = null;
  }
}
