#import <AppKit/AppKit.h>

#import "../Sources/CMPV/include/CMPV.h"

int main(void) {
    @autoreleasepool {
        NSString *url = NSProcessInfo.processInfo.environment[@"CLOUDCINEMA_TEST_URL"];
        if (url.length == 0) {
            fprintf(stderr, "missing test URL\n");
            return 2;
        }

        fprintf(stderr, "stage=appkit\n");
        fflush(stderr);
        [NSApplication sharedApplication];
        CCMPVView *view = [[CCMPVView alloc]
            initWithFrame:NSMakeRect(0, 0, 640, 360)
        ];
        fprintf(stderr, "stage=renderer\n");
        fflush(stderr);
        NSString *error = [view startPlaybackEngine];
        if (error) {
            fprintf(stderr, "renderer=false error=%s\n", error.UTF8String);
            return 3;
        }
        error = [view loadURLString:url resumeAt:0];
        if (error) {
            fprintf(stderr, "load=false error=%s\n", error.UTF8String);
            return 4;
        }
        fprintf(stderr, "stage=loading\n");
        fflush(stderr);

        NSDate *deadline = [NSDate dateWithTimeIntervalSinceNow:20];
        double duration = 0;
        while (deadline.timeIntervalSinceNow > 0 && duration <= 0) {
            @autoreleasepool {
                [view display];
                duration = [view propertyDouble:@"duration" fallback:0];
                [NSRunLoop.currentRunLoop
                    runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.1]
                ];
            }
        }

        int tracks = (int)[view propertyDouble:@"track-list/count" fallback:0];
        int audio = 0;
        int subtitles = 0;
        for (int index = 0; index < tracks; index++) {
            NSString *type = [view propertyString:
                [NSString stringWithFormat:@"track-list/%d/type", index]
            ];
            if ([type isEqualToString:@"audio"]) audio++;
            if ([type isEqualToString:@"sub"]) subtitles++;
        }
        printf(
            "renderer=true duration=%s tracks=%d audio=%d subtitles=%d\n",
            duration > 0 ? "true" : "false",
            tracks,
            audio,
            subtitles
        );
        fflush(stdout);
        fprintf(stderr, "stage=shutdown\n");
        fflush(stderr);
        [view shutdown];
        return duration > 0 ? 0 : 5;
    }
}
