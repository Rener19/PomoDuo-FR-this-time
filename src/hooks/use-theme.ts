/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useSettingsStore } from '@/store/settingsStore';

export function useTheme() {
  const { isDarkMode } = useSettingsStore();
  const theme = isDarkMode ? 'dark' : 'light';

  return Colors[theme];
}
