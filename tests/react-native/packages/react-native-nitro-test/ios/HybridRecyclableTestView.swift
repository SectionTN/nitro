//
//  HybridRecyclableTestView.swift
//  react-native-nitro-test
//
//  Created by Marc Rousavy on 03.10.24.
//

public import NitroModules
public import UIKit

public class HybridRecyclableTestView: HybridRecyclableTestViewSpec, RecyclableView {
  public override init() throws {
    try super.init()
  }

  // UIView
  public var view: UIView = MainActor.assumeIsolated { UIView() }
  private let lifecycleLock = NSLock()
  private var isRecycled = false
  private var invalidLifecycleOrderCount: Double = 0
  private var onDropViewCount: Double = 0
  private var prepareForRecycleCount: Double = 0
  private var nativeDefaultValueSetterCallCount: Double = 0
  private var nativeDefaultValueStorage: Double? = 42

  // Props
  public var isBlue: Bool = false {
    didSet {
      if !isRecycled {
        MainActor.assumeIsolated { [view, isBlue] in
          view.backgroundColor = isBlue ? .systemBlue : .systemRed
        }
      }
    }
  }
  public var nativeDefaultValue: Double? {
    get {
      return nativeDefaultValueStorage
    }
    set {
      nativeDefaultValueStorage = newValue
      nativeDefaultValueSetterCallCount += 1
    }
  }

  public func onDropView() {
    print("View dropped!")
    lifecycleLock.withLock {
      onDropViewCount += 1
    }
  }

  public func getOnDropViewCount() throws -> Double {
    return lifecycleLock.withLock { onDropViewCount }
  }

  public func getInvalidLifecycleOrderCount() throws -> Double {
    return lifecycleLock.withLock { invalidLifecycleOrderCount }
  }

  public func getPrepareForRecycleCount() throws -> Double {
    return lifecycleLock.withLock { prepareForRecycleCount }
  }

  public func getNativeDefaultValueSetterCallCount() throws -> Double {
    return nativeDefaultValueSetterCallCount
  }

  public func beforeUpdate() {
    isRecycled = false
  }

  // Recycling conformance
  public func prepareForRecycle() {
    nativeDefaultValueStorage = 42
    nativeDefaultValueSetterCallCount = 0
    MainActor.assumeIsolated { [view] in
      view.backgroundColor = .yellow
    }
    isRecycled = true

    lifecycleLock.withLock {
      if onDropViewCount != prepareForRecycleCount + 1 {
        invalidLifecycleOrderCount += 1
      }
      prepareForRecycleCount += 1
    }
  }

}
