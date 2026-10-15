import type { SwiftProtocolConformance } from 'react-native-nitro-modules'
import type { SourceImport } from '../SourceFile.js'
import type { Type } from '../types/Type.js'

/**
 * Returns the import of the module declaring a conformance's protocol, or
 * `undefined` for a protocol in the spec's own module.
 */
export function getProtocolConformanceImport(
  conformance: SwiftProtocolConformance,
  access: SourceImport<'swift'>['access']
): SourceImport<'swift'> | undefined {
  if (conformance.module == null) {
    return undefined
  }
  return { language: 'swift', name: conformance.module, access: access }
}

/** Collect dependencies at the access level needed by their generated Swift usage. */
export function getSwiftImports(
  types: Pick<Type, 'getRequiredImports'>[],
  access: SourceImport<'swift'>['access']
): SourceImport<'swift'>[] {
  return types
    .flatMap((type) => type.getRequiredImports('swift'))
    .filter((i) => i.language === 'swift')
    .map((i) => ({ ...i, access: access }))
}
