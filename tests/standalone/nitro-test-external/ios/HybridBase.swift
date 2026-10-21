public import NitroModules

public class HybridBase: HybridBaseSpec {
  public required override init() throws {
    try super.init()
  }

  public var baseValue: Double {
    return 20
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
}
