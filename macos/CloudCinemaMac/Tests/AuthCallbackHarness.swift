import Foundation

nonisolated(unsafe) private var retainedServer: LoopbackAuthServer?

@main
struct AuthCallbackHarness {
    static func main() async {
        let nonce = UUID().uuidString.lowercased()
        let result: Result<(String, String), Error> = await withCheckedContinuation {
            continuation in
            let server = LoopbackAuthServer(nonce: nonce) { result in
                continuation.resume(returning: result)
            }
            retainedServer = server
            server.start { ready in
                guard case .success(let port) = ready else { return }
                Task {
                    var components = URLComponents(
                        string: "http://127.0.0.1:\(port)/callback"
                    )!
                    components.queryItems = [
                        URLQueryItem(name: "nonce", value: nonce),
                        URLQueryItem(name: "access_token", value: "test-access"),
                        URLQueryItem(name: "refresh_token", value: "test-refresh"),
                    ]
                    _ = try? await URLSession.shared.data(from: components.url!)
                }
            }
        }

        retainedServer = nil
        guard let tokens = try? result.get(),
              tokens.0 == "test-access",
              tokens.1 == "test-refresh"
        else {
            fputs("AUTH_LOOPBACK_SELF_TEST_FAILED\n", stderr)
            exit(1)
        }
        print("AUTH_LOOPBACK_SELF_TEST_PASSED")
    }
}
