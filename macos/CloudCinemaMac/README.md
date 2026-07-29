# CloudCinema for macOS

Native SwiftUI client for the existing CloudCinema service.

## Build

Run `./scripts/build-macos-app.sh` from the repository root. The script uses the
installed Swift toolchain, bundles the libmpv/FFmpeg runtime from IINA, applies
local ad-hoc signing, and creates both `.app` and `.dmg` artifacts.

The web application remains a separate target. The only shared addition is the
authenticated `/api/native` JSON contract.

Google authentication uses the registered `cloudcinema-mac-v2` URL scheme. The
pending nonce is persisted so the callback remains valid if macOS relaunches
the app while authentication is in progress.
