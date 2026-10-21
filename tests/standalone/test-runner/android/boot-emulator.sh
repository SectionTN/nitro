#!/usr/bin/env bash
set -euo pipefail

"$ANDROID_HOME/emulator/emulator" -avd nitro-tests -port 5554 -cores 2 -accel on \
  -no-window -gpu swiftshader -no-snapshot -noaudio -no-boot-anim -camera-back none </dev/null >emulator.log 2>&1 &
emulator_pid=$!
echo "NITRO_EMULATOR_PID=$emulator_pid" >> "$GITHUB_ENV"
echo "ANDROID_SERIAL=emulator-5554" >> "$GITHUB_ENV"

while true; do
  if ! kill -0 "$emulator_pid" 2>/dev/null; then
    cat emulator.log
    exit 1
  fi
  if [[ "$(adb -s emulator-5554 shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == 1 ]]; then
    break
  fi
  sleep 1
done

for setting in window_animation_scale transition_animation_scale animator_duration_scale; do
  adb -s emulator-5554 shell settings put global "$setting" 0
done
