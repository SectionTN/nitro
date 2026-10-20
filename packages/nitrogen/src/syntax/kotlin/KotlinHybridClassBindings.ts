import { indent } from '../../utils.js'
import type { HybridClassBindings } from '../c++/CppHybridClassBindings.js'
import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import type { SourceImport } from '../SourceFile.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import { KotlinConstructor } from './KotlinConstructor.js'
import { KotlinStaticMethod } from './KotlinStaticMethod.js'

export interface KotlinClassMembers {
  constructor: KotlinConstructor | undefined
  staticMethods: KotlinStaticMethod[]
  staticProperties: { name: string; accessors: KotlinStaticMethod[] }[]
}

/** The constructor and static accessors and methods JavaScript calls on the class. */
export function getKotlinClassMembers(
  spec: HybridObjectSpec<'kotlin'>
): KotlinClassMembers {
  let constructor: KotlinConstructor | undefined
  if (spec.constructor != null) {
    constructor = new KotlinConstructor({
      spec: spec,
      constructor: spec.constructor,
    })
  }
  const staticMethods = spec.staticMethods.map(
    (method) => new KotlinStaticMethod({ spec: spec, method: method })
  )
  const staticProperties = spec.staticProperties.map((property) => {
    const [getter, setter] = property.getStaticMethods()
    const accessors = [
      new KotlinStaticMethod({
        spec: spec,
        method: getter,
        accessor: { kind: 'getter', name: property.name },
      }),
    ]
    if (setter != null) {
      accessors.push(
        new KotlinStaticMethod({
          spec: spec,
          method: setter,
          accessor: { kind: 'setter', name: property.name },
        })
      )
    }
    return { name: property.name, accessors: accessors }
  })
  return {
    constructor: constructor,
    staticMethods: staticMethods,
    staticProperties: staticProperties,
  }
}

/** Bind Kotlin class calls through JNI inside the platform's `Class::get()`. */
export function createKotlinHybridClassBindings(
  spec: HybridObjectSpec<'kotlin'>
): HybridClassBindings {
  const imports: SourceImport[] = []
  const definitions: string[] = []
  const registrations: string[] = []
  const { constructor, staticMethods, staticProperties } =
    getKotlinClassMembers(spec)
  const callables: (KotlinConstructor | KotlinStaticMethod)[] = []
  if (constructor != null) callables.push(constructor)
  callables.push(
    ...staticMethods,
    ...staticProperties.flatMap(({ accessors }) => accessors)
  )
  if (callables.length === 0) {
    return {
      imports: imports,
      definitions: definitions,
      registrations: registrations,
    }
  }

  const { JHybridTSpec } = getHybridObjectName(spec.name)
  const helper = `${JHybridTSpec}Bindings`
  const adapters: string[] = []
  imports.push({
    language: 'c++',
    declaration: spec.config.getCxxHeader(`${JHybridTSpec}.hpp`, 'private'),
  })
  for (const callable of callables) {
    const { cppMethods } = callable.createBridge()
    adapters.push(
      ...cppMethods.map(({ method, body }) =>
        method.getDefinition('c++', { placement: 'in-class', body: body })
      )
    )
    const registration = callable.getCppRegistration(helper)
    if (registration != null) registrations.push(registration)
    imports.push(...callable.getRequiredImports('c++'))
  }
  for (const property of spec.staticProperties) {
    const references = property
      .getStaticMethods()
      .map((accessor) => `&${helper}::${accessor.name}`)
    registrations.push(
      `clazz.registerStaticHybridProperty("${property.name}", ${references.join(', ')});`
    )
  }
  const helperDefinition = `
namespace {
  struct ${helper} final {
    ${indent(adapters.join('\n\n'), '    ')}
  };
}
`.trim()
  definitions.push(helperDefinition)
  return {
    imports: imports,
    definitions: definitions,
    registrations: registrations,
  }
}
