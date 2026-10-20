import { afterAll, describe, expect, test } from 'bun:test'
import { Project } from 'ts-morph'
import { NitroConfig } from '../src/config/NitroConfig.js'
import { generatePlatformFiles } from '../src/createPlatformSpec.js'
import { createSwiftHybridObjectCxxBridge } from '../src/syntax/swift/SwiftHybridObjectBridge.js'
import {
  getHybridObjectPlatforms,
  type Language,
} from '../src/getPlatformSpecs.js'

const config = new NitroConfig({
  environment: 'bare',
  cxxNamespace: ['test'],
  ios: { iosModuleName: 'NitroTest' },
  android: {
    androidNamespace: ['test'],
    androidCxxLibName: 'NitroTest',
  },
})
const configDescriptor = Object.getOwnPropertyDescriptor(
  NitroConfig,
  'current'
)!
Object.defineProperty(NitroConfig, 'current', { get: () => config })
afterAll(() => Object.defineProperty(NitroConfig, 'current', configDescriptor))

function generate(
  language: Language,
  members: string,
  { concrete = true, multiple = false } = {}
) {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { strict: true },
  })
  const implementation = {
    'c++': { className: 'HybridExample', include: '"HybridExample.hpp"' },
    'swift': { className: 'HybridExample' },
    'kotlin': { className: 'HybridExample' },
  }[language]
  const options = {
    language: language,
    ...(concrete ? { implementation: implementation } : {}),
    ...(multiple ? { allowMultipleImplementations: true } : {}),
  }
  const platform = language === 'kotlin' ? 'android' : 'ios'
  const decorator = language === 'kotlin' ? 'Android' : 'iOS'
  const source = project.createSourceFile(
    '/Example.nitro.ts',
    `
      declare abstract class HybridObject { protected constructor() }
      @${decorator}(${JSON.stringify(options)})
      export declare class Example extends HybridObject {
        ${members}
      }
    `
  )
  const declaration = source.getClassOrThrow('Example')
  const parsedOptions = getHybridObjectPlatforms(declaration)[platform]!
  return generatePlatformFiles(declaration.getType(), platform, parsedOptions)
}

const members = `
  static readonly readonlyNumber: number
  static sharedNumber: number
  static optionalText?: string
`

describe('static properties', () => {
  for (const language of ['c++', 'swift', 'kotlin'] as const) {
    test(`${language} parses readonly, writable, and optional properties`, () => {
      const { spec } = generate(language, members)
      expect(spec.properties).toHaveLength(0)
      expect(spec.staticMethods).toHaveLength(0)
      expect(spec.staticProperties.map((property) => property.name)).toEqual([
        'readonlyNumber',
        'sharedNumber',
        'optionalText',
      ])
      expect(
        spec.staticProperties.map((property) => property.isReadonly)
      ).toEqual([true, false, false])
      expect(spec.staticProperties[2]?.type.kind).toBe('optional')
    })

    test(`${language} accepts quoted property names`, () => {
      const { spec, files } = generate(language, 'static "count": number')
      expect(spec.staticProperties[0]?.name).toBe('count')
      expect(
        files.some((file) =>
          file.content.includes('registerStaticHybridProperty("count",')
        )
      ).toBe(true)
      expect(files.some((file) => file.content.includes('get"count"'))).toBe(
        false
      )
    })

    test(`${language} permits an implementation used only by static properties`, () => {
      expect(() =>
        generate(language, members, { multiple: true })
      ).not.toThrow()
    })

    test(`${language} requires a concrete implementation`, () => {
      expect(() =>
        generate(language, members, { concrete: false, multiple: true })
      ).toThrow('Static members require a concrete implementation')
    })

    test(`${language} rejects nonpublic static properties`, () => {
      expect(() =>
        generate(language, 'private static sharedNumber: number')
      ).toThrow('HybridObject members must be public')
    })

    test(`${language} rejects accessor collisions`, () => {
      expect(() =>
        generate(
          language,
          'static sharedNumber: number; static getSharedNumber(): number'
        )
      ).toThrow(
        'Static methods and generated property accessors must have distinct names'
      )
      expect(() =>
        generate(
          language,
          'static sharedNumber: number; getSharedNumber(): number'
        )
      ).toThrow('Static members cannot share a name with an instance member')
    })
  }

  test('C++ registers paired static accessor functions', () => {
    const { files } = generate('c++', members)
    const bindings = files.find(
      (file) => file.name === 'HybridExampleSpecClass.cpp'
    )!.content
    expect(bindings).toContain(
      'return ::margelo::nitro::test::HybridExample::getReadonlyNumber();'
    )
    expect(bindings).toContain(
      '::margelo::nitro::test::HybridExample::setSharedNumber('
    )
    expect(bindings).toContain(
      'registerStaticHybridProperty("readonlyNumber", &HybridExampleSpecBindings::getReadonlyNumber);'
    )
    expect(bindings).toContain(
      'registerStaticHybridProperty("sharedNumber", &HybridExampleSpecBindings::getSharedNumber, &HybridExampleSpecBindings::setSharedNumber);'
    )
    expect(bindings).not.toContain('setReadonlyNumber')
    expect(bindings).not.toContain('registerStaticHybridMethod')
  })

  test('Swift bridges property access without calling native methods', () => {
    const { files } = generate('swift', members)
    const swift = files.find(
      (file) => file.name === 'HybridExampleSpec_cxx.swift'
    )!.content
    const cpp = files.find(
      (file) => file.name === 'HybridExampleSpecSwift.cpp'
    )!.content
    expect(swift).toContain('HybridExample.readonlyNumber')
    expect(swift).toContain('HybridExample.sharedNumber =')
    expect(swift).not.toContain('try HybridExample.readonlyNumber')
    expect(swift).not.toContain('HybridExample.getReadonlyNumber(')
    expect(swift).not.toContain('setReadonlyNumber')
    expect(cpp).toContain(
      'registerStaticHybridProperty("sharedNumber", &HybridExampleSpecSwift::getSharedNumber_Swift, &HybridExampleSpecSwift::setSharedNumber_Swift);'
    )
    expect(cpp).not.toContain('registerStaticHybridMethod')
  })

  test('Kotlin bridges companion properties through JNI static functions', () => {
    const { files } = generate('kotlin', members)
    const kotlin = files.find(
      (file) => file.name === 'HybridExampleSpec.kt'
    )!.content
    const cpp = files.find(
      (file) => file.name === 'HybridExampleSpecClass.cpp'
    )!.content
    expect(kotlin).toContain('HybridExample.readonlyNumber')
    expect(kotlin).toContain('HybridExample.sharedNumber =')
    expect(kotlin).toContain('private fun getReadonlyNumber_cxx()')
    expect(kotlin).toContain('private fun setSharedNumber_cxx(')
    expect(kotlin).not.toContain('HybridExample.getReadonlyNumber(')
    expect(kotlin).not.toContain('setReadonlyNumber')
    expect(cpp).toContain('getStaticMethod<')
    expect(cpp).toContain(
      'registerStaticHybridProperty("sharedNumber", &JHybridExampleSpecBindings::getSharedNumber, &JHybridExampleSpecBindings::setSharedNumber);'
    )
    expect(cpp).not.toContain('registerStaticHybridMethod')
  })

  test('rejects a JVM accessor collision with an instance is-property', () => {
    expect(() =>
      generate('kotlin', 'static ready: number; isReady: boolean')
    ).toThrow('Static members cannot share a JVM name')
  })

  test('Swift property endpoints do not override across module boundaries', () => {
    const { spec } = generate('swift', 'static count: number')
    if (spec.language !== 'swift') throw new Error('Expected a Swift spec')
    const base = {
      ...spec,
      allowInheritance: true,
      config: new NitroConfig({
        environment: 'bare',
        cxxNamespace: ['external'],
        ios: { iosModuleName: 'NitroExternal' },
        android: {
          androidNamespace: ['external'],
          androidCxxLibName: 'NitroExternal',
        },
      }),
    }
    const child = { ...spec, name: 'Child', baseTypes: [base] }
    const baseSwift = createSwiftHybridObjectCxxBridge(base).find(
      (file) => file.name === 'HybridExampleSpec_cxx.swift'
    )!.content
    const childFiles = createSwiftHybridObjectCxxBridge(child)
    const childSwift = childFiles.find(
      (file) => file.name === 'HybridChildSpec_cxx.swift'
    )!.content
    const childCpp = childFiles.find(
      (file) => file.name === 'HybridChildSpecSwift.cpp'
    )!.content
    expect(baseSwift).toContain('class func getCount_NitroExternal_Example()')
    expect(baseSwift).toContain('class func setCount_NitroExternal_Example(')
    expect(childSwift).toContain('class func getCount_NitroTest_Child()')
    expect(childSwift).toContain('class func setCount_NitroTest_Child(')
    expect(childCpp).toContain(
      'HybridChildSpec_cxx::getCount_NitroTest_Child()'
    )
    expect(childSwift).not.toContain('getCount_NitroExternal_Example')
  })

  test('rejects a static property accessor colliding with a Swift bridge', () => {
    expect(() =>
      generate('swift', 'static count: number; static getCount_Swift(): number')
    ).toThrow('Static members cannot share a generated Swift bridge name')
    expect(() =>
      generate('swift', 'static count: number; getCount_Swift(): number')
    ).toThrow('Static members cannot share a generated Swift bridge name')
  })

  test('rejects explicit static accessor declarations', () => {
    expect(() => generate('swift', 'static get ready(): boolean')).toThrow(
      'Static accessors are not supported. Declare a static property instead.'
    )
  })
})
