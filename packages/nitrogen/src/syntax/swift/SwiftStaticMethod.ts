import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import { StaticMethod } from '../StaticMethod.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import {
  createCppBridgeBody,
  createCppForwarderBody,
  createSwiftEndpoint,
  getSwiftMethodImports,
  prepareSwiftMethod,
  type SwiftClassMethodOptions,
  type SwiftMethodBridge,
  type SwiftMethodInfo,
} from './SwiftMethodHelpers.js'
import type { SwiftType } from './types/SwiftType.js'

interface SwiftStaticMethodOptions {
  spec: HybridObjectSpec<'swift'>
  method: StaticMethod
  accessor?: { kind: 'getter' | 'setter'; name: string }
}

export class SwiftStaticMethod extends StaticMethod {
  override readonly returnType: SwiftType
  private readonly nativeMethod: StaticMethod
  private readonly implementationClassName: string
  private readonly cppInvocationTarget: string
  private readonly endpointName: string
  private readonly callable: SwiftMethodInfo
  private readonly accessor: SwiftStaticMethodOptions['accessor']

  constructor({ spec, method, accessor }: SwiftStaticMethodOptions) {
    const implementation = spec.implementation
    if (implementation == null) {
      throw new Error(
        `${spec.name}: Cannot generate a static method without a Swift implementation.`
      )
    }
    const callable = prepareSwiftMethod(method, accessor == null)
    const parameters = callable.parameters.map((parameter) => parameter.swift)
    super(`${method.name}_Swift`, callable.returnType, parameters, {
      generated: true,
    })
    this.returnType = callable.returnType
    this.nativeMethod = method
    this.accessor = accessor
    // Property endpoints return plain values, so qualify their names to avoid
    // overriding identical inherited signatures, including in another module.
    this.endpointName =
      accessor == null
        ? method.name
        : `${method.name}_${spec.config.getIosModuleName()}_${spec.name}`
    this.implementationClassName = implementation.className
    const hybridObjectNames = getHybridObjectName(spec.name)
    this.cppInvocationTarget = `${spec.config.getIosModuleName()}::${hybridObjectNames.HybridTSpecCxx}`
    this.callable = callable
  }

  createBridge(
    cppClassName: string,
    swiftOptions: SwiftClassMethodOptions = {}
  ): SwiftMethodBridge {
    const nativeMethod = this.nativeMethod
    const forwarder = new StaticMethod(
      nativeMethod.name,
      nativeMethod.returnType,
      nativeMethod.parameters,
      { generated: true }
    )
    const cppForwarderBody = createCppForwarderBody({
      nativeMethod: nativeMethod,
      swiftMethod: this,
    })
    const cppBridgeBody = createCppBridgeBody({
      callable: this.callable,
      getCppInvocation: (args) =>
        `${this.cppInvocationTarget}::${this.endpointName}(${args.join(', ')})`,
    })
    const endpoint = createSwiftEndpoint({
      callable: this.callable,
      getSwiftInvocation: (args) => {
        if (this.accessor != null) {
          const property = `${this.implementationClassName}.${this.accessor.name}`
          if (this.accessor.kind === 'getter') return property
          const argument = args[0]
          if (argument == null) {
            throw new Error(
              'A Swift static property setter requires a value parameter.'
            )
          }
          return `${property} = ${argument.code}`
        }
        const argumentsList = args.map((arg) => `${arg.name}: ${arg.code}`)
        return `try ${this.implementationClassName}.${nativeMethod.name}(${argumentsList.join(', ')})`
      },
    })
    const swiftMethod = new StaticMethod(
      this.endpointName,
      endpoint.returnType,
      endpoint.parameters,
      {
        ...swiftOptions,
        access: 'public',
        throwing: false,
        generated: true,
      }
    )
    const cppRegistrations: string[] = []
    if (this.accessor == null) {
      cppRegistrations.push(
        `clazz.registerStaticHybridMethod("${nativeMethod.name}", &${cppClassName}::${this.name});`
      )
    }
    return {
      cppMethods: [
        { method: forwarder, body: cppForwarderBody },
        { method: this, body: cppBridgeBody },
      ],
      swiftMethod: { method: swiftMethod, body: endpoint.body },
      swiftImports: getSwiftMethodImports(this.callable),
      cppRegistrations: cppRegistrations,
    }
  }
}
