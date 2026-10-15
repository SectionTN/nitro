module.exports = {
  presets: ['module:@react-native/babel-preset'],
  overrides: [
    {
      // Nitro specs use `@iOS(...)`/`@Android(...)` on `export declare class`es, Babel only needs to parse them.
      test: /\.nitro\.tsx?$/,
      parserOpts: { plugins: [['decorators', { version: '2023-11' }]] },
    },
  ],
}
