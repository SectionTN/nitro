//
//  HybridPlatformObject.swift
//  react-native-nitro-test
//
//  Created by Marc Rousavy on 27.10.25.
//

public import NitroModules
import Foundation

public class HybridPlatformObject: HybridPlatformObjectSpec {
  public required override init() throws {
    try super.init()
  }

  public func getOSVersion() throws -> String {
    let version = ProcessInfo.processInfo.operatingSystemVersion
    let baseVersion = "\(version.majorVersion).\(version.minorVersion)"
    return version.patchVersion == 0 ? baseVersion : "\(baseVersion).\(version.patchVersion)"
  }
}
