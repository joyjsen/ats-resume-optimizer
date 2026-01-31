const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withPodfileClangFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      // Check if Podfile exists (it should in managed workflow during prebuild)
      if (!fs.existsSync(podfilePath)) {
        return config;
      }

      let podfileContent = fs.readFileSync(podfilePath, 'utf8');

      // The fix we need to inject - this addresses the C99 implicit int errors
      // in @react-native-firebase/storage with Xcode 16+
      const clangFix = `
    # Fix for Xcode 16+ C99 implicit int errors in react-native-firebase
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        # Suppress C99 implicit int warnings/errors for older native code
        config.build_settings['OTHER_CFLAGS'] ||= '$(inherited)'
        config.build_settings['OTHER_CFLAGS'] += ' -Wno-implicit-int -Wno-strict-prototypes -Wno-error=implicit-int'
        config.build_settings['GCC_TREAT_IMPLICIT_FUNCTION_DECLARATIONS_AS_ERRORS'] = 'NO'
      end
    end
`;

      // Check if our fix is already present
      if (podfileContent.includes('-Wno-implicit-int')) {
        console.log('[withPodfileClangFix] Clang fix already present, skipping...');
        return config;
      }

      // Regex to find the post_install block
      const postInstallRegex = /post_install\s+do\s+\|(\w+)\|/;
      const match = podfileContent.match(postInstallRegex);

      if (match) {
        // Inject inside existing block, right after the opening
        const installerVar = match[1]; // usually 'installer'
        const injectionWithVar = clangFix.replace(/installer/g, installerVar);
        podfileContent = podfileContent.replace(postInstallRegex, `${match[0]}${injectionWithVar}`);
      } else {
        // Create new block at the end
        podfileContent += `
post_install do |installer|${clangFix}end
`;
      }

      fs.writeFileSync(podfilePath, podfileContent);
      console.log('[withPodfileClangFix] Successfully added Clang fix to Podfile');
      return config;
    },
  ]);
};

module.exports = withPodfileClangFix;
