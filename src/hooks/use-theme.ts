/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useSettingsStore } from '@/store/settingsStore';
import { useTimerStore } from '@/store/timerStore';
import { useDuoStore } from '@/store/duoStore';

export function useTheme() {
  const { isDarkMode } = useSettingsStore();
  const duoState = useDuoStore();
  const timerState = useTimerStore();
  
  const theme = isDarkMode ? 'dark' : 'light';
  const isDuo = !!duoState.sessionId && !duoState.waitingForFriends;
  const mode = isDuo ? duoState.mode : timerState.mode;

  return Colors[theme][mode];
}
