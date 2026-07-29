import AppKit
import AuthenticationServices
import Foundation

@main
struct AuthCallbackHarness {
    @MainActor
    static func main() async {
        let manager = AuthenticationManager()
        let callbackURL = URL(
            string: "cloudcinema-mac://auth-callback"
                + "?access_token=test-access&refresh_token=test-refresh"
        )!

        await withCheckedContinuation { continuation in
            let completion = makeAuthenticationCompletion(manager: manager) { result in
                guard let tokens = try? result.get(),
                      tokens.0 == "test-access",
                      tokens.1 == "test-refresh"
                else {
                    fputs("AUTH_CALLBACK_SELF_TEST_FAILED\n", stderr)
                    exit(1)
                }
                print("AUTH_CALLBACK_SELF_TEST_PASSED")
                continuation.resume()
            }

            DispatchQueue.global().async {
                completion(callbackURL, nil)
            }
        }
    }
}
