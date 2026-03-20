const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Enable chunk splitting for better performance
  if (config.mode === 'production') {
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        maxInitialRequests: 20,
        maxAsyncRequests: 20,
        cacheGroups: {
          // Separate vendor chunks
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom|react-native-web)[\\/]/,
            name: 'vendor-react',
            chunks: 'all',
            priority: 40,
          },
          firebase: {
            test: /[\\/]node_modules[\\/](firebase|@firebase)[\\/]/,
            name: 'vendor-firebase',
            chunks: 'all',
            priority: 30,
          },
          // Icon fonts JS
          icons: {
            test: /[\\/]node_modules[\\/](@expo\/vector-icons|react-native-vector-icons)[\\/]/,
            name: 'vendor-icons',
            chunks: 'all',
            priority: 25,
          },
          // Rest of node_modules
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor-other',
            chunks: 'all',
            priority: 10,
          },
        },
      },
      runtimeChunk: 'single',
    };
  }

  return config;
};
