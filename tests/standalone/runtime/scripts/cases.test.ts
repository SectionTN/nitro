import { afterEach, expect, test } from "bun:test";
import { registerTests } from "../js/index";

const originalRun = globalThis.runNitroTest;
const originalTimeout = globalThis.getNitroTestTimeoutMs;
afterEach(() => {
  globalThis.runNitroTest = originalRun;
  globalThis.getNitroTestTimeoutMs = originalTimeout;
});

test("unannotated cases leave the native default unchanged", async () => {
  let called = false;
  registerTests({
    ordinary: () => {
      called = true;
    },
  });
  expect(globalThis.getNitroTestTimeoutMs("ordinary")).toBeUndefined();
  await globalThis.runNitroTest("ordinary");
  expect(called).toBe(true);
});

test("timeout lookup rejects unknown and inherited case names", () => {
  registerTests({ ordinary: () => {} });
  for (const name of ["missing", "constructor"]) {
    expect(() => globalThis.getNitroTestTimeoutMs(name)).toThrow(
      `Unknown Nitro test: ${name}`,
    );
  }
});
