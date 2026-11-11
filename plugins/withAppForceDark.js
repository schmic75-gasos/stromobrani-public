const { withAndroidStyles } = require('@expo/config-plugins');

module.exports = function withAppForceDark(config) {
  return withAndroidStyles(config, (config) => {
    const resources = config.modResults.resources;
    const appTheme = (resources.style || []).find((style) => style.$?.name === 'AppTheme');
    if (appTheme) {
      appTheme.item = appTheme.item || [];
      const forceDark = appTheme.item.find((item) => item.$?.name === 'android:forceDarkAllowed');
      if (forceDark) forceDark._ = 'true';
      else appTheme.item.push({ $: { name: 'android:forceDarkAllowed' }, _: 'true' });
    }
    return config;
  });
};
