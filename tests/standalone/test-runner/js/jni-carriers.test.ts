import { expect } from 'chai'
import { JNITestObject, type JNIValues } from 'nitro-test'

export function unsignedCarriersAndAdaptedContainers(): void {
  const object = new JNITestObject()
  const values = [0n, 1n, 9223372036854775807n, 9223372036854775808n, 18446744073709551615n]
  for (const unsigned of values) {
    for (const optionalUnsigned of [undefined, ...values]) {
      const input: JNIValues = {
        unsignedValue: unsigned,
        optionalUnsigned: optionalUnsigned,
        values: values,
        nested: [[], values, [unsigned]],
        record: { missing: undefined, value: unsigned, maximum: values.at(-1) },
        callbacks: [(value) => value],
      }
      const result = object.roundtrip(input)
      expect(result.unsignedValue).to.equal(unsigned)
      expect(result.optionalUnsigned).to.equal(optionalUnsigned)
      expect(result.values).to.deep.equal(values)
      expect(result.nested).to.deep.equal(input.nested)
      expect(result.record).to.deep.equal(input.record)
      expect(result.callbacks[0]?.(unsigned)).to.equal(unsigned)
    }
  }
}

export const skips = {
  unsignedCarriersAndAdaptedContainers: { ios: 'Exercises Kotlin/JNI representations.' },
} as const
