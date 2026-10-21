import type { Language } from '../../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from '../../types/Type.js'
import type { KotlinType } from './KotlinType.js'

/** An owning JNI value in a JavaScript-facing C++ signature. */
export class KotlinJSIType implements Type {
  constructor(readonly type: KotlinType) {}

  get kind(): TypeKind {
    return this.type.kind
  }

  get isEquatable(): boolean {
    return this.type.isEquatable
  }

  getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        const valueType = this.type.getCode(language, { ...options, context: 'value' })
        if (options.context === 'parameter' && this.type.jniValueKind !== 'primitive') {
          return `const ${valueType}&`
        }
        return valueType
      }
      default:
        return this.type.getCode(language, options)
    }
  }

  getExtraFiles(): SourceFile[] {
    return this.type.getExtraFiles()
  }

  getRequiredImports(language: Language): SourceImport[] {
    return this.type.getRequiredImports(language)
  }
}
