import { NitroConfig } from '../../../config/NitroConfig.js'
import type { Language } from '../../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../../SourceFile.js'
import { EnumType } from '../../types/EnumType.js'
import type { GetCodeOptions } from '../../types/Type.js'

/** Enum ownership follows the module whose private Kotlin bridge is being called. */
export class KotlinCxxEnumType extends EnumType {
  readonly nativeConfig: NitroConfig

  constructor(type: EnumType, nativeConfig: NitroConfig = NitroConfig.current) {
    super(type)
    this.nativeConfig = nativeConfig
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        if (options.fullyQualified || this.nativeConfig.isExternalConfig) {
          return this.nativeConfig.getCxxNamespace('c++', this.enumName)
        }
        return super.getCode(language, options)
      case 'kotlin':
      case 'swift':
        return super.getCode(language, options)
    }
  }

  override getRequiredImports(language: Language): SourceImport[] {
    switch (language) {
      case 'c++':
        return [{ language: 'c++', declaration: this.nativeConfig.getCxxHeader(this.declarationFile.name) }]
      case 'kotlin':
      case 'swift':
        return super.getRequiredImports(language)
    }
  }

  override getExtraFiles(): SourceFile[] {
    if (this.nativeConfig.isExternalConfig) return []
    return super.getExtraFiles()
  }
}
