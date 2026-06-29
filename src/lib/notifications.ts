import notifee, { AndroidImportance } from 'react-native-notify-kit';

const CHANNEL_ID = 'pomoduo_timer';

export async function initNotifications() {
  await notifee.requestPermission();
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'PomoDuo Timer',
    importance: AndroidImportance.LOW,
  });
}

export async function showTimerNotification(title: string, body: string, targetEndTime: number | null) {
  if (!targetEndTime) {
    return stopTimerNotification();
  }

  await notifee.displayNotification({
    id: 'pomoduo_active_timer',
    title,
    body,
    android: {
      channelId: CHANNEL_ID,
      asForegroundService: true,
      color: '#208AEF',
      ongoing: true,
      onlyAlertOnce: true,
      usesChronometer: true,
      chronometerDirection: 'down',
      timestamp: targetEndTime,
    },
  });
}

export async function stopTimerNotification() {
  await notifee.stopForegroundService();
  await notifee.cancelNotification('pomoduo_active_timer');
}

// Background event handler (required by Notifee for foreground services)
notifee.registerForegroundService((notification) => {
  return new Promise(() => {
    // Keep the service running
  });
});
