public import NitroModules
public import UIKit

public class HybridTestView: HybridTestViewSpec {
  public override init() throws {
    try super.init()
  }

  public var view: UIView = MainActor.assumeIsolated { UIView() }

  public var isBlue: Bool = false {
    didSet {
      MainActor.assumeIsolated { [view, isBlue] in
        view.backgroundColor = isBlue ? .systemBlue : .systemRed
      }
    }
  }
  public var someCallback: any Callback<(), Void> = .native {}

  public func someMethod() throws {
    someCallback()
  }

  public func getModuleName() throws -> String {
    return "NitroTestExternal"
  }
}
