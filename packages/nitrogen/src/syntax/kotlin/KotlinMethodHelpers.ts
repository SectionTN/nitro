import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import type { Method } from '../Method.js'
import { Parameter } from '../Parameter.js'
import type { SourceImport } from '../SourceFile.js'
import { wrapKotlinType } from './wrapKotlinType.js'
import type { KotlinType } from './types/KotlinType.js'
import { indent } from '../../utils.js'

export interface KotlinMethodDefinition {
  method: Method
  body: string
}

export interface KotlinMethodBridge {
  /** Private Kotlin functions that JNI calls instead of the public members. */
  kotlinMethods: KotlinMethodDefinition[]
  /** C++ methods that call Kotlin through JNI. */
  cppMethods: KotlinMethodDefinition[]
}

interface KotlinMethodParameter {
  native: Parameter
  kotlin: Parameter
  type: KotlinType
}

/** The JNI representations of a native signature. */
export interface KotlinMethodInfo {
  nativeMethod: Method
  returnType: KotlinType
  parameters: KotlinMethodParameter[]
  /** Whether any value needs conversion between the public Kotlin API and JNI. */
  needsKotlinConversion: boolean
}

export function prepareKotlinMethod(nativeMethod: Method): KotlinMethodInfo {
  const returnType = wrapKotlinType(nativeMethod.returnType)
  const parameters = nativeMethod.parameters.map((parameter) => {
    const kotlinType = wrapKotlinType(parameter.type)
    return {
      native: parameter,
      kotlin: new Parameter(parameter.name, kotlinType),
      type: kotlinType,
    }
  })
  const needsKotlinConversion = returnType.needsKotlinConversion || parameters.some((parameter) => parameter.type.needsKotlinConversion)
  return {
    nativeMethod: nativeMethod,
    returnType: returnType,
    parameters: parameters,
    needsKotlinConversion: needsKotlinConversion,
  }
}

interface KotlinForwarderBodyOptions {
  callable: KotlinMethodInfo
  getKotlinInvocation: (args: string[]) => string
}

/** Kotlin forwarders convert JNI values to the public API and back. */
export function createKotlinForwarderBody({ callable, getKotlinInvocation }: KotlinForwarderBodyOptions): string {
  const kotlinArguments = callable.parameters.map((parameter) =>
    parameter.type.convert(parameter.native.type.escapedName, {
      from: 'c++',
      to: 'kotlin',
      in: 'kotlin',
    })
  )
  const kotlinInvocation = getKotlinInvocation(kotlinArguments)
  if (callable.nativeMethod.returnType.kind === 'void') {
    return `
${kotlinInvocation}
`.trim()
  }
  const kotlinResult = callable.returnType.convert('__result', {
    from: 'kotlin',
    to: 'c++',
    in: 'kotlin',
  })
  return `
val __result = ${kotlinInvocation}
return ${kotlinResult}
`.trim()
}

interface CppJniCallBodyOptions {
  callable: KotlinMethodInfo
  /** The JVM method C++ calls, e.g. `addNumbers_cxx`. */
  jvmName: string
  /** Looks up the fbjni method, e.g. `_javaPart->javaClassStatic()->getMethod`. */
  jniMethodLookup: string
  /** The Java instance, or the class for static methods. */
  jniReceiver: string
  /** The concrete class passed to fbjni's nonvirtual invocation. */
  jniDeclaringClass?: string
  /** JNI setup before the cached method lookup. */
  jniSetupCode?: string
}

/**
 * Calls Kotlin through a cached fbjni method, converting values between C++ and JNI.
 * The caller must already be attached to the JVM.
 * Generated locals use the reserved `__` prefix, so they cannot shadow parameters.
 */
export function createCppJniCallBody({
  callable,
  jvmName,
  jniMethodLookup,
  jniReceiver,
  jniDeclaringClass,
  jniSetupCode = '',
}: CppJniCallBodyOptions): string {
  const jniReturnType = callable.returnType.getCode('c++', {
    context: 'return',
  })
  const jniParameterTypes = callable.parameters.map((parameter) => {
    const type = parameter.type.getCode('c++', { context: 'parameter' })
    return `${type} /* ${parameter.native.name} */`
  })
  const jniSignature = `${jniReturnType}(${jniParameterTypes.join(', ')})`
  const jniArguments = [jniReceiver]
  if (jniDeclaringClass != null) {
    jniArguments.push(jniDeclaringClass)
  }
  jniArguments.push(
    ...callable.parameters.map((parameter) =>
      parameter.type.convert(parameter.native.type.escapedName, {
        from: 'c++',
        to: 'kotlin',
        in: 'c++',
      })
    )
  )
  const methodLookupCode = `
${indent(jniSetupCode, '')}
static const auto __method = ${jniMethodLookup}<${jniSignature}>("${jvmName}");
`.trim()
  if (callable.nativeMethod.returnType.kind === 'void') {
    return `
${indent(methodLookupCode, '')}
__method(${jniArguments.join(', ')});
`.trim()
  }
  const cppResult = callable.returnType.convert('__result', {
    from: 'kotlin',
    to: 'c++',
    in: 'c++',
  })
  return `
${indent(methodLookupCode, '')}
auto __result = __method(${jniArguments.join(', ')});
return ${indent(cppResult, '')};
`.trim()
}

/** An exact implementation can skip JVM virtual dispatch for its direct members. */
export function canUseNonvirtualJniCalls(spec: HybridObjectSpec<'kotlin'>): boolean {
  return spec.implementation != null && !spec.allowInheritance && !spec.allowMultipleImplementations
}

interface KotlinImplementation {
  className: string
  kotlinImport: SourceImport<'kotlin'>
}

/** The Kotlin class implementing the spec, which constructors and static methods call. */
export function getKotlinImplementation(spec: HybridObjectSpec<'kotlin'>): KotlinImplementation {
  const implementation = spec.implementation
  if (implementation == null) {
    throw new Error(`${spec.name}: Constructors and static methods require a Kotlin implementation.`)
  }
  // The package is already resolved within the spec's Android namespace.
  const qualifiedName = [...implementation.package, implementation.className].join('.')
  return {
    className: implementation.className,
    kotlinImport: { language: 'kotlin', name: qualifiedName },
  }
}
