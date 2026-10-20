import { createSwiftConverter } from './SwiftConverter.js'
import { indent, toLowerCamelCase } from '../../utils.js'
import { createFileMetadataString } from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import type { SwiftEnumType } from './types/SwiftEnumType.js'
import { getImportsCode } from '../getImportCode.js'
import { getProtocolConformanceImports } from './getSwiftImports.js'

export function createSwiftEnumBridge(type: SwiftEnumType): SourceFile[] {
  const enumType = type.type
  const protocolConformances = type.getProtocolConformances()
  const protocolNames = protocolConformances.map((conformance) => conformance.name)
  const baseTypes = ['Int32', ...protocolNames]
  const protocolImports = getProtocolConformanceImports(protocolConformances)
  const imports = getImportsCode(protocolImports)
  const enumCases = enumType.enumMembers.map(
    (m) => `case \`${toLowerCamelCase(m.name)}\` = ${m.value}`,
  )
  const initializeCases = enumType.enumMembers.map((m) =>
    `
case "${m.stringValue}":
  self = .${toLowerCamelCase(m.name)}
`.trim(),
  )
  const toStringCases = enumType.enumMembers.map((m) =>
    `
case .${toLowerCamelCase(m.name)}:
  return "${m.stringValue}"
`.trim(),
  )

  const swiftCode = `
${createFileMetadataString(`${enumType.enumName}.swift`)}

${imports}

/**
 * Represents the JS ${enumType.jsType} \`${enumType.enumName}\`.
 */
@_expose(Cxx)
public enum ${enumType.enumName}: ${baseTypes.join(', ')} {
  ${indent(enumCases.join('\n'), '  ')}

  public static func fromRawValue(_ value: Int32) -> Self {
    return Self(rawValue: value)!
  }
}

public extension ${enumType.enumName} {
  /**
   * Get a ${enumType.enumName} for the given String value, or
   * return \`nil\` if the given value was invalid/unknown.
   */
  init?(fromString string: String) {
    switch string {
      ${indent(initializeCases.join('\n'), '      ')}
      default:
        return nil
    }
  }

  /**
   * Get the String value this ${enumType.enumName} represents.
   */
  var stringValue: String {
    switch self {
      ${indent(toStringCases.join('\n'), '      ')}
    }
  }

  var description: String {
    return stringValue
  }
}
`.trim()

  const swiftFile: SourceFile = {
    content: swiftCode,
    language: 'swift',
    name: `${enumType.enumName}.swift`,
    platform: 'ios',
    subdirectory: [],
  }

  const cppEnumType = type.getCode('c++', { context: 'value' })
  const enumMemberValues = enumType.enumMembers.map((member) => member.value)
  const enumValues = [...new Set(enumMemberValues)]
  const nativeEnumType = enumType.getCode('c++', {
    context: 'value',
    fullyQualified: true,
  })
  // Share validation and error messages with the C++ enum converter.
  const jsToSwiftConverterCode = `
const auto nativeValue = JSIConverter<${nativeEnumType}>::fromJSI(runtime, value);
return ${cppEnumType}::fromRawValue(static_cast<int32_t>(nativeValue));
`.trim()
  const jsCanConvertCode = `return JSIConverter<${nativeEnumType}>::canConvert(runtime, value);`
  let swiftToJSConverterCode: string
  if (enumType.jsType === 'union') {
    const toJSICases = enumType.enumMembers.map(
      (member) =>
        `case ${member.value}: return createJSIString<"${member.stringValue}">(runtime);`,
    )
    swiftToJSConverterCode = `
switch (value.getRawValue()) {
  ${indent(toJSICases.join('\n'), '  ')}
  default: [[unlikely]]
    throw std::invalid_argument("Cannot convert ${enumType.enumName} to JS - invalid value: " + std::to_string(value.getRawValue()) + "!");
}
`.trim()
  } else {
    swiftToJSConverterCode = 'return jsi::Value(value.getRawValue());'
  }
  const swiftToCppConverterCode = `
return static_cast<${enumType.getCode('c++', { context: 'value', fullyQualified: true })}>(value.getRawValue());
`.trim()
  const enumMemberComparisons = enumValues.map((value) => `rawValue != ${value}`)
  const cppToSwiftConverterCode = `
const auto rawValue = static_cast<int32_t>(value);
#ifdef NITRO_DEBUG
if (${enumMemberComparisons.join(' && ')}) {
  throw std::invalid_argument("Invalid value for ${enumType.enumName}");
}
#endif
return SwiftType::fromRawValue(rawValue);
`.trim()
  return [
    swiftFile,
    ...createSwiftConverter({
      name: type.name,
      cppType: enumType,
      swiftType: type,
      forwardDeclaration: type.forwardDeclaration,
      fromSwift: swiftToCppConverterCode,
      toSwift: cppToSwiftConverterCode,
      imports: [
        {
          language: 'c++',
          declaration: { name: 'NitroModules/NitroDefines.hpp', space: 'system' },
        },
        {
          language: 'c++',
          declaration: {
            name: 'NitroModules/JSIString.hpp',
            space: 'system',
          },
        },
      ],
      fromJSI: jsToSwiftConverterCode,
      toJSI: swiftToJSConverterCode,
      canConvert: jsCanConvertCode,
    }),
  ]
}
