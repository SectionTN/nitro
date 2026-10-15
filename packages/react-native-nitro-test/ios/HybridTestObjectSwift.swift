//
//  HybridTestObjectSwift.swift
//  NitroTest
//
//  Created by Marc Rousavy on 11.08.24.
//

import Dispatch
import Foundation
import NitroModules
import NitroTestExternal

class HybridTestObjectSwift: HybridTestObjectSwiftKotlinSpec {
  private var pendingPromise: (any Promise<Double>)?

  var optionalArray: [String]? = []

  var someVariant: Variant_Double_String = .first(55)

  var numberValue: Double = 0.0

  var boolValue: Bool = false

  var stringValue: String = ""

  var memorySize: Int {
    return stringValue.utf8.count
  }

  var int64Value: Int64 = 0

  var uint64Value: UInt64 = 0

  var nullValue: NullType = .null

  var optionalString: String? = nil

  var stringOrUndefined: String? = nil

  var stringOrNull: Variant_NullType_String = .first(.null)

  var optionalHybrid: (any HybridTestObjectSwiftKotlinSpec)? = nil

  var optionalEnum: Powertrain? = nil

  var optionalOldEnum: OldEnum? = nil

  var optionalEnumPlusOne: TruckPowertrain? = nil

  var optionalCallback: (any Callback<(Double), Void>)? = nil

  let hasBoolean = false
  let isBoolean = false
  var hasBooleanWritable = false
  var isBooleanWritable = false
  var isolatedBoolean = false
  var isTextValue = ""

  var thisObject: any HybridTestObjectSwiftKotlinSpec {
    return self
  }

  func simpleFunc() throws {
    // do nothing
  }

  func addNumbers(a: Double, b: Double) throws -> Double {
    return a + b
  }

  func addStrings(a: String, b: String) throws -> String {
    return a + b
  }

  func multipleArguments(num: Double, str: String, boo: Bool) throws {
    print("Arguments received! num: \(num) | str: \(str) | boo: \(boo)")
  }

  func bounceNull(value: NullType) -> NullType {
    return value
  }

  func callCallback(callback: any Callback<(), Void>) throws {
    callback()
  }

  func callWithOptional(value: Double?, callback: any Callback<(Double?), Void>) throws {
    callback(value)
  }

  func callCallbackThatReturnsPromiseVoid(callback: any Callback<(), any Promise<Void>>) throws
    -> any Promise<Void>
  {
    return .async {
      let resultPromise = try await callback.callAsync()
      try await resultPromise.await()
    }
  }

  func createNativeCallback(wrappingJsCallback: any Callback<(Double), Void>) throws
    -> any Callback<(Double), Void>
  {
    return .native { num in
      wrappingJsCallback(num)
    }
  }

  func getValueFromJSCallbackAndWait(getValue: any Callback<(), Double>) throws
    -> any Promise<Double>
  {
    return .async {
      let jsResult = try await getValue.callAsync()
      return jsResult
    }
  }

  func getValueFromJsCallback(
    callback: any Callback<(), String>,
    andThenCall: any Callback<(String), Void>
  ) throws -> any Promise<Void> {
    return .async {
      let jsResult = try await callback.callAsync()
      andThenCall(jsResult)
    }
  }

  func callSumUpNTimes(callback: any Callback<(), Double>, n: Double) throws
    -> any Promise<Double>
  {
    return .async {
      var result = 0.0
      for _ in 1...Int(n) {
        let current = try await callback.callAsync()
        result += current
      }
      return result
    }
  }

  // TODO: Callbacks that return a Promise with a value fail to link, see TestObject.nitro.ts.
  // func callbackAsyncPromise(callback: any Callback<(), any Promise<Double>>) throws
  //   -> any Promise<Double>
  // {
  //   return .async {
  //     let promise = try await callback.callAsync()
  //     let result = try await promise.await()
  //     return result
  //   }
  // }

  // func callbackAsyncPromiseBuffer(callback: any Callback<(), any Promise<ArrayBuffer>>) throws
  //   -> any Promise<ArrayBuffer>
  // {
  //   return .async {
  //     let promise = try await callback.callAsync()
  //     let result = try await promise.await()
  //     return result
  //   }
  // }

  func getComplexCallback() throws -> any Callback<(Double), Void> {
    return .native { value in print("Callback called with \(value).") }
  }

  func twoOptionalCallbacks(
    value: Double, first: (any Callback<(Double), Void>)?,
    second: (any Callback<(String), Void>)?
  ) throws {
    if let first {
      first(value)
    }
    if let second {
      second("Hello")
    }
  }

  func errorCallback(onError: any Callback<(any Error), Void>) throws {
    let error: any Error = RuntimeError("Some Error!")
    onError(error)
  }

  func bounceStrings(array: [String]) throws -> [String] {
    return array
  }

  func bounceNumbers(array: [Double]) throws -> [Double] {
    return array
  }

  func bounceStructs(array: [Person]) throws -> [Person] {
    return array
  }

  func bounceNestedArray(array: [[Person]]) throws -> [[Person]] {
    return array
  }

  func bouncePartialStruct(person: PartialPerson) throws -> PartialPerson {
    return person
  }

  func sumUpAllPassengers(cars: [Car]) throws -> String {
    let passengers = cars.flatMap { car in car.passengers }
    let stringified = passengers.map { passenger in
      let ageString = stringify(passenger.age)
      return "\(passenger.name) (\(ageString))"
    }
    return stringified.joined(separator: ", ")
  }

  func bounceEnums(array: [Powertrain]) throws -> [Powertrain] {
    return array
  }

  // TODO: Callbacks with arrays of Swift enums fail to compile in the Swift bridge header, see TestObject.nitro.ts.
  // func complexEnumCallback(array: [Powertrain], callback: any Callback<([Powertrain]), Void>) throws {
  //   callback(array)
  // }

  func bounceHybridObjects(array: [any HybridChildSpec]) -> [any HybridChildSpec] {
    return array
  }

  func bounceFunctions(functions: [any Callback<(), Void>]) throws -> [any Callback<(), Void>] {
    return functions
  }

  func bounceMaps(maps: [AnyJSON]) throws -> [AnyJSON] {
    return maps
  }

  func bouncePromises(promises: [any Promise<Double>]) throws -> [any Promise<Double>] {
    return promises
  }

  func bounceArrayBuffers(arrayBuffers: [ArrayBuffer]) throws -> [ArrayBuffer] {
    return arrayBuffers
  }

  func bounceOptionals(strings: [String?], arrayBuffers: [ArrayBuffer?]) throws -> [String?] {
    return strings
  }

  func bounceNulls(strings: [Variant_NullType_String]) throws -> [Variant_NullType_String] {
    return strings
  }

  func bounceOptionalNulls(strings: [Variant_NullType_String?]) throws
    -> [Variant_NullType_String?]
  {
    return strings
  }

  func createMap() throws -> AnyJSON {
    // `AnyJSON` can't hold a `bigint`, so there's no `int64` value.
    let array: [JSONValue] = [.number(numberValue), .bool(boolValue), .string(stringValue)]
    let map: JSONValue = .object([
      "number": .number(numberValue),
      "bool": .bool(boolValue),
      "string": .string(stringValue),
      "null": .null,
      "array": .array(array),
      "object": .object([
        "number": .number(numberValue),
        "bool": .bool(boolValue),
        "string": .string(stringValue),
        "null": .null,
        "array": .array(array + [.array(array)]),
      ]),
    ])
    return try AnyJSON(encoding: map)
  }

  func mapRoundtrip(map: AnyJSON) throws -> AnyJSON {
    return map
  }

  func getMapKeys(map: AnyJSON) throws -> [String] {
    let object: [String: JSONValue] = try map.decode()
    return Array(object.keys)
  }

  func mergeMaps(a: AnyJSON, b: AnyJSON) throws -> AnyJSON {
    var merged: [String: JSONValue] = try a.decode()
    let other: [String: JSONValue] = try b.decode()
    merged.merge(other) { _, new in new }
    return try AnyJSON(encoding: merged)
  }

  func copyAnyMap(map: AnyJSON) throws -> AnyJSON {
    let value: JSONValue = try map.decode()
    return try AnyJSON(encoding: value)
  }

  func newTestObject() throws -> any HybridTestObjectSwiftKotlinSpec {
    return HybridTestObjectSwift()
  }

  func newTestObjectAsync() throws -> any Promise<any HybridTestObjectSwiftKotlinSpec> {
    return .parallel { HybridTestObjectSwift() }
  }

  func funcThatThrows() throws -> Double {
    throw RuntimeError("This function will only work after sacrificing seven lambs!")
  }

  func funcThatThrowsBeforePromise() throws -> any Promise<Void> {
    throw RuntimeError("This function will only work after sacrificing eight lambs!")
  }

  func throwError(error: Error) throws {
    throw error
  }

  func tryOptionalParams(num: Double, boo: Bool, str: String?) throws -> String {
    if let str {
      return str
    } else {
      return "value omitted!"
    }
  }

  func tryMiddleParam(num: Double, boo: Bool?, str: String) throws -> String {
    return str
  }

  func tryOptionalEnum(value: Powertrain?) throws -> Powertrain? {
    return value
  }

  func tryTrailingOptional(num: Double, str: String, boo: Bool?) throws -> Bool {
    return boo ?? false
  }

  func bounceMap(map: [String: Variant_Bool_Double]) throws -> [String: Variant_Bool_Double] {
    return map
  }

  func bounceSimpleMap(map: [String: Double]) throws -> [String: Double] {
    return map
  }

  func bounceOptionalMap(map: [String: String?]) throws -> [String: String?] {
    return map
  }

  func bounceNullMap(map: [String: Variant_NullType_String]) throws -> [String:
    Variant_NullType_String]
  {
    return map
  }

  func bounceOptionalNullMap(map: [String: Variant_NullType_String?]) throws -> [String:
    Variant_NullType_String?]
  {
    return map
  }

  func extractMap(mapWrapper: MapWrapper) throws -> [String: String] {
    return mapWrapper.map
  }

  func getVariantHybrid(variant: Variant__any_HybridTestObjectSwiftKotlinSpec__Person) throws
    -> Variant__any_HybridTestObjectSwiftKotlinSpec__Person
  {
    return variant
  }

  func passVariant(either: Variant_Bool__Double___String__Double_String) throws
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

  func passAllEmptyObjectVariant(variant: Variant__any_HybridBaseSpec__OptionalWrapper) throws
    -> Variant__any_HybridBaseSpec__OptionalWrapper
  {
    return variant
  }

  func bounceComplexVariant(variant: CoreTypesVariant) throws -> CoreTypesVariant {
    return variant
  }

  func getVariantEnum(variant: Variant_OldEnum_Bool) throws -> Variant_OldEnum_Bool {
    return variant
  }

  func bounceVariantUnionEnum(variant: Variant_Powertrain_Car) throws -> Variant_Powertrain_Car {
    return variant
  }

  func getVariantWeirdNumbersEnum(variant: Variant_WeirdNumbersEnum_Bool) throws
    -> Variant_WeirdNumbersEnum_Bool
  {
    return variant
  }

  func getVariantObjects(variant: Variant_Person_Car) throws -> Variant_Person_Car {
    return variant
  }

  func passNamedVariant(variant: NamedVariant) throws -> NamedVariant {
    return variant
  }

  func calculateFibonacciSync(value: Double) throws -> Int64 {
    let n = Int64(value)
    if n <= 1 {
      return n
    }

    var a = Int64(0)
    var b = Int64(1)
    for _ in 2...n {
      let temp = a + b
      a = b
      b = temp
    }
    return b
  }

  func calculateFibonacciAsync(value: Double) throws -> any Promise<Int64> {
    return .async {
      return try self.calculateFibonacciSync(value: value)
    }
  }

  func wait(seconds: Double) throws -> any Promise<Void> {
    return .async {
      let nanoseconds = UInt64((seconds * 1_000_000_000).rounded())
      try await Task.sleep(nanoseconds: nanoseconds)
    }
  }

  func promiseThrows() throws -> any Promise<Void> {
    return .async {
      throw RuntimeError("Promise throws :)")
    }
  }

  func promiseReturnsInstantly() throws -> any Promise<Double> {
    return .resolved(with: 55.0)
  }

  func promiseReturnsInstantlyAsync() throws -> any Promise<Double> {
    return .async {
      return 55.0
    }
  }

  func createPendingPromise() throws -> any Promise<Double> {
    guard pendingPromise == nil else {
      throw RuntimeError("A pending Promise is already waiting for completion.")
    }
    let promise = Promise_double.pending()
    pendingPromise = promise
    return promise
  }

  func resolvePendingPromiseOnWorker() throws {
    guard let promise = pendingPromise else {
      throw RuntimeError("No pending Promise is waiting for completion.")
    }
    // Only JS calls access the slot; the worker owns the extracted Promise.
    pendingPromise = nil
    DispatchQueue.global().async {
      promise.resolve(result: 55.0)
    }
  }

  func promiseThatResolvesVoidInstantly() throws -> any Promise<Void> {
    return .resolved()
  }

  func promiseThatResolvesToUndefined() throws -> any Promise<Double?> {
    return .resolved(with: nil)
  }

  func awaitNullablePromise() throws -> any Promise<Double?> {
    return .async {
      let promise: any Promise<Double?> = .resolved(with: nil)
      return try await promise.await()
    }
  }

  func awaitAndGetPromise(promise: any Promise<Double>) throws -> any Promise<Double> {
    return .async {
      let result = try await promise.await()
      return result
    }
  }
  func awaitAndGetComplexPromise(promise: any Promise<Car>) throws -> any Promise<Car> {
    return .async {
      let result = try await promise.await()
      return result
    }
  }
  func awaitPromise(promise: any Promise<Void>) throws -> any Promise<Void> {
    return .async {
      try await promise.await()
    }
  }

  func callAll(
    first: any Callback<(), Void>, second: any Callback<(), Void>, third: any Callback<(), Void>
  ) throws {
    first()
    second()
    third()
  }

  func getCar() throws -> Car {
    return Car(
      year: 2018, make: "Lamborghini", model: "Huracán", power: 640, powertrain: .gas, driver: nil,
      passengers: [], isFast: true, favouriteTrack: nil, performanceScores: [100, 10],
      someVariant: nil)
  }

  func isCarElectric(car: Car) throws -> Bool {
    return car.powertrain == .electric
  }

  func areCarsEqual(a: Car, b: Car) throws -> Bool {
    return a == b
  }

  func getDriver(car: Car) throws -> Person? {
    return car.driver
  }

  func bounceCar(car: Car) -> Car {
    return car
  }

  func jsStyleObjectAsParameters(params: JsStyleStruct) throws {
    params.onChanged(params.value)
  }

  func bounceWrappedJsStyleStruct(value: WrappedJsStruct) throws -> WrappedJsStruct {
    return value
  }

  func bounceOptionalWrapper(wrapper: OptionalWrapper) throws -> OptionalWrapper {
    return wrapper
  }

  func bounceOptionalCallback(value: OptionalCallback) throws -> OptionalCallback {
    return value
  }

  func bounceOptionalEnumStruct(value: OptionalEnumWrapper?) throws -> OptionalEnumWrapper? {
    return value
  }

  func createArrayBufferFromNativeBuffer(copy: Bool) throws -> ArrayBuffer {
    let data = Data(count: 1024 * 1024 * 10)  // 10 MB
    if copy {
      return try ArrayBuffer.copy(data: data)
    } else {
      // TODO: `Data` cannot be safely wrapped yet on iOS.
      return try ArrayBuffer.copy(data: data)
    }
  }

  func createHardwareBuffer(
    width: Double, height: Double, layers: Double, format: HardwareBufferFormat
  ) throws -> ArrayBuffer {
    // iOS doesn't have HardwareBuffers - create a `Data` of the same byte size instead.
    let bytesPerPixel: Int
    switch format {
    case .rgb565:
      bytesPerPixel = 2
    case .rgba8888:
      bytesPerPixel = 4
    case .rgbaFp16:
      bytesPerPixel = 8
    case .blob:
      // BLOB buffers hold `width` bytes flat.
      let data = Data(count: Int(width))
      return try ArrayBuffer.copy(data: data)
    }
    let size = Int(width) * Int(height) * Int(layers) * bytesPerPixel
    let data = Data(count: size)
    return try ArrayBuffer.copy(data: data)
  }

  func createArrayBuffer() throws -> ArrayBuffer {
    return ArrayBuffer.allocate(1024 * 1024 * 10)  // 10 MB
  }

  func createArrayBufferAsync() throws -> any Promise<ArrayBuffer> {
    return .async { try self.createArrayBuffer() }
  }

  func copyBuffer(buffer: ArrayBuffer) throws -> ArrayBuffer {
    return ArrayBuffer.copy(buffer)
  }

  func bounceArrayBuffer(buffer: ArrayBuffer) throws -> ArrayBuffer {
    return buffer
  }

  func getBufferLastItem(buffer: ArrayBuffer) throws -> Double {
    guard let data = buffer.data, buffer.size > 0 else {
      throw RuntimeError("ArrayBuffer is empty!")
    }
    let lastByte = data.advanced(by: buffer.size - 1)
    return Double(lastByte.pointee)
  }

  func setAllValuesTo(buffer: ArrayBuffer, value: Double) throws {
    guard let data = buffer.data, buffer.size > 0 else {
      throw RuntimeError("ArrayBuffer is empty!")
    }
    memset(data, Int32(value), buffer.size)
  }

  func createChild() throws -> any HybridChildSpec {
    return HybridChild()
  }

  func createBase() throws -> any HybridBaseSpec {
    return HybridBase()
  }

  func createBaseActualChild() throws -> any HybridBaseSpec {
    return HybridChild()
  }

  func bounceChild(child: any HybridChildSpec) throws -> any HybridChildSpec {
    return child
  }

  func bounceBase(base: any HybridBaseSpec) throws -> any HybridBaseSpec {
    return base
  }

  func bounceChildBase(child: any HybridChildSpec) throws -> any HybridBaseSpec {
    return child
  }

  func castBase(base: any HybridBaseSpec) throws -> any HybridChildSpec {
    guard let child = base as? any HybridChildSpec else {
      throw RuntimeError("Cannot cast Base to Child!")
    }
    return child
  }

  func callbackSync(callback: any Callback<(), Double>) throws -> Double {
    let value = try callback.callSync()
    return value
  }

  func getSyncNumberCallback() throws -> any Callback<(), Double> {
    return .native { 55 }
  }

  func bounceSyncInt64Callback(callback: any Callback<(Int64), Int64>) throws
    -> any Callback<(Int64), Int64>
  {
    return callback
  }

  func bounceExternalHybrid(externalObject: (any HybridSomeExternalObjectSpec)) throws -> (
    any HybridSomeExternalObjectSpec
  ) {
    return externalObject
  }

  func bounceExternalStruct(externalStruct: ExternalObjectStruct) throws -> ExternalObjectStruct {
    return externalStruct
  }

  func bounceExternalVariant(variant: StringOrExternal) throws -> StringOrExternal {
    return variant
  }

  func createExternalVariantFromFunc(factory: any Callback<(), (any HybridSomeExternalObjectSpec)>)
    throws -> (any HybridSomeExternalObjectSpec)
  {
    let obj = try factory.callSync()
    return obj
  }

  func createInternalObject() -> any HybridSomeExternalObjectSpec {
    return HybridSomeInternalObject()
  }

  func dispose() {
    if let optionalCallback {
      optionalCallback(13.0)
    }
  }

  private let formatter: NumberFormatter = {
    let formatter = NumberFormatter()
    formatter.minimumFractionDigits = 0
    formatter.maximumFractionDigits = 16
    formatter.minimumIntegerDigits = 1
    formatter.numberStyle = .decimal
    return formatter
  }()
  private func stringify(_ value: Double) -> String {
    return formatter.string(for: value) ?? "\(value)"
  }
}

/// A minimal JSON value to build and read `AnyJSON` in these tests.
private enum JSONValue: Codable {
  case null
  case bool(Bool)
  case number(Double)
  case string(String)
  case array([JSONValue])
  case object([String: JSONValue])

  init(from decoder: any Decoder) throws {
    let container = try decoder.singleValueContainer()
    if container.decodeNil() {
      self = .null
    } else if let value = try? container.decode(Bool.self) {
      self = .bool(value)
    } else if let value = try? container.decode(Double.self) {
      self = .number(value)
    } else if let value = try? container.decode(String.self) {
      self = .string(value)
    } else if let value = try? container.decode([JSONValue].self) {
      self = .array(value)
    } else {
      self = .object(try container.decode([String: JSONValue].self))
    }
  }

  func encode(to encoder: any Encoder) throws {
    var container = encoder.singleValueContainer()
    switch self {
    case .null:
      try container.encodeNil()
    case .bool(let value):
      try container.encode(value)
    case .number(let value):
      try container.encode(value)
    case .string(let value):
      try container.encode(value)
    case .array(let value):
      try container.encode(value)
    case .object(let value):
      try container.encode(value)
    }
  }
}

// Generated structs are not `Equatable`, so `areCarsEqual(...)` compares them here.
extension Person: Equatable {
  public static func == (lhs: Person, rhs: Person) -> Bool {
    return lhs.name == rhs.name && lhs.age == rhs.age
  }
}

extension Variant_Double_String: Equatable {
  public static func == (lhs: Variant_Double_String, rhs: Variant_Double_String) -> Bool {
    switch (lhs, rhs) {
    case (.first(let a), .first(let b)):
      return a == b
    case (.second(let a), .second(let b)):
      return a == b
    default:
      return false
    }
  }
}

extension Car: Equatable {
  public static func == (lhs: Car, rhs: Car) -> Bool {
    return lhs.year == rhs.year && lhs.make == rhs.make && lhs.model == rhs.model
      && lhs.power == rhs.power && lhs.powertrain == rhs.powertrain && lhs.driver == rhs.driver
      && lhs.passengers == rhs.passengers && lhs.isFast == rhs.isFast
      && lhs.favouriteTrack == rhs.favouriteTrack
      && lhs.performanceScores == rhs.performanceScores && lhs.someVariant == rhs.someVariant
  }
}
