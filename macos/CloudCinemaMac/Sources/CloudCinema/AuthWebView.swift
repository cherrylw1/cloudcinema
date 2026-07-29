import AppKit
import Foundation
import Network

@MainActor
final class AuthenticationManager: ObservableObject {
    private var server: LoopbackAuthServer?

    func signIn(
        onComplete: @escaping @MainActor @Sendable (Result<(String, String), Error>) -> Void
    ) {
        server?.cancel()

        let nonce = UUID().uuidString.lowercased()
        let server = LoopbackAuthServer(nonce: nonce) { [weak self] result in
            Task { @MainActor in
                self?.server = nil
                onComplete(result)
                NSApp.activate(ignoringOtherApps: true)
            }
        }
        self.server = server

        server.start { [weak self] result in
            Task { @MainActor in
                guard self?.server === server else { return }
                switch result {
                case .success(let port):
                    var components = URLComponents(
                        url: APIClient.site.appending(path: "/api/auth/mac/start"),
                        resolvingAgainstBaseURL: false
                    )!
                    components.queryItems = [
                        URLQueryItem(name: "port", value: String(port)),
                        URLQueryItem(name: "nonce", value: nonce),
                    ]
                    guard let url = components.url, NSWorkspace.shared.open(url) else {
                        self?.server = nil
                        server.cancel()
                        onComplete(.failure(AuthenticationError.couldNotStart))
                        return
                    }
                case .failure(let error):
                    self?.server = nil
                    onComplete(.failure(error))
                }
            }
        }
    }
}

final class LoopbackAuthServer: @unchecked Sendable {
    private let nonce: String
    private let completion: @Sendable (Result<(String, String), Error>) -> Void
    private let queue = DispatchQueue(label: "com.cloudcinema.auth-loopback")
    private var listener: NWListener?
    private var completed = false

    init(
        nonce: String,
        completion: @escaping @Sendable (Result<(String, String), Error>) -> Void
    ) {
        self.nonce = nonce
        self.completion = completion
    }

    func start(onReady: @escaping @Sendable (Result<UInt16, Error>) -> Void) {
        queue.async {
            do {
                let parameters = NWParameters.tcp
                parameters.requiredLocalEndpoint = .hostPort(
                    host: NWEndpoint.Host("127.0.0.1"),
                    port: .any
                )
                let listener = try NWListener(using: parameters)
                self.listener = listener
                listener.stateUpdateHandler = { [weak self, weak listener] state in
                    guard let self else { return }
                    switch state {
                    case .ready:
                        guard let port = listener?.port?.rawValue else {
                            onReady(.failure(AuthenticationError.couldNotStart))
                            return
                        }
                        onReady(.success(port))
                    case .failed(let error):
                        onReady(.failure(error))
                        self.finish(.failure(error))
                    default:
                        break
                    }
                }
                listener.newConnectionHandler = { [weak self] connection in
                    self?.receiveRequest(from: connection, data: Data())
                }
                listener.start(queue: self.queue)
                self.queue.asyncAfter(deadline: .now() + 300) { [weak self] in
                    self?.finish(.failure(AuthenticationError.timedOut))
                }
            } catch {
                onReady(.failure(error))
                self.finish(.failure(error))
            }
        }
    }

    func cancel() {
        queue.async { self.finish(nil) }
    }

    private func receiveRequest(from connection: NWConnection, data: Data) {
        connection.start(queue: queue)
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65_536) {
            [weak self] chunk, _, isComplete, error in
            guard let self else { return }
            var requestData = data
            if let chunk { requestData.append(chunk) }

            if requestData.range(of: Data("\r\n\r\n".utf8)) != nil {
                self.handle(requestData, connection: connection)
            } else if let error {
                self.send(
                    status: "400 Bad Request",
                    message: "CloudCinema could not read the login response.",
                    on: connection
                )
                self.finish(.failure(error))
            } else if isComplete || requestData.count >= 65_536 {
                self.send(
                    status: "400 Bad Request",
                    message: "The login response was incomplete.",
                    on: connection
                )
                self.finish(.failure(AuthenticationError.invalidCallback))
            } else {
                self.receiveRequest(from: connection, data: requestData)
            }
        }
    }

    private func handle(_ data: Data, connection: NWConnection) {
        guard let request = String(data: data, encoding: .utf8),
              let firstLine = request.components(separatedBy: "\r\n").first,
              firstLine.hasPrefix("GET "),
              let target = firstLine.split(separator: " ").dropFirst().first,
              let components = URLComponents(string: "http://127.0.0.1\(target)"),
              components.path == "/callback"
        else {
            send(status: "404 Not Found", message: "Unknown CloudCinema login response.", on: connection)
            finish(.failure(AuthenticationError.invalidCallback))
            return
        }

        let values = components.queryItems ?? []
        let receivedNonce = values.first { $0.name == "nonce" }?.value
        let access = values.first { $0.name == "access_token" }?.value
        let refresh = values.first { $0.name == "refresh_token" }?.value
        guard receivedNonce == nonce, let access, !access.isEmpty, let refresh, !refresh.isEmpty else {
            send(status: "403 Forbidden", message: "The CloudCinema login response was invalid.", on: connection)
            finish(.failure(AuthenticationError.invalidCallback))
            return
        }

        send(
            status: "200 OK",
            message: "Login complete. CloudCinema is ready; you may close this tab.",
            on: connection
        )
        finish(.success((access, refresh)))
    }

    private func send(status: String, message: String, on connection: NWConnection) {
        let body = """
        <!doctype html><meta charset="utf-8">
        <title>CloudCinema</title>
        <style>
        body{margin:0;background:#08090c;color:#f5f5f7;font:17px -apple-system,BlinkMacSystemFont,sans-serif;\
        min-height:100vh;display:grid;place-items:center;text-align:center}
        main{max-width:520px;padding:48px}h1{font-size:34px;margin:0 0 14px}p{color:#a1a1aa;line-height:1.5}
        </style><main><h1>CloudCinema</h1><p>\(message)</p></main>
        """
        let response = """
        HTTP/1.1 \(status)\r
        Content-Type: text/html; charset=utf-8\r
        Content-Length: \(body.utf8.count)\r
        Cache-Control: no-store\r
        Connection: close\r
        \r
        \(body)
        """
        connection.send(content: Data(response.utf8), completion: .contentProcessed { _ in
            connection.cancel()
        })
    }

    private func finish(_ result: Result<(String, String), Error>?) {
        guard !completed else { return }
        completed = true
        listener?.cancel()
        listener = nil
        if let result { completion(result) }
    }
}

enum AuthenticationError: LocalizedError {
    case couldNotStart
    case invalidCallback
    case timedOut

    var errorDescription: String? {
        switch self {
        case .couldNotStart: "CloudCinema could not open the secure Google login."
        case .invalidCallback: "Google returned an invalid login response."
        case .timedOut: "Google login timed out. Please try again."
        }
    }
}
