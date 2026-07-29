import AppKit
import Foundation
import OSLog

private let authenticationLog = Logger(
    subsystem: "com.cloudcinema.mac",
    category: "Authentication"
)

struct NativeAuthTokens: Equatable, Sendable {
    let accessToken: String
    let refreshToken: String
}

enum NativeAuthentication {
    static let callbackScheme = "cloudcinema-mac-v2"
    static let callbackHost = "auth-callback"

    private static let pendingNonceKey = "CloudCinemaPendingAuthenticationNonce"

    @MainActor
    static func start() throws {
        let nonce = pendingNonce() ?? createPendingNonce()
        var components = URLComponents(
            url: APIClient.site.appending(path: "/api/auth/mac/start"),
            resolvingAgainstBaseURL: false
        )!
        components.queryItems = [URLQueryItem(name: "nonce", value: nonce)]

        guard let url = components.url, NSWorkspace.shared.open(url) else {
            authenticationLog.error("Could not open the system browser")
            throw AuthenticationError.couldNotStart
        }
        authenticationLog.notice("Opened durable Google authentication handoff")
    }

    static func consumeCallback(_ url: URL) throws -> NativeAuthTokens {
        guard let expectedNonce = pendingNonce() else {
            throw AuthenticationError.noPendingLogin
        }
        let tokens = try parseCallback(url, expectedNonce: expectedNonce)
        UserDefaults.standard.removeObject(forKey: pendingNonceKey)
        authenticationLog.notice("Accepted Google authentication callback")
        return tokens
    }

    static func parseCallback(_ url: URL, expectedNonce: String) throws -> NativeAuthTokens {
        guard url.scheme?.lowercased() == callbackScheme,
              url.host?.lowercased() == callbackHost,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else {
            throw AuthenticationError.invalidCallback
        }

        let values = components.queryItems ?? []
        let nonce = values.first { $0.name == "nonce" }?.value
        guard nonce == expectedNonce else {
            throw AuthenticationError.invalidCallback
        }

        if values.first(where: { $0.name == "error" })?.value != nil {
            throw AuthenticationError.oauthFailed
        }

        guard let access = values.first(where: { $0.name == "access_token" })?.value,
              !access.isEmpty,
              let refresh = values.first(where: { $0.name == "refresh_token" })?.value,
              !refresh.isEmpty
        else {
            throw AuthenticationError.missingTokens
        }

        return NativeAuthTokens(accessToken: access, refreshToken: refresh)
    }

    private static func pendingNonce() -> String? {
        guard let nonce = UserDefaults.standard.string(forKey: pendingNonceKey),
              UUID(uuidString: nonce) != nil
        else {
            return nil
        }
        return nonce
    }

    private static func createPendingNonce() -> String {
        let nonce = UUID().uuidString.lowercased()
        UserDefaults.standard.set(nonce, forKey: pendingNonceKey)
        return nonce
    }
}

enum AuthenticationError: LocalizedError {
    case couldNotStart
    case invalidCallback
    case missingTokens
    case noPendingLogin
    case oauthFailed

    var errorDescription: String? {
        switch self {
        case .couldNotStart:
            "CloudCinema could not open Google sign-in."
        case .invalidCallback:
            "Google returned an invalid login response."
        case .missingTokens:
            "Google completed sign-in without returning a session."
        case .noPendingLogin:
            "This login response has expired. Please sign in again."
        case .oauthFailed:
            "Google sign-in could not be completed. Please try again."
        }
    }
}
