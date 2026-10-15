import type { SourceImport } from '../../SourceFile.js'
import type { Language } from '../../../getPlatformSpecs.js'
import type { CppHelper } from '../../c++/CppHelper.js'
import type { Type, TypeContext } from '../../types/Type.js'
import type { ImportedCxxRecord } from '../ImportedCxxRecord.js'

/** A concrete Swift representation used by C++ JSI converters. */
export interface SwiftType extends Type {
  readonly requiredCppHelpers: CppHelper[]
  /** Header imports may forward-declare types; implementations need their definitions. */
  getRequiredImports(
    language: Language,
    context?: 'declaration' | 'implementation'
  ): SourceImport[]
  /** Whether Swift can import this C++ representation directly. */
  readonly canImportFromCpp: boolean
  /** Whether this Swift value uses the retained class-reference bridge. */
  readonly isReferenceType: boolean
  /**
   * Whether this representation's C++ type names `swift::Optional` or `swift::Array`, including in nested signatures.
   * Bridge headers only forward-declare them, so C++ that converts such values must be compiled after the generated -Swift.h.
   */
  readonly containsSwiftGenerics: boolean
  /** Whether the public Swift API needs conversion to this representation. */
  readonly needsSwiftConversion: boolean
  /**
   * Whether the native C++ type can map to multiple Swift representations,
   * requiring an explicit Swift target in its SwiftConverter specialization.
   */
  readonly requiresExplicitSwiftTarget: boolean
  // TODO: Remove with ImportedCxxRecord.ts once our minimum Xcode includes
  // https://github.com/swiftlang/swift/pull/93293.
  /**
   * The C++ record Swift imports for this type, if Swift does not define it.
   * C++ gets its type metadata from Swift when it stores it in a `swift::Optional`,
   * `swift::Array` or dictionary slot.
   */
  readonly importedCxxRecord?: ImportedCxxRecord
  /**
   * How Swift names this C++ type in imported class template specializations,
   * e.g. `CDouble` in `Callback<((CDouble) -> Void)>`.
   */
  getClangImporterName(context: TypeContext): string
  fromSwift(value: string): string
  toSwift(value: string): string
}
