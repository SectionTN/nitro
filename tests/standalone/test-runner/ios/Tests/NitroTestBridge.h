#import <Foundation/Foundation.h>

/// Runs a suite in one runtime, stopping at the first failure. Returns nil on
/// success, otherwise the case name and assertion/native exception with JS stack.
/// `sourceMap` is the bundle's source map, which lets failures report TypeScript locations.
FOUNDATION_EXPORT NSString* _Nullable NitroRunSuite(NSString* _Nonnull bundle, NSArray<NSString*>* _Nonnull names, uint32_t timeoutMs,
                                                    NSString* _Nullable sourceMap, void (^_Nullable onTestStarted)(void));
