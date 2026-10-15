// const path = require('path');
// const pak = require('../package.json');

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        extensions: ['.tsx', '.ts', '.js', '.json'],
        // alias: {
        //   [pak.name]: path.join(__dirname, '..', pak.source),
        // },
      },
    ],
  ],
  overrides: [
    {
      // Nitro specs use `@iOS(...)`/`@Android(...)` on `export declare class`es, Babel only needs to parse them.
      test: /\.nitro\.tsx?$/,
      parserOpts: { plugins: [['decorators', { version: '2023-11' }]] },
    },
  ],
}
