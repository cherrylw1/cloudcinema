#import <AppKit/AppKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface CCMPVView : NSOpenGLView

@property(nonatomic, readonly, getter=isEngineReady) BOOL engineReady;

- (nullable NSString *)startPlaybackEngine;
- (nullable NSString *)loadURLString:(NSString *)url resumeAt:(double)resumeAt;
- (nullable NSString *)commandString:(NSString *)command;
- (nullable NSString *)propertyString:(NSString *)name;
- (double)propertyDouble:(NSString *)name fallback:(double)fallback;
- (void)shutdown;

@end

NS_ASSUME_NONNULL_END
