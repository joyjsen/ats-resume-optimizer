const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withBackgroundActionsFixed(config) {
    return withAndroidManifest(config, async (config) => {
        const androidManifest = config.modResults;
        const mainApplication = androidManifest.manifest.application[0];

        if (!mainApplication.service) {
            mainApplication.service = [];
        }

        const serviceName = 'com.asterinet.react.bgactions.RNBackgroundActionsTask';
        const existingService = mainApplication.service.find(
            (s) => s.$['android:name'] === serviceName
        );

        if (existingService) {
            existingService.$['android:foregroundServiceType'] = 'shortService';
            console.log(`[ConfigPlugin] Updated existing service ${serviceName} with foregroundServiceType="shortService"`);
        } else {
            mainApplication.service.push({
                $: {
                    'android:name': serviceName,
                    'android:enabled': 'true',
                    'android:exported': 'false',
                    'android:foregroundServiceType': 'shortService',
                },
            });
            console.log(`[ConfigPlugin] Added new service ${serviceName} with foregroundServiceType="dataSync"`);
        }

        return config;
    });
};
