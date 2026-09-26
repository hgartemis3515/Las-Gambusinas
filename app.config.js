const appJson = require('./app.json');

/**
 * Expo Go no puede bajar el OTA del APK (runtime 1.0.26) y falla con
 * "Failed to download remote update". El URL de updates solo va en
 * eas build / eas update (NODE_ENV=production o EAS_BUILD).
 */
const publicarOta =
  process.env.EAS_BUILD === 'true' ||
  process.env.NODE_ENV === 'production';

const expo = {
  ...appJson.expo,
  updates: publicarOta
    ? appJson.expo.updates
    : {
        enabled: false,
        checkAutomatically: 'NEVER',
        fallbackToCacheTimeout: 0,
      },
};

module.exports = { expo };
