# Test environments

- [Standalone](standalone/): Hermes, Nitro Core, and generated bindings, run through Swift Testing and JUnit without React Native.
- [React Native](react-native/): Example app, Harness integration and View tests, native build integration, fixture libraries, and benchmarks.

Both environments use the workspace Core and Nitrogen packages. Run `bun specs:all` to regenerate their committed bindings. Portable runtime coverage runs in the standalone environment; React Native integration and View tests stay in Harness.
