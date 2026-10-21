import type { Type } from '../../types/Type.js'
import type { KotlinCppConverter } from '../KotlinConverter.js'
import { NamedWrappingType } from '../../types/NamedWrappingType.js'
import type { JniValueKind, KotlinConversion, KotlinType } from './KotlinType.js'

export class KotlinNamedType extends NamedWrappingType<KotlinType> implements KotlinType {
  get hasStaticJNIReference(): boolean {
    return this.type.hasStaticJNIReference ?? false
  }

  get jniValueKind(): JniValueKind {
    return this.type.jniValueKind
  }
  get isKotlinFieldCompatible(): boolean {
    return this.type.isKotlinFieldCompatible ?? !this.type.needsKotlinConversion
  }

  get needsKotlinConversion(): boolean {
    return this.type.needsKotlinConversion
  }

  getCppConverter(cppType: Type): KotlinCppConverter {
    return this.type.getCppConverter(cppType)
  }

  convert(value: string, conversion: KotlinConversion): string {
    return this.type.convert(value, conversion)
  }
}
