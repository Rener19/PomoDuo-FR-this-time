const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withAndroidAlarmSound = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const resPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'raw');
      const soundSource = path.join(projectRoot, 'assets', 'sounds', 'pomoduo_alarm.wav');
      const soundDest = path.join(resPath, 'pomoduo_alarm.wav');

      if (!fs.existsSync(resPath)) {
        fs.mkdirSync(resPath, { recursive: true });
      }

      if (fs.existsSync(soundSource)) {
        fs.copyFileSync(soundSource, soundDest);
      }

      return config;
    },
  ]);
};

module.exports = withAndroidAlarmSound;
