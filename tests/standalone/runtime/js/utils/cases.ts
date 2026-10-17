type Timeout = { timeoutMs?: number };
export type TestCase = (() => void | Promise<void>) & Timeout;

/** Give an expensive case an explicit native execution budget. */
export function withTestTimeout<
  Test extends (...args: never[]) => void | Promise<void>,
>(timeoutMs: number, test: Test): Test & { timeoutMs: number } {
  return Object.assign(test, { timeoutMs });
}
