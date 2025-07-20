// forge.config.cjs
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const path = require('path')
module.exports = {
  packagerConfig: {
    asar: true,
    extraResource: [
      path.join(__dirname, '.vite-electron')
    ]
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'posture_monitor'
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
