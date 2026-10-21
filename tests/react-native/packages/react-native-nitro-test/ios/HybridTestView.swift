//
//  HybridTestView.swift
//  react-native-nitro-test
//
//  Created by Marc Rousavy on 03.10.24.
//

public import NitroModules
public import UIKit

public class HybridTestView: HybridTestViewSpec {
  public override init() throws {
    try super.init()
  }

  // UIView
  public var view: UIView = MainActor.assumeIsolated { UIView() }
  private let lifecycleLock = NSLock()
  private var onDropViewCount: Double = 0
  private var isBlueSetterCallCount: Double = 0
  private var nativeDefaultValueSetterCallCount: Double = 0

  // Props
  public var isBlue: Bool = false {
    didSet {
      isBlueSetterCallCount += 1
      MainActor.assumeIsolated { [view, isBlue] in
        view.backgroundColor = isBlue ? .systemBlue : .systemRed
      }
    }
  }
  public var hasBeenCalled: Bool = false
  public var int64Value: Int64 = 0
  public var colorScheme: ColorScheme = .light
  public var someCallback: any Callback<(), Void> = .native {}
  public var nativeDefaultValue: Double? = 42 {
    didSet {
      nativeDefaultValueSetterCallCount += 1
    }
  }

  // Methods
  public func getIsViewBlue(view: HybridTestView) throws -> Bool {
    return view.isBlue
  }

  public func getOnDropViewCount() throws -> Double {
    return lifecycleLock.withLock { onDropViewCount }
  }

  public func getIsBlueSetterCallCount() throws -> Double {
    return isBlueSetterCallCount
  }

  public func getNativeDefaultValueSetterCallCount() throws -> Double {
    return nativeDefaultValueSetterCallCount
  }

  public func someMethod() throws {
    hasBeenCalled = true
    someCallback()
  }

  public func onDropView() {
    lifecycleLock.withLock {
      onDropViewCount += 1
    }
  }

}
