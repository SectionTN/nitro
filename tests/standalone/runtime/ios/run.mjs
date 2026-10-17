import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const defaults = JSON.parse(
  readFileSync(new URL("./config.json", import.meta.url)),
);
const { values } = parseArgs({
  options: {
    os: { type: "string", default: defaults.os },
    device: { type: "string" },
    arch: { type: "string", default: defaults.arch },
    jobs: {
      type: "string",
      default: process.env.NITRO_TEST_JOBS ?? String(defaults.jobs),
    },
    destination: { type: "string", default: process.env.NITRO_IOS_DESTINATION },
    "skip-hermes-build": { type: "boolean", default: false },
    help: { type: "boolean", short: "h" },
  },
});
if (values.help) {
  console.log(`Usage: bun tests/standalone/runtime/ios/run.mjs [options]

Defaults live in tests/standalone/runtime/ios/config.json.
  --os VERSION          Simulator OS, e.g. 26 or 26.5 (default: ${defaults.os})
  --device NAME         Exact simulator name (default: ${defaults.device ?? "first available iPhone"})
  --arch ARCH           auto, arm64 or x86_64 (default: ${defaults.arch})
  --jobs N              Parallel build jobs (default: ${defaults.jobs})
  --destination VALUE   Explicit xcodebuild destination, overriding OS/device selection
  --skip-hermes-build    Reuse an XCFramework already built for this architecture/toolchain
  -h, --help            Show this help

DEVELOPER_DIR selects Xcode. NITRO_IOS_DESTINATION and NITRO_TEST_JOBS remain supported.`);
  process.exit(0);
}
if (!/^\d+(\.\d+){0,2}$/.test(values.os)) {
  throw new Error("--os must be a version such as 26 or 26.5");
}
if (!["auto", "arm64", "x86_64"].includes(values.arch)) {
  throw new Error("--arch must be auto, arm64 or x86_64");
}
const architecture =
  values.arch === "auto"
    ? { arm64: "arm64", x64: "x86_64" }[process.arch]
    : values.arch;
if (!architecture)
  throw new Error(`Unsupported host architecture: ${process.arch}`);
const jobs = Number(values.jobs);
if (!Number.isSafeInteger(jobs) || jobs < 1)
  throw new Error("--jobs must be a positive integer");

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const environment = { ...process.env };
if (
  !environment.DEVELOPER_DIR &&
  existsSync("/Applications/Xcode.app/Contents/Developer")
) {
  environment.DEVELOPER_DIR = "/Applications/Xcode.app/Contents/Developer";
}
function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: environment,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture) process.stderr.write(result.stderr ?? "");
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

let destination = values.destination;
if (!destination) {
  const { devices } = JSON.parse(
    run("xcrun", ["simctl", "list", "devices", "available", "--json"], true),
  );
  const deviceName = values.device ?? defaults.device;
  const runtimes = Object.keys(devices)
    .filter((name) => {
      const version = name.split(".iOS-")[1]?.replaceAll("-", ".");
      return version === values.os || version?.startsWith(`${values.os}.`);
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .reverse();
  const device = runtimes
    .flatMap((runtime) => devices[runtime])
    .find((item) =>
      deviceName ? item.name === deviceName : item.name.startsWith("iPhone"),
    );
  if (!device)
    throw new Error(
      `No available ${deviceName ?? "iPhone"} simulator matches iOS ${values.os}. Install one or select --os, --device or --destination.`,
    );
  destination = `platform=iOS Simulator,id=${device.udid}`;
}
if (values["skip-hermes-build"]) {
  const framework = path.join(
    root,
    "tests/standalone/.build/hermes/NitroTestHermes.xcframework",
  );
  if (!existsSync(path.join(framework, "Info.plist"))) {
    throw new Error(
      "No Hermes XCFramework found. Run without --skip-hermes-build first.",
    );
  }
} else {
  run(process.execPath, [
    "tests/standalone/hermes/build.mjs",
    "ios",
    "--arch",
    architecture,
    "--jobs",
    String(jobs),
    "--deployment-target",
    defaults.deploymentTarget,
  ]);
}
const results = path.join(root, "tests/standalone/.build/ios/results");
mkdirSync(results, { recursive: true });
run("xcodebuild", [
  "test",
  "-project",
  "tests/standalone/runtime/ios/NitroRuntimeTests.xcodeproj",
  "-scheme",
  "NitroRuntimeTests",
  "-destination",
  destination,
  "-derivedDataPath",
  "tests/standalone/.build/ios/DerivedData",
  "-resultBundlePath",
  path.join(results, `RuntimeTests-${Date.now()}.xcresult`),
  "-jobs",
  String(jobs),
  "-parallel-testing-enabled",
  "NO",
  "CODE_SIGNING_ALLOWED=NO",
  `ARCHS=${architecture}`,
  `IPHONEOS_DEPLOYMENT_TARGET=${defaults.deploymentTarget}`,
]);
