module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
          alias: {
            '@api': './src/api',
            '@auth': './src/auth',
            '@db': './src/db',
            '@geo': './src/geo',
            '@sync': './src/sync',
            '@features': './src/features',
            '@lib': './src/lib',
          },
        },
      ],
    ],
  };
};
