#!/bin/sh
set -eu

# Nitrogen uses flat <Module/Header.hpp> imports. Keep that include layout
# without copying or maintaining a second list of the native source headers.
prepare_headers() {
  module="$1"
  shift
  headers="${BUILT_PRODUCTS_DIR:?}/include/$module"
  staging=$(mktemp -d "${BUILT_PRODUCTS_DIR}/$module-headers.XXXXXX")
  trap 'rm -rf "$staging"' EXIT HUP INT TERM

  find "$@" -type d \( -name '*AppleCxx' -o -name include \) -prune -o -type f \
    \( -name '*.hpp' -o -name '*.h' \) -print | sort | while IFS= read -r header; do
    destination="$staging/$(basename "$header")"
    if [ -L "$destination" ]; then
      echo "error: Duplicate $module header name: $(basename "$header")" >&2
      exit 1
    fi
    ln -s "$header" "$destination"
  done

  mkdir -p "$(dirname "$headers")"
  rm -rf "$headers"
  mv "$staging" "$headers"
}

prepare_apple_module() {
  module="$1"
  generated="$2"
  source="$generated/ios/$module/include/$module"
  headers="${BUILT_PRODUCTS_DIR:?}/include/$module"
  if [ ! -d "$source" ]; then
    rm -rf "$headers"
    return
  fi

  # SwiftPM normally supplies this Clang module. The mixed Xcode fixture targets
  # expose the same generated declarations through a build-directory module map.
  staging=$(mktemp -d "${BUILT_PRODUCTS_DIR}/$module-headers.XXXXXX")
  trap 'rm -rf "$staging"' EXIT HUP INT TERM
  find "$source" -type f \( -name '*.hpp' -o -name '*.h' \) | sort | while IFS= read -r header; do
    # Forward to the source path so relative includes keep their original base.
    printf '#include "%s"\n' "$header" > "$staging/$(basename "$header")"
  done
  printf 'module %s {\n  requires cplusplus\n  header "%s.h"\n  export *\n}\n' \
    "$module" "$module" > "$staging/module.modulemap"
  rm -rf "$headers"
  mv "$staging" "$headers"
}

prepare_headers NitroModules \
  "${NITRO_NATIVE:?}/cpp/include/NitroModules" \
  "${NITRO_NATIVE}/apple/include/NitroModules" \
  "${NITRO_NATIVE}/apple/swift-bridge/include/NitroModules"
prepare_headers NitroTestExternal \
  "${NITRO_EXTERNAL_GENERATED:?}/shared" "${NITRO_EXTERNAL_GENERATED}/ios"
prepare_apple_module NitroTestAppleCxx "${NITRO_GENERATED:?}"
prepare_apple_module NitroTestExternalAppleCxx "$NITRO_EXTERNAL_GENERATED"
