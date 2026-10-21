import Dispatch
public import NitroModules

#if SWIFT_PACKAGE
  import NitroModulesCxx
#endif

public class HybridBenchmarkObjectSwift: HybridBenchmarkObjectSwiftKotlinSpec {
  public required override init() throws {
    try super.init()
  }

  private var pendingPromise: (any Promise<Double>)?
  public var numberValue: Double = 0.0

  public var thisObject: HybridBenchmarkObjectSwift {
    return self
  }

  public func simpleFunc() throws {
    // do nothing
  }

  public func addNumbers(a: Double, b: Double) throws -> Double {
    return a + b
  }

  public func addStrings(a: String, b: String) throws -> String {
    return a + b
  }

  public func bounceNumbers(array: [Double]) throws -> [Double] {
    return array
  }

  public func bounceCar(car: Car) throws -> Car {
    return car
  }

  public func bounceSimpleMap(map: [String: Double]) throws -> [String: Double] {
    return map
  }

  public func tryOptionalParams(num: Double, boo: Bool, str: String?) throws -> String {
    if let str {
      return str
    } else {
      return "value omitted!"
    }
  }

  public func passVariant(either: Variant_Bool__Double___String__Double_String) throws
    -> Variant_Double_String
  {
    switch either {
    case .fourth(let double):
      return .first(double)
    case .fifth(let string):
      return .second(string)
    default:
      return .second("holds something else!")
    }
  }

  public func newBenchmarkObject() throws -> HybridBenchmarkObjectSwift {
    return try HybridBenchmarkObjectSwift()
  }

  public func bounceArrayBuffer(buffer: ArrayBuffer) throws -> ArrayBuffer {
    return buffer
  }

  public func copyBuffer(buffer: ArrayBuffer) throws -> ArrayBuffer {
    return ArrayBuffer.copy(buffer)
  }

  public func callbackSync(callback: any Callback<(), Double>) throws -> Double {
    let value = try callback.callSync()
    return value
  }

  public func promiseReturnsInstantly() throws -> any Promise<Double> {
    return .resolved(with: 55.0)
  }

  public func createPendingPromise() throws -> any Promise<Double> {
    guard pendingPromise == nil else {
      throw RuntimeError("A pending Promise is already waiting for completion.")
    }
    let promise: any Promise<Double> = .pending()
    pendingPromise = promise
    return promise
  }

  public func resolvePendingPromiseOnWorker() throws {
    guard let promise = pendingPromise else {
      throw RuntimeError("No pending Promise is waiting for completion.")
    }
    // Only JS calls access the slot; the worker owns the extracted Promise.
    pendingPromise = nil
    DispatchQueue.global().async {
      promise.resolve(result: 55.0)
    }
  }
}
