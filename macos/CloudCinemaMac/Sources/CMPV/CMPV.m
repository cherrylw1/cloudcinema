#import "CMPV.h"

#import <CoreFoundation/CoreFoundation.h>
#import <OpenGL/gl3.h>
#import <dlfcn.h>

typedef struct mpv_handle mpv_handle;
typedef struct mpv_render_context mpv_render_context;

typedef struct {
    int type;
    void *data;
} mpv_render_param;

typedef struct {
    void *(*get_proc_address)(void *context, const char *name);
    void *get_proc_address_context;
    const char *extra_exts;
} mpv_opengl_init_params;

typedef struct {
    int fbo;
    int w;
    int h;
    int internal_format;
} mpv_opengl_fbo;

enum {
    MPV_RENDER_PARAM_API_TYPE = 1,
    MPV_RENDER_PARAM_OPENGL_INIT_PARAMS = 2,
    MPV_RENDER_PARAM_OPENGL_FBO = 3,
    MPV_RENDER_PARAM_FLIP_Y = 4,
};

typedef mpv_handle *(*mpv_create_fn)(void);
typedef int (*mpv_initialize_fn)(mpv_handle *);
typedef int (*mpv_set_option_string_fn)(mpv_handle *, const char *, const char *);
typedef int (*mpv_command_string_fn)(mpv_handle *, const char *);
typedef char *(*mpv_get_property_string_fn)(mpv_handle *, const char *);
typedef void (*mpv_free_fn)(void *);
typedef void (*mpv_terminate_destroy_fn)(mpv_handle *);
typedef const char *(*mpv_error_string_fn)(int);
typedef int (*mpv_render_context_create_fn)(
    mpv_render_context **,
    mpv_handle *,
    mpv_render_param *
);
typedef void (*mpv_render_context_set_update_callback_fn)(
    mpv_render_context *,
    void (*)(void *),
    void *
);
typedef void (*mpv_render_context_render_fn)(
    mpv_render_context *,
    mpv_render_param *
);
typedef void (*mpv_render_context_free_fn)(mpv_render_context *);

static void *CCGetOpenGLProcAddress(void *context, const char *name) {
    CFStringRef symbol = CFStringCreateWithCString(
        kCFAllocatorDefault,
        name,
        kCFStringEncodingASCII
    );
    if (!symbol) {
        return NULL;
    }
    CFBundleRef bundle = CFBundleGetBundleWithIdentifier(CFSTR("com.apple.opengl"));
    void *address = bundle ? CFBundleGetFunctionPointerForName(bundle, symbol) : NULL;
    CFRelease(symbol);
    return address;
}

@interface CCMPVView () {
    void *_library;
    mpv_handle *_handle;
    mpv_render_context *_renderContext;
    mpv_create_fn _mpvCreate;
    mpv_initialize_fn _mpvInitialize;
    mpv_set_option_string_fn _mpvSetOptionString;
    mpv_command_string_fn _mpvCommandString;
    mpv_get_property_string_fn _mpvGetPropertyString;
    mpv_free_fn _mpvFree;
    mpv_terminate_destroy_fn _mpvTerminateDestroy;
    mpv_error_string_fn _mpvErrorString;
    mpv_render_context_create_fn _mpvRenderContextCreate;
    mpv_render_context_set_update_callback_fn _mpvSetUpdateCallback;
    mpv_render_context_render_fn _mpvRender;
    mpv_render_context_free_fn _mpvRenderContextFree;
}
@end

static void CCRenderUpdate(void *context) {
    CCMPVView *view = (__bridge CCMPVView *)context;
    dispatch_async(dispatch_get_main_queue(), ^{
        [view setNeedsDisplay:YES];
    });
}

@implementation CCMPVView

- (instancetype)initWithFrame:(NSRect)frameRect {
    NSOpenGLPixelFormatAttribute attributes[] = {
        NSOpenGLPFAOpenGLProfile,
        NSOpenGLProfileVersion3_2Core,
        NSOpenGLPFADoubleBuffer,
        NSOpenGLPFAAccelerated,
        NSOpenGLPFAColorSize,
        24,
        NSOpenGLPFAAlphaSize,
        8,
        0,
    };
    NSOpenGLPixelFormat *format = [[NSOpenGLPixelFormat alloc]
        initWithAttributes:attributes
    ];
    self = [super initWithFrame:frameRect pixelFormat:format];
    if (self) {
        self.wantsBestResolutionOpenGLSurface = YES;
        GLint swapInterval = 1;
        [self.openGLContext setValues:&swapInterval
                         forParameter:NSOpenGLCPSwapInterval];
    }
    return self;
}

- (BOOL)isEngineReady {
    return _handle != NULL && _renderContext != NULL;
}

- (nullable NSString *)startPlaybackEngine {
    if (self.engineReady) {
        return nil;
    }

    NSString *frameworks = NSBundle.mainBundle.privateFrameworksPath;
    NSArray<NSString *> *candidates = @[
        [frameworks stringByAppendingPathComponent:@"libmpv.2.dylib"],
        @"/Applications/IINA.app/Contents/Frameworks/libmpv.2.dylib",
    ];
    for (NSString *candidate in candidates) {
        _library = dlopen(candidate.fileSystemRepresentation, RTLD_LAZY | RTLD_LOCAL);
        if (_library) {
            break;
        }
    }
    if (!_library) {
        const char *loaderError = dlerror();
        return loaderError
            ? [NSString stringWithFormat:@"The bundled playback engine could not be loaded. (%s)", loaderError]
            : @"The bundled playback engine could not be loaded.";
    }

#define CC_LOAD_SYMBOL(name, field) \
    field = (typeof(field))dlsym(_library, name); \
    if (!field) { return [NSString stringWithFormat:@"Playback engine is missing %s.", name]; }
    CC_LOAD_SYMBOL("mpv_create", _mpvCreate)
    CC_LOAD_SYMBOL("mpv_initialize", _mpvInitialize)
    CC_LOAD_SYMBOL("mpv_set_option_string", _mpvSetOptionString)
    CC_LOAD_SYMBOL("mpv_command_string", _mpvCommandString)
    CC_LOAD_SYMBOL("mpv_get_property_string", _mpvGetPropertyString)
    CC_LOAD_SYMBOL("mpv_free", _mpvFree)
    CC_LOAD_SYMBOL("mpv_terminate_destroy", _mpvTerminateDestroy)
    CC_LOAD_SYMBOL("mpv_error_string", _mpvErrorString)
    CC_LOAD_SYMBOL("mpv_render_context_create", _mpvRenderContextCreate)
    CC_LOAD_SYMBOL("mpv_render_context_set_update_callback", _mpvSetUpdateCallback)
    CC_LOAD_SYMBOL("mpv_render_context_render", _mpvRender)
    CC_LOAD_SYMBOL("mpv_render_context_free", _mpvRenderContextFree)
#undef CC_LOAD_SYMBOL

    _handle = _mpvCreate();
    if (!_handle) {
        return @"The playback engine could not create a player.";
    }

    _mpvSetOptionString(_handle, "vo", "libmpv");
    _mpvSetOptionString(_handle, "hwdec", "auto-safe");
    _mpvSetOptionString(_handle, "cache", "yes");
    _mpvSetOptionString(_handle, "demuxer-max-bytes", "256MiB");
    _mpvSetOptionString(_handle, "demuxer-max-back-bytes", "64MiB");
    _mpvSetOptionString(_handle, "audio-client-name", "CloudCinema");
    _mpvSetOptionString(_handle, "sub-auto", "fuzzy");

    int status = _mpvInitialize(_handle);
    if (status < 0) {
        return [self messageForStatus:status fallback:@"Playback engine initialization failed."];
    }

    [self.openGLContext makeCurrentContext];
    mpv_opengl_init_params openGL = {
        .get_proc_address = CCGetOpenGLProcAddress,
        .get_proc_address_context = NULL,
        .extra_exts = NULL,
    };
    char apiType[] = "opengl";
    mpv_render_param params[] = {
        {MPV_RENDER_PARAM_API_TYPE, apiType},
        {MPV_RENDER_PARAM_OPENGL_INIT_PARAMS, &openGL},
        {0, NULL},
    };
    status = _mpvRenderContextCreate(&_renderContext, _handle, params);
    if (status < 0 || !_renderContext) {
        return [self messageForStatus:status fallback:@"The video renderer could not be created."];
    }
    _mpvSetUpdateCallback(_renderContext, CCRenderUpdate, (__bridge void *)self);
    [self setNeedsDisplay:YES];
    return nil;
}

- (nullable NSString *)loadURLString:(NSString *)url resumeAt:(double)resumeAt {
    if (!self.engineReady) {
        return @"The playback engine is not ready.";
    }
    NSString *escaped = [[url stringByReplacingOccurrencesOfString:@"\\"
                                                        withString:@"\\\\"]
        stringByReplacingOccurrencesOfString:@"\""
                                  withString:@"\\\""];
    NSString *load = [NSString stringWithFormat:@"loadfile \"%@\" replace", escaped];
    int status = _mpvCommandString(_handle, load.UTF8String);
    if (status < 0) {
        return [self messageForStatus:status fallback:@"The video could not be opened."];
    }
    if (resumeAt > 0) {
        NSString *seek = [NSString stringWithFormat:@"seek %.3f absolute exact", resumeAt];
        _mpvCommandString(_handle, seek.UTF8String);
    }
    _mpvCommandString(_handle, "set pause no");
    return nil;
}

- (nullable NSString *)commandString:(NSString *)command {
    if (!_handle) {
        return @"The playback engine is not ready.";
    }
    int status = _mpvCommandString(_handle, command.UTF8String);
    return status < 0
        ? [self messageForStatus:status fallback:@"The playback command failed."]
        : nil;
}

- (nullable NSString *)propertyString:(NSString *)name {
    if (!_handle) {
        return nil;
    }
    char *value = _mpvGetPropertyString(_handle, name.UTF8String);
    if (!value) {
        return nil;
    }
    NSString *result = [NSString stringWithUTF8String:value];
    _mpvFree(value);
    return result;
}

- (double)propertyDouble:(NSString *)name fallback:(double)fallback {
    NSString *value = [self propertyString:name];
    return value ? value.doubleValue : fallback;
}

- (void)reshape {
    [super reshape];
    [self.openGLContext update];
    [self setNeedsDisplay:YES];
}

- (void)drawRect:(NSRect)dirtyRect {
    [self.openGLContext makeCurrentContext];
    if (_renderContext) {
        NSRect backing = [self convertRectToBacking:self.bounds];
        mpv_opengl_fbo fbo = {
            .fbo = 0,
            .w = MAX(1, (int)backing.size.width),
            .h = MAX(1, (int)backing.size.height),
            .internal_format = 0,
        };
        int flip = 1;
        mpv_render_param params[] = {
            {MPV_RENDER_PARAM_OPENGL_FBO, &fbo},
            {MPV_RENDER_PARAM_FLIP_Y, &flip},
            {0, NULL},
        };
        _mpvRender(_renderContext, params);
    } else {
        glClearColor(0, 0, 0, 1);
        glClear(GL_COLOR_BUFFER_BIT);
    }
    [self.openGLContext flushBuffer];
}

- (NSString *)messageForStatus:(int)status fallback:(NSString *)fallback {
    if (_mpvErrorString) {
        const char *message = _mpvErrorString(status);
        if (message) {
            return [NSString stringWithFormat:@"%@ (%s)", fallback, message];
        }
    }
    return fallback;
}

- (void)shutdown {
    if (_renderContext && _mpvRenderContextFree) {
        [self.openGLContext makeCurrentContext];
        _mpvSetUpdateCallback(_renderContext, NULL, NULL);
        _mpvRenderContextFree(_renderContext);
        _renderContext = NULL;
    }
    if (_handle && _mpvTerminateDestroy) {
        _mpvTerminateDestroy(_handle);
        _handle = NULL;
    }
    if (_library) {
        dlclose(_library);
        _library = NULL;
    }
}

- (void)dealloc {
    [self shutdown];
}

@end
