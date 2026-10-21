public import NitroModules
public import NitroTestExternal

public class HybridGrandchild: HybridGrandchildSpec {
  public required override init() throws {
    try super.init()
  }

  public static func createAlternativeBase() throws -> any HybridBaseSpec {
    return try HybridBase.createAlternativeBase()
  }

  public static func createInternalExternalObject() throws -> any HybridSomeExternalObjectSpec {
    return try HybridBase.createInternalExternalObject()
  }

  public var baseValue: Double {
    return 20
  }
  public var childValue: Double {
    return 30
  }
  public var grandchildValue: Double {
    return 40
  }

  public func bounceSize(size: Size) throws -> Size {
    return size
  }

  public func bounceSizeUnit(unit: SizeUnit) throws -> SizeUnit {
    return unit
  }

  public func mapSize(size: Size, callback: any Callback<Size, Size>) throws -> any Promise<Size> {
    return callback(size)
  }

  public func bounceVariant(variant: NamedVariant) throws -> NamedVariant {
    return variant
  }

  public func toString() -> String {
    return "HybridChild custom toString() :)"
  }
}
