import AppKit
import AuthenticationServices
import Foundation

@MainActor
final class AuthenticationManager: NSObject, ObservableObject,
    ASWebAuthenticationPresentationContextProviding
{
    private var session: ASWebAuthenticationSession?

    func signIn(onComplete: @escaping (Result<(String, String), Error>) -> Void) {
        let loginURL = URL(string: "https://cherrycinema.netlify.app/login?platform=mac")!
        let session = ASWebAuthenticationSession(
            url: loginURL,
            callbackURLScheme: "cloudcinema-mac"
        ) { callbackURL, error in
            Task { @MainActor in
                self.session = nil
                if let error {
                    if (error as? ASWebAuthenticationSessionError)?.code != .canceledLogin {
                        onComplete(.failure(error))
                    }
                    return
                }
                guard let callbackURL,
                      let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                      let access = components.queryItems?.first(where: { $0.name == "access_token" })?.value,
                      let refresh = components.queryItems?.first(where: { $0.name == "refresh_token" })?.value
                else {
                    onComplete(.failure(AuthenticationError.missingTokens))
                    return
                }
                onComplete(.success((access, refresh)))
            }
        }
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        self.session = session
        if !session.start() {
            self.session = nil
            onComplete(.failure(AuthenticationError.couldNotStart))
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        NSApp.keyWindow ?? NSApp.windows.first ?? ASPresentationAnchor()
    }
}

enum AuthenticationError: LocalizedError {
    case missingTokens
    case couldNotStart

    var errorDescription: String? {
        switch self {
        case .missingTokens: "Google completed sign-in without returning a session."
        case .couldNotStart: "The secure sign-in window could not be opened."
        }
    }
}
