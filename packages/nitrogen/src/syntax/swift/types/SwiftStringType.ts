import type { GetCodeOptions, TypeContext } from '../../types/Type.js'
import type { CppHelper } from '../../c++/CppHelper.js'
import type { SourceImport } from '../../SourceFile.js'
import type { Language } from '../../../getPlatformSpecs.js'
import { StringType } from '../../types/StringType.js'
import { getClangImporterReferenceName } from '../ImportedCxxRecord.js'
import type { SwiftType } from './SwiftType.js'

export class SwiftStringType extends StringType implements SwiftType {
  get isReferenceType(): boolean {
    return false
  }
  get containsSwiftGenerics(): boolean {
    return false
  }

  get canImportFromCpp(): boolean {
    // Swift cannot import C++ signatures that return swift::String.
    // TODO: Remove the pointer adapter when Swift supports round-tripping it:
    // https://github.com/swiftlang/swift/issues/76024
    return false
  }

  readonly needsSwiftConversion = false
  readonly requiresExplicitSwiftTarget = false
  fromSwift(value: string): string {
    return value
  }
  toSwift(value: string): string {
    return value
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        const type = 'swift::String'
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      default:
        return super.getCode(language, options)
    }
  }

  // TODO: Remove with ImportedCxxRecord.ts once our minimum Xcode includes
  // https://github.com/swiftlang/swift/pull/93293.
  getClangImporterName(context: TypeContext): string {
    return getClangImporterReferenceName('swift.String', context)
  }

  get requiredCppHelpers(): CppHelper[] {
    return []
  }

  override getRequiredImports(
    language: Language,
    context: 'declaration' | 'implementation' = 'implementation'
  ): SourceImport[] {
    const imports: SourceImport[] = []
    switch (language) {
      case 'c++':
        imports.push({
          language,
          declaration: {
            forwardDeclaration: 'namespace swift { class String; }',
          },
          implementation: {
            name: 'NitroModulesSwiftBridge/NitroModules-Swift-Cxx-Umbrella.hpp',
            space: 'system',
          },
        })
        if (context === 'implementation') {
          imports.push({
            language,
            declaration: {
              name: 'NitroModulesSwiftBridge/JSIConverter+SwiftString.hpp',
              space: 'system',
            },
          })
        }
        break
      case 'swift':
      case 'kotlin':
        imports.push(...super.getRequiredImports(language))
        break
    }
    return imports
  }
}
