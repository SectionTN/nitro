/**
 * Represents any kind of a JSON-serializable value.
 * Supported types:
 * - Primitives (`string`, `number`, `boolean`, `null`)
 * - Arrays of primitives (`[]`)
 * - Objects of primitives (`object`)
 * - Arrays of arrays or objects
 * - Objects of arrays or objects
 *
 * Values cross the native boundary as serialized JSON. Functions, bigints,
 * undefined values, and cyclic objects are not supported.
 *
 * @note Prefer typed interfaces for known shapes to retain type safety and
 * avoid JSON serialization.
 */
export type AnyJSON =
  | string
  | number
  | boolean
  | null
  | AnyJSON[]
  | { [key: string]: AnyJSON };
