import { expect } from "chai";
import { casesForTestObjects } from "./utils/cases";

import { getNitroModules } from "nitro-core";

const NitroModules = getNitroModules();

export const cases = {
  ...casesForTestObjects("Promises under parallel load", {
    // Resolves a HybridObject off the JS thread; the race is between resolve() and
    // JSIConverter::toJSI reading Promise state on the JS thread. Passes
    // functionally; the verdict is Thread Sanitizer.

    "newTestObjectAsync() does not data-race (run under Thread Sanitizer)":
      async (testObject) => {
        let objects: object[] = [];
        for (let round = 0; round < 20; round++) {
          objects = await Promise.all(
            Array.from({ length: 32 }, () => testObject.newTestObjectAsync()),
          );
        }
        // Only check the last round, so the stress loop itself stays cheap.
        expect(objects).to.have.length(32);
        for (const object of objects) {
          expect(Object.is(NitroModules.isHybridObject(object), true)).to.equal(
            true,
          );
        }
      },
  }),
};
