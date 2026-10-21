import { NitroConfig } from '../../../config/NitroConfig.js'
import type { Language } from '../../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../../SourceFile.js'
import type { Type } from '../../types/Type.js'
import { KotlinCxxCallbackType } from './KotlinCxxCallbackType.js'
import { getTypeAs } from '../../types/getTypeAs.js'
import type { KotlinCppConverter } from '../KotlinConverter.js'
import { combineKotlinCppConverters, getKotlinConverter } from '../KotlinConverter.js'
import { CallbackType } from '../../types/CallbackType.js'
import { createKotlinCallback } from '../KotlinCallback.js'
import { createKotlinFallbackCallback } from '../KotlinFallbackCallback.js'
import { wrapKotlinType } from '../wrapKotlinType.js'
import { KotlinNamedType } from './KotlinNamedType.js'
import {
  getJniReferenceCode,
  type GetKotlinCodeOptions,
  type JNINativeRegistration,
  type KotlinConversion,
  type KotlinType,
} from './KotlinType.js'

/**
 * JNI represents a callback as a Kotlin `fun interface`.
 * C++ callbacks implement it in `<name>_cxx`, and Kotlin lambdas in `<name>_java`.
 */
export class KotlinCallbackType extends CallbackType implements KotlinType {
  override readonly returnType: KotlinType
  override readonly parameters: KotlinNamedType[]
  get jniValueKind() {
    return this.canConvertDirectly ? ('wrapper' as const) : ('pointer' as const)
  }
  readonly needsKotlinConversion = true

  constructor(
    readonly type: CallbackType,
    readonly config: NitroConfig = NitroConfig.current
  ) {
    const returnType = wrapKotlinType(type.returnType, { nativeConfig: config })
    const parameters = type.parameters.map((p) => new KotlinNamedType(p.name, wrapKotlinType(p, { nativeConfig: config })))
    super(returnType, parameters, type.isInline)
    this.returnType = returnType
    this.parameters = parameters
  }

  /** The interface name, derived from the C++ callback signature. */
  override get specializationName(): string {
    return this.type.specializationName
  }
  override get jsName(): string {
    return this.type.jsName
  }
  get jniName(): string {
    return `J${this.specializationName}`
  }

  convert(value: string, { from, in: language }: KotlinConversion): string {
    switch (language) {
      case 'kotlin':
        if (from === 'kotlin') {
          return `${value}.let { if (it is ${this.specializationName}) it else ${this.specializationName}_java(it) }`
        }
        return value
      case 'c++': {
        if (!this.canConvertDirectly) return from === 'c++' ? `${this.jniName}_cxx::fromCpp(${value})` : this.getJniToCppCode(value)
        const converter = getKotlinConverter({ cppType: this.type, kotlinType: this })
        switch (from) {
          case 'c++':
            return `${converter}::toJNI(${value})`
          case 'kotlin':
            return `${converter}::fromJNI(${value})`
        }
      }
    }
  }

  private get canConvertDirectly(): boolean {
    const returnType = this.returnType
    return (
      (returnType.jniValueKind === 'primitive' || returnType.getJSIType?.() != null) &&
      this.parameters.every((parameter) => parameter.type.jniValueKind === 'primitive' || parameter.type.getJSIType?.() != null)
    )
  }

  getLegacyConverterRequirements(): KotlinCppConverter {
    const parameters = this.parameters.map((parameter, index) => {
      const original = this.type.parameters[index]
      if (original == null) throw new Error('Mismatched callback parameter count')
      return parameter.type.getCppConverter?.(original)
    })
    return combineKotlinCppConverters([this.returnType.getCppConverter?.(this.type.returnType), ...parameters])
  }

  getJSIType(): Type | undefined {
    if (!this.canConvertDirectly) return undefined
    return this
  }

  getCppConverter(cppType: Type): KotlinCppConverter | undefined {
    if (!this.canConvertDirectly) return undefined
    return new KotlinCxxCallbackType(getTypeAs(cppType, CallbackType), this).getConverter()
  }

  private getJniToCppCode(value: string): string {
    const returnType = this.type.returnType.getCode('c++', {
      context: 'return',
    })
    const paramTypes = this.type.parameters.map((p) => p.getCode('c++', { context: 'parameter' }))
    const jniType = `${this.jniName}_cxx`
    const cppCallbackType = this.type.getCode('c++', { context: 'return' })
    return `
[&]() -> ${cppCallbackType} {
  if (${value}->isInstanceOf(${jniType}::javaClassStatic())) [[likely]] {
    auto downcast = jni::static_ref_cast<${jniType}::javaobject>(${value});
    return downcast->cthis()->getCallback();
  } else {
    auto __callbackRef = jni::make_global(${value});
    return ${cppCallbackType}::make(JNICallable<${this.jniName}, ${returnType}(${paramTypes.join(', ')})>(std::move(__callbackRef)));
  }
}()
`.trim()
  }
  override getCode(language: Language, options: GetKotlinCodeOptions): string {
    switch (language) {
      case 'c++': {
        const jniClass = this.config.getCxxNamespace('c++', this.jniName)
        if (options.representation === 'jsi' && this.isInline) {
          // Kotlin can retain the callback, but JS Inline calls must stay synchronous.
          return getJniReferenceCode(`margelo::nitro::JInlineCallback<${jniClass}>`, options)
        }
        return getJniReferenceCode(this.canConvertDirectly ? jniClass : `${jniClass}::javaobject`, options)
      }
      case 'kotlin':
        return this.specializationName
      default:
        return super.getCode(language, options)
    }
  }

  getJniNativeRegistrations(): readonly JNINativeRegistration[] {
    if (this.config.isExternalConfig) return []
    return [
      {
        namespace: this.config.getCxxNamespace('c++').split('::'),
        className: `${this.jniName}_cxx`,
        import: {
          language: 'c++',
          declaration: this.config.getCxxHeader(`${this.jniName}.hpp`, 'private'),
        },
      },
    ]
  }

  override getExtraFiles(): SourceFile[] {
    if (this.config.isExternalConfig) return []
    if (!this.canConvertDirectly) {
      return [
        ...this.returnType.getExtraFiles(),
        ...this.parameters.flatMap((parameter) => parameter.getExtraFiles()),
        ...this.getLegacyConverterRequirements().files,
        ...createKotlinFallbackCallback(this),
      ]
    }
    return [
      ...this.returnType.getExtraFiles(),
      ...this.parameters.flatMap((parameter) => parameter.getExtraFiles()),
      ...createKotlinCallback(this),
    ]
  }

  override getRequiredImports(language: Language): SourceImport[] {
    const imports: SourceImport[] = []
    switch (language) {
      case 'kotlin':
      case 'swift':
        imports.push(...this.type.getRequiredImports(language))
        break
      case 'c++':
        break
    }
    switch (language) {
      case 'c++':
        if (!this.canConvertDirectly)
          imports.push(...this.type.getRequiredImports(language), ...this.getLegacyConverterRequirements().imports)
        imports.push(
          {
            language: language,
            declaration: this.config.getCxxHeader(`${this.jniName}.hpp`, 'private'),
          },
          {
            language: language,
            declaration: {
              header: 'NitroModules/JNIConverter+Callback.hpp',
              space: 'system',
            },
          }
        )
        if (this.isInline) {
          imports.push({
            language: language,
            declaration: { header: 'NitroModules/JSIConverter+JInlineCallback.hpp', space: 'system' },
          })
        }
        break
    }
    imports.push(...this.returnType.getRequiredImports(language), ...this.parameters.flatMap((p) => p.getRequiredImports(language)))
    return imports
  }
}
