import { Android, type HybridObject, type UInt64 } from 'nitro-core'

export * from '#nitro/JNITestObject'

export interface JNIValues {
  unsignedValue: UInt64
  optionalUnsigned?: UInt64
  values: UInt64[]
  nested: UInt64[][]
  record: Record<string, UInt64 | undefined>
  callbacks: ((value: UInt64) => UInt64)[]
}

@Android({ language: 'kotlin', implementation: { className: 'HybridJNITestObject' } })
export declare class JNITestObject extends HybridObject {
  constructor()
  roundtrip(value: JNIValues): JNIValues
}
