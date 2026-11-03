const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withTreeAndroidWidget(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) throw new Error('Android manifest application node is missing.');

    const receivers = application.receiver || [];
    const provider = 'expo.modules.stromobraniwidget.TreeWidgetProvider';
    application.receiver = receivers.filter((receiver) => receiver.$?.['android:name'] !== provider);
    application.receiver.push({
      $: {
        'android:name': provider,
        'android:exported': 'true',
        'android:label': '@string/tree_widget_name',
      },
      'intent-filter': [{
        action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }],
      }],
      'meta-data': [{
        $: {
          'android:name': 'android.appwidget.provider',
          'android:resource': '@xml/tree_widget_info',
        },
      }],
    });
    return config;
  });
};
