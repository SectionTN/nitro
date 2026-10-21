#import <Foundation/Foundation.h>

/// Runs a suite in one runtime, stopping at the first failure. Returns nil on
/// success, otherwise the case name and assertion/native exception with JS stack.
FOUNDATION_EXPORT NSString* _Nullable NitroRunSuite(NSString* _Nonnull bundle, NSArray<NSString*>* _Nonnull names, uint32_t timeoutMs,
                                                    void (^_Nullable onTestStarted)(void));
