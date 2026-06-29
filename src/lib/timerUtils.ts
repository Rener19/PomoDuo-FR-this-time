import BackgroundTimer from 'react-native-background-timer';

export const safeSetInterval = (callback: () => void, ms: number): any => {
  try {
    // This will throw if the NativeModule is null (e.g. app wasn't rebuilt)
    const id = BackgroundTimer.setInterval(callback, ms);
    if (id === undefined || id === null) {
        throw new Error('BackgroundTimer returned invalid id');
    }
    return { id, isBackground: true };
  } catch (e) {
    console.warn('Native BackgroundTimer missing or failed. Falling back to standard setInterval. Did you rebuild the app?');
    return { id: setInterval(callback, ms), isBackground: false };
  }
};

export const safeClearInterval = (intervalObj: any) => {
  if (!intervalObj) return;
  try {
    if (intervalObj.isBackground) {
      BackgroundTimer.clearInterval(intervalObj.id);
    } else {
      clearInterval(intervalObj.id);
    }
  } catch (e) {
    clearInterval(intervalObj.id || intervalObj);
  }
};
