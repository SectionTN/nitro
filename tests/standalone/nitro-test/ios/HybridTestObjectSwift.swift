//
//  HybridTestObjectSwift.swift
//  NitroTest
//
//  Created by Marc Rousavy on 11.08.24.
//

import Dispatch
import Foundation
public import NitroModules
import NitroModulesCxx
public import NitroTestExternal
import os

public class HybridTestObjectSwift: HybridTestObjectSwiftKotlinSpec {
  public required override init() throws {
    try super.init()
  }

  public static let readonlyNumber: Double = 42.0
  private static let sharedNumberStorage = OSAllocatedUnfairLock(initialState: 0.0)
  public static var sharedNumber: Double {
    get { sharedNumberStorage.withLock { $0 } }
    set { sharedNumberStorage.withLock { $0 = newValue } }
  }

  private var pendingPromise: (any Promise<Double>)?

  public var optionalArray: [String]? = []

  public var someVariant: Variant_Double_String = .first(55)

  private var computedValueStorage: Double = 0.0
  public var computedValue: Double {
    get { computedValueStorage * 2 }
    set { computedValueStorage = newValue + 1 }
  }

  public var numberValue: Double = 0.0

  public var boolValue: Bool = false

  public var stringValue: String = ""

  public var memorySize: Int {
    return stringValue.utf8.count
  }

  public var int64Value: Int64 = 0

  public var uint64Value: UInt64 = 0

  public var nullValue: NullType = .null

  public var optionalString: String? = nil

  public var stringOrUndefined: String? = nil

  public var stringOrNull: Variant_NullType_String = .first(.null)

  public var optionalHybrid: HybridTestObjectSwift? = nil

  public var optionalEnum: Powertrain? = nil

  public var optionalOldEnum: OldEnum? = nil

  public var optionalEnumPlusOne: TruckPowertrain? = nil

  public var optionalCallback: (any Callback<Double, Void>)? = nil

  public let hasBoolean = false
  public let isBoolean = false
  public var hasBooleanWritable = false
  public var isBooleanWritable = false
  public var isolatedBoolean = false
  public var isTextValue = ""

  public var thisObject: HybridTestObjectSwift {
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

  public func multipleArguments(num: Double, str: String, boo: Bool) throws {
    print("Arguments received! num: \(num) | str: \(str) | boo: \(boo)")
  }

  public func bounceNull(value: NullType) throws -> NullType {
    return value
  }

  public func callCallback(callback: any Callback<(), Void>) throws {
    callback()
  }

  public func callInlineCallback(
    callback: borrowing some InlineCallback<(), Void> & ~Copyable & ~Escapable
  ) throws {
    try callback()
  }

  public func callInlineCallbackWithValue(
    value: Double,
    callback: borrowing some InlineCallback<Double, Double> & ~Copyable & ~Escapable
  ) throws -> Double {
    return try callback(value)
  }

  public func callCallbackThatReturnsPromiseVoid(callback: any Callback<(), any Promise<Void>>) throws
    -> any Promise<Void>
  {
    return .async {
      let resultPromise = try await callback()
      try await resultPromise.await()
    }
  }

  public func createNativeCallback(wrappingJsCallback: any Callback<Double, Void>) throws
    -> any Callback<Double, Void>
  {
    return .native { num in
      wrappingJsCallback(num)
    }
  }

  public func callWithOptional(value: Double?, callback: any Callback<Double?, Void>) throws {
    callback(value)
  }

  public func getValueFromJSCallbackAndWait(getValue: any Callback<(), Double>) throws -> any Promise<
    Double
  > {
    return .async {
      let jsResult = try await getValue()
      return jsResult
    }
  }

  public func getValueFromJsCallback(
    callback: any Callback<(), String>, andThenCall: any Callback<String, Void>
  ) throws -> any Promise<Void> {
    return .async {
      let jsResult = try await callback()
      andThenCall.callAndForget(jsResult)
    }
  }

  public func callSumUpNTimes(callback: any Callback<(), Double>, n: Double) throws -> any Promise<Double> {
    var result = 0.0
    return .async {
      for _ in 0..<max(0, Int(n)) {
        let current = try await callback()
        result += current
      }
      return result
    }
  }

  public func callbackAsyncPromise(callback: any Callback<(), any Promise<Double>>) throws -> any Promise<
    Double
  > {
    return .async {
      let promise = try await callback()
      let result = try await promise.await()
      return result
    }
  }

  public func callbackAsyncPromiseBuffer(callback: any Callback<(), any Promise<ArrayBuffer>>) throws
    -> any Promise<ArrayBuffer>
  {
    let result: any Promise<ArrayBuffer> = .pending()
    let callbackResult = callback()
    callbackResult.addOnResolvedListener { promise in
      promise.addOnResolvedListener { buffer in result.resolve(result: buffer) }
      promise.addOnRejectedListener { error in result.reject(error: error) }
    }
    callbackResult.addOnRejectedListener { error in result.reject(error: error) }
    return result
  }

  public func getComplexCallback() throws -> any Callback<Double, Void> {
    return .native { value in print("Callback called with \(value).") }
  }

  public func twoOptionalCallbacks(
    value: Double, first: (any Callback<Double, Void>)?,
    second: (any Callback<String, Void>)?
  ) throws {
    if let first {
      first(value)
    }
    if let second {
      second("Hello")
    }
  }

  public func errorCallback(onError: any Callback<any Error, Void>) throws {
    let error = RuntimeError("Some Error!")
    onError(error)
  }

  public func bounceStrings(array: [String]) throws -> [String] {
    return array
  }

  public func bounceNumbers(array: [Double]) throws -> [Double] {
    return array
  }

  public func bounceStructs(array: [Person]) throws -> [Person] {
    return array
  }

  public func bounceNestedArray(array: [[Person]]) throws -> [[Person]] {
    return array
  }

  public func bouncePartialStruct(person: PartialPerson) throws -> PartialPerson {
    return person
  }

  public func sumUpAllPassengers(cars: [Car]) throws -> String {
    let passengers = cars.flatMap { car in car.passengers }
    let stringified = passengers.map { passenger in
      let ageString = stringify(passenger.age)
      return "\(passenger.name) (\(ageString))"
    }
    return stringified.joined(separator: ", ")
  }

  public func bounceEnums(array: [Powertrain]) throws -> [Powertrain] {
    return array
  }

  public func complexEnumCallback(
    array: [Powertrain], callback: any Callback<[Powertrain], Void>
  ) throws {
    callback(array)
  }

  public func callEnumArrayCallback(
    array: [Powertrain], callback: any Callback<[Powertrain], [Powertrain]>
  ) throws -> [Powertrain] {
    return try callback.callSync(array)
  }

  public func getEnumArrayCallback() throws -> any Callback<[Powertrain], [Powertrain]> {
    return .native { array in array }
  }

  public func callEnumArrayPromiseCallback(
    callback: any Callback<(), any Promise<[Powertrain]>>
  ) throws -> any Promise<[Powertrain]> {
    return .async {
      let promise = try await callback()
      return try await promise.await()
    }
  }

  public func awaitEnumArrayPromise(promise: any Promise<[Powertrain]>) throws -> any Promise<[Powertrain]> {
    return .async {
      return try await promise.await()
    }
  }

  public func callNestedStructCallback(
    value: [[Person?]], callback: any Callback<[[Person?]], [[Person?]]>
  ) throws -> [[Person?]] {
    return try callback.callSync(value)
  }

  public func bounceHybridObjects(array: [(any HybridChildSpec)]) throws -> [(any HybridChildSpec)] {
    return array
  }

  public func bounceFunctions(functions: [any Callback<(), Void>]) throws -> [any Callback<(), Void>] {
    return functions
  }

  public func bounceMaps(maps: [AnyJSON]) throws -> [AnyJSON] {
    return maps
  }

  public func bouncePromises(promises: [any Promise<Double>]) throws -> [any Promise<Double>] {
    return promises
  }

  public func bounceArrayBuffers(arrayBuffers: [ArrayBuffer]) throws -> [ArrayBuffer] {
    return arrayBuffers
  }

  public func bounceOptionals(strings: [String?], arrayBuffers: [ArrayBuffer?]) throws -> [String?] {
    return strings
  }

  public func bounceNulls(strings: [Variant_NullType_String]) throws -> [Variant_NullType_String] {
    return strings
  }

  public func bounceOptionalNulls(strings: [Variant_NullType_String?]) throws -> [Variant_NullType_String?] {
    return strings
  }

  public func createMap() throws -> AnyJSON {
    let values: [Any] = [numberValue, boolValue, stringValue, int64Value]
    let fields: [String: Any] = [
      "number": numberValue,
      "bool": boolValue,
      "string": stringValue,
      "int64": int64Value,
      "null": NSNull(),
    ]
    var nestedObject = fields
    nestedObject["array"] = values + [values]
    var object = fields
    object["array"] = values
    object["object"] = nestedObject
    return AnyJSON(data: try JSONSerialization.data(withJSONObject: object))
  }

  public func mapRoundtrip(map: AnyJSON) throws -> AnyJSON {
    return map
  }

  private func jsonObject(_ json: AnyJSON) throws -> [String: Any] {
    guard let object = try JSONSerialization.jsonObject(with: json.data) as? [String: Any] else {
      throw RuntimeError("Expected a JSON object.")
    }
    return object
  }

  public func getMapKeys(map: AnyJSON) throws -> [String] {
    return Array(try jsonObject(map).keys)
  }

  public func mergeMaps(a: AnyJSON, b: AnyJSON) throws -> AnyJSON {
    var object = try jsonObject(a)
    object.merge(try jsonObject(b)) { _, incoming in incoming }
    return AnyJSON(data: try JSONSerialization.data(withJSONObject: object))
  }

  public func copyAnyMap(map: AnyJSON) throws -> AnyJSON {
    return map
  }

  public func newTestObject() throws -> HybridTestObjectSwift {
    return try HybridTestObjectSwift()
  }

  public func newTestObjectAsync() throws -> any Promise<HybridTestObjectSwift> {
    return .parallel { try HybridTestObjectSwift() }
  }

  public func funcThatThrows() throws -> Double {
    throw RuntimeError("This function will only work after sacrificing seven lambs!")
  }

  public func funcThatThrowsBeforePromise() throws -> any Promise<Void> {
    throw RuntimeError("This function will only work after sacrificing eight lambs!")
  }

  public func throwError(error: any Error) throws {
    throw error
  }

  public func tryOptionalParams(num: Double, boo: Bool, str: String?) throws -> String {
    if let str {
      return str
    } else {
      return "value omitted!"
    }
  }

  public func tryMiddleParam(num: Double, boo: Bool?, str: String) throws -> String {
    return str
  }

  public func tryOptionalEnum(value: Powertrain?) throws -> Powertrain? {
    return value
  }

  public func tryTrailingOptional(num: Double, str: String, boo: Bool?) throws -> Bool {
    return boo ?? false
  }

  public func bounceMap(map: [String: Variant_Bool_Double]) throws -> [String: Variant_Bool_Double] {
    return map
  }

  public func bounceSimpleMap(map: [String: Double]) throws -> [String: Double] {
    return map
  }

  public func bounceOptionalMap(map: [String: String?]) throws -> [String: String?] {
    return map
  }

  public func bounceNullMap(map: [String: Variant_NullType_String]) throws -> [String:
    Variant_NullType_String]
  {
    return map
  }

  public func bounceOptionalNullMap(map: [String: Variant_NullType_String?]) throws -> [String:
    Variant_NullType_String?]
  {
    return map
  }

  public func extractMap(mapWrapper: MapWrapper) throws -> [String: String] {
    return mapWrapper.map
  }

  public func getVariantHybrid(variant: Variant_HybridTestObjectSwift_Person) throws
    -> Variant_HybridTestObjectSwift_Person
  {
    return variant
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

  public func passAllEmptyObjectVariant(variant: Variant__any_HybridBaseSpec__OptionalWrapper) throws
    -> Variant__any_HybridBaseSpec__OptionalWrapper
  {
    return variant
  }

  public func bounceComplexVariant(variant: CoreTypesVariant) throws -> CoreTypesVariant {
    return variant
  }

  public func getVariantEnum(variant: Variant_OldEnum_Bool) throws -> Variant_OldEnum_Bool {
    return variant
  }

  public func bounceVariantUnionEnum(variant: Variant_Powertrain_Car) throws -> Variant_Powertrain_Car {
    return variant
  }

  public func getVariantWeirdNumbersEnum(variant: Variant_WeirdNumbersEnum_Bool) throws
    -> Variant_WeirdNumbersEnum_Bool
  {
    return variant
  }

  public func getVariantObjects(variant: Variant_Person_Car) throws -> Variant_Person_Car {
    return variant
  }

  public func passNamedVariant(variant: NamedVariant) throws -> NamedVariant {
    return variant
  }

  public func calculateFibonacciSync(value: Double) throws -> Int64 {
    return Self.calculateFibonacci(value: value)
  }

  private static func calculateFibonacci(value: Double) -> Int64 {
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

  public func calculateFibonacciAsync(value: Double) throws -> any Promise<Int64> {
    return .async {
      return Self.calculateFibonacci(value: value)
    }
  }

  public func wait(seconds: Double) throws -> any Promise<Void> {
    return .async {
      let nanoseconds = UInt64((seconds * 1_000_000_000).rounded())
      try await Task.sleep(nanoseconds: nanoseconds)
    }
  }

  public func promiseThrows() throws -> any Promise<Void> {
    return .async {
      throw RuntimeError("Promise throws :)")
    }
  }

  public func promiseReturnsInstantly() throws -> any Promise<Double> {
    return .resolved(with: 55.0)
  }

  public func promiseReturnsInstantlyAsync() throws -> any Promise<Double> {
    return .async {
      return 55.0
    }
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

  public func promiseThatResolvesVoidInstantly() throws -> any Promise<Void> {
    return .resolved()
  }

  public func promiseThatResolvesToUndefined() throws -> any Promise<Double?> {
    return .resolved(with: nil)
  }

  public func awaitNullablePromise() throws -> any Promise<Double?> {
    return .async {
      let promise: any Promise<Double?> = .resolved(with: nil)
      return try await promise.await()
    }
  }

  public func awaitAndGetPromise(promise: any Promise<Double>) throws -> any Promise<Double> {
    return .async {
      let result = try await promise.await()
      return result
    }
  }
  public func awaitAndGetComplexPromise(promise: any Promise<Car>) throws -> any Promise<Car> {
    return .async {
      let result = try await promise.await()
      return result
    }
  }
  public func awaitPromise(promise: any Promise<Void>) throws -> any Promise<Void> {
    return .async {
      try await promise.await()
    }
  }

  public func callAll(
    first: any Callback<(), Void>, second: any Callback<(), Void>, third: any Callback<(), Void>
  ) throws {
    first()
    second()
    third()
  }

  public func getCar() throws -> Car {
    return Car(
      year: 2018, make: "Lamborghini", model: "Huracán", power: 640, powertrain: .gas, driver: nil,
      passengers: [], isFast: true, favouriteTrack: nil, performanceScores: [100, 10],
      someVariant: nil)
  }

  public func isCarElectric(car: Car) throws -> Bool {
    return car.powertrain == .electric
  }

  public func areCarsEqual(a: Car, b: Car) throws -> Bool {
    return a == b
  }

  public func getDriver(car: Car) throws -> Person? {
    return car.driver
  }

  public func bounceCar(car: Car) throws -> Car {
    return car
  }

  public func jsStyleObjectAsParameters(params: JsStyleStruct) throws {
    params.onChanged(params.value)
  }

  public func roundtripUnsignedScalar(value: UnsignedScalar) throws -> UnsignedScalar {
    return value
  }

  public func roundtripUnsignedValues(value: UnsignedValues) throws -> UnsignedValues {
    return value
  }

  public func bounceWrappedJsStyleStruct(value: WrappedJsStruct) throws -> WrappedJsStruct {
    return value
  }

  public func bounceOptionalWrapper(wrapper: OptionalWrapper) throws -> OptionalWrapper {
    return wrapper
  }

  public func bounceOptionalCallback(value: OptionalCallback) throws -> OptionalCallback {
    return value
  }

  public func bounceOptionalEnumStruct(value: OptionalEnumWrapper?) throws -> OptionalEnumWrapper? {
    return value
  }

  public func createArrayBufferFromNativeBuffer(copy: Bool) throws -> ArrayBuffer {
    let data = Data(count: 1024 * 1024 * 10)  // 10 MB
    if copy {
      return try ArrayBuffer.copy(data: data)
    } else {
      // TODO: `Data` cannot be safely wrapped yet on iOS.
      return try ArrayBuffer.copy(data: data)
    }
  }

  public func createHardwareBuffer(
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

  public func createArrayBuffer() throws -> ArrayBuffer {
    return Self.allocateArrayBuffer()
  }

  private static func allocateArrayBuffer() -> ArrayBuffer {
    return ArrayBuffer.allocate(1024 * 1024 * 10)  // 10 MB
  }

  public func createArrayBufferAsync() throws -> any Promise<ArrayBuffer> {
    return .async { Self.allocateArrayBuffer() }
  }

  public func copyBuffer(buffer: ArrayBuffer) throws -> ArrayBuffer {
    return ArrayBuffer.copy(buffer)
  }

  public func bounceArrayBuffer(buffer: ArrayBuffer) throws -> ArrayBuffer {
    return buffer
  }

  public func getBufferLastItem(buffer: ArrayBuffer) throws -> Double {
    return try buffer.withUnsafeBytes { bytes in
      guard let lastByte = bytes.last else {
        throw RuntimeError("ArrayBuffer's size is 0!")
      }
      return Double(lastByte)
    }
  }

  public func setAllValuesTo(buffer: ArrayBuffer, value: Double) throws {
    try buffer.withUnsafeMutableBytes { bytes in
      guard let data = bytes.baseAddress, !bytes.isEmpty else {
        throw RuntimeError("ArrayBuffer's size is 0!")
      }
      memset(data, Int32(value), bytes.count)
    }
  }

  public func createChild() throws -> (any HybridChildSpec) {
    return try HybridChild()
  }

  public func createBase() throws -> (any HybridBaseSpec) {
    return try HybridBase()
  }

  public func createBaseActualChild() throws -> (any HybridBaseSpec) {
    return try HybridChild()
  }

  public func createGrandchild() throws -> HybridGrandchild {
    return try HybridGrandchild()
  }

  public func createChildActualGrandchild() throws -> (any HybridChildSpec) {
    return try HybridGrandchild()
  }

  public func createBaseActualGrandchild() throws -> (any HybridBaseSpec) {
    return try HybridGrandchild()
  }

  public func bounceGrandchild(grandchild: HybridGrandchild) throws -> HybridGrandchild {
    return grandchild
  }

  public func bounceChild(child: (any HybridChildSpec)) throws -> (any HybridChildSpec) {
    return child
  }

  public func bounceBase(base: (any HybridBaseSpec)) throws -> (any HybridBaseSpec) {
    return base
  }

  public func bounceChildBase(child: (any HybridChildSpec)) throws -> (any HybridBaseSpec) {
    return child
  }

  public func castBase(base: (any HybridBaseSpec)) throws -> (any HybridChildSpec) {
    guard let child = base as? HybridChildSpec else {
      throw RuntimeError("Cannot cast Base to Child!")
    }
    return child
  }

  public func callbackSync(callback: any Callback<(), Double>) throws -> Double {
    let value = try callback.callSync()
    return value
  }

  public func getSyncNumberCallback() throws -> any Callback<(), Double> {
    return .native { 55 }
  }

  public func bounceSyncInt64Callback(callback: any Callback<Int64, Int64>) throws
    -> any Callback<Int64, Int64>
  {
    return callback
  }

  public func bounceExternalHybrid(externalObject: (any HybridSomeExternalObjectSpec)) throws -> (
    any HybridSomeExternalObjectSpec
  ) {
    return externalObject
  }

  public func bounceExternalStruct(externalStruct: ExternalObjectStruct) throws -> ExternalObjectStruct {
    return externalStruct
  }

  public func bounceCppOnlyValue(value: CppOnlyValue) throws -> CppOnlyValue {
    return value
  }

  public func bounceExternalVariant(variant: StringOrExternal) throws -> StringOrExternal {
    return variant
  }

  public func createExternalVariantFromFunc(factory: any Callback<(), (any HybridSomeExternalObjectSpec)>)
    throws -> (any HybridSomeExternalObjectSpec)
  {
    let obj = try factory.callSync()
    return obj
  }

  public func createInternalObject() throws -> (any HybridSomeExternalObjectSpec) {
    return try HybridSomeInternalObject()
  }

  public func dispose() {
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
