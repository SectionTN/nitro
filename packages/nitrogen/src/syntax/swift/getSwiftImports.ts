import type { SourceImport } from '../SourceFile.js'
import type { Type } from '../types/Type.js'
import type { ProtocolConformance } from './ProtocolConformance.js'

/**
 * Collects protocol dependencies, optionally overriding visibility for bridge-only usage.
 */
export function getProtocolConformanceImports(
  conformances: ProtocolConformance[],
  access?: SourceImport<'swift'>['access']
): SourceImport<'swift'>[] {
  return conformances.flatMap((conformance) => {
    const requiredImport = conformance.requiredImport
    if (requiredImport == null) return []
    return [{ ...requiredImport, access: access ?? requiredImport.access }]
  })
}

/** Narrow API dependencies for bridge-only usage without promoting implementation imports. */
export function getSwiftImports(
  types: Pick<Type, 'getRequiredImports'>[],
  access: SourceImport<'swift'>['access']
): SourceImport<'swift'>[] {
  return types
    .flatMap((type) => type.getRequiredImports('swift'))
    .filter((i) => i.language === 'swift')
    .map((i) => {
      if (i.access === 'private' || access === 'public') return i
      return { ...i, access: access }
    })
}
