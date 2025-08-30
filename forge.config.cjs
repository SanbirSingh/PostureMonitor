const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: './public/icon',
    // extraResource: ['./public/icon.png']
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'posture_monitor',
        // setupIcon: './public/icon.png'
      }
    }
  ],
  plugins: [
    [
      '@electron-forge/plugin-vite',
      {
        build: [
          {
            entry: '.vite-electron/main.js',
            config: 'vite.config.js'
          },
          {
            entry: '.vite-electron/preload.js',
            config: 'vite.config.js'
          }
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.config.js'
          }
        ]
      }
    ],
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    })
  ]
};
