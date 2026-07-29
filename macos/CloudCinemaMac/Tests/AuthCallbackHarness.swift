import Foundation

@main
struct AuthCallbackHarness {
    static func main() {
        let nonce = UUID().uuidString.lowercased()
        var valid = URLComponents(string: "cloudcinema-mac-v2://auth-callback")!
        valid.queryItems = [
            URLQueryItem(name: "nonce", value: nonce),
            URLQueryItem(name: "access_token", value: "test-access"),
            URLQueryItem(name: "refresh_token", value: "test-refresh"),
        ]

        guard let tokens = try? NativeAuthentication.parseCallback(
            valid.url!,
            expectedNonce: nonce
        ),
        tokens == NativeAuthTokens(
            accessToken: "test-access",
            refreshToken: "test-refresh"
        )
        else {
            fputs("AUTH_CALLBACK_VALID_TEST_FAILED\n", stderr)
            exit(1)
        }

        let wrongNonceWasRejected: Bool
        do {
            _ = try NativeAuthentication.parseCallback(
                valid.url!,
                expectedNonce: UUID().uuidString.lowercased()
            )
            wrongNonceWasRejected = false
        } catch {
            wrongNonceWasRejected = true
        }

        guard wrongNonceWasRejected else {
            fputs("AUTH_CALLBACK_NONCE_TEST_FAILED\n", stderr)
            exit(1)
        }

        print("AUTH_CALLBACK_SELF_TEST_PASSED")
    }
}
