import type { NitroConfig } from '../../../config/NitroConfig.js'
import type { Language } from '../../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from '../../types/Type.js'
import { wrapKotlinType } from '../wrapKotlinType.js'
import type { KotlinType } from './KotlinType.js'

/** A direct JNI value retained across native threads and Fabric props snapshots. */
export class KotlinStoredType implements Type {
  readonly type: KotlinType
  private readonly jsiType: Type
  private readonly hasDirectValue: boolean

  constructor(type: Type, config: NitroConfig) {
    this.type = wrapKotlinType(type, { nativeConfig: config })
    const jsiType = this.type.getJSIType?.()
    this.jsiType = jsiType ?? type
    this.hasDirectValue = jsiType != null
  }

  get kind(): TypeKind {
    return this.type.kind
  }

  get isEquatable(): boolean {
    return this.type.isEquatable
  }

  getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        if (this.type.jniValueKind === 'primitive') {
          return this.jsiType.getCode(language, options)
        }
        if (!this.hasDirectValue) {
          throw new Error(`Kotlin ${this.kind} does not provide a direct JNI representation for native storage.`)
        }
        const jniClass = this.type.getCode(language, { ...options, context: 'type-argument', representation: 'jsi' })
        let storedType: string
        if (this.type.hasStaticJNIReference) {
          storedType = `jni::alias_ref<${jniClass}>`
        } else {
          storedType = `jni::global_ref<${jniClass}>`
        }
        if (options.context === 'parameter') return `const ${storedType}&`
        return storedType
      }
      default:
        return this.type.getCode(language, options)
    }
  }

  /** Borrow an object, or adapt a scalar whose JavaScript ABI differs from JNI. */
  getJniValue(value: string): string {
    if (this.type.jniValueKind === 'object') return `${value}.get()`
    if (this.hasDirectValue) return value
    return this.type.convert(value, { from: 'c++', to: 'kotlin', in: 'c++' })
  }

  getExtraFiles(): SourceFile[] {
    return this.type.getExtraFiles()
  }

  getRequiredImports(language: Language): SourceImport[] {
    const imports = this.type.getRequiredImports(language)
    switch (language) {
      case 'c++':
        if (this.type.jniValueKind === 'object') {
          imports.push({
            language: language,
            declaration: { header: 'NitroModules/JSIConverter+JNIGlobalRef.hpp', space: 'system' },
          })
        }
        break
      default:
        break
    }
    return imports
  }
}
