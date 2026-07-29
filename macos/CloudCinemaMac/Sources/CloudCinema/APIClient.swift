import Foundation

actor APIClient {
    static let shared = APIClient()
    static let site = URL(string: "https://cherrycinema.netlify.app")!

    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        return decoder
    }()

    private var accessToken: String? { KeychainStore.read(account: "accessToken") }

    private func request(
        path: String = "/api/native",
        query: [URLQueryItem] = [],
        method: String = "GET",
        body: Data? = nil
    ) throws -> URLRequest {
        guard let token = accessToken else { throw APIError.unauthorized }
        var components = URLComponents(url: Self.site.appending(path: path), resolvingAgainstBaseURL: false)!
        components.queryItems = query.isEmpty ? nil : query
        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.httpBody = body
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        request.timeoutInterval = 30
        return request
    }

    private func data(for request: URLRequest) async throws -> Data {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        if http.statusCode == 401 { throw APIError.unauthorized }
        guard 200..<300 ~= http.statusCode else {
            let message = (try? JSONDecoder().decode(ServerError.self, from: data).error) ?? "Request failed"
            throw APIError.server(message)
        }
        return data
    }

    func profile() async throws -> UserProfile {
        let data = try await data(for: request(query: [.init(name: "resource", value: "profile")]))
        return try decoder.decode(UserProfile.self, from: data)
    }

    func catalog(
        type: String? = nil,
        query: String? = nil,
        limit: Int = 80,
        offset: Int = 0
    ) async throws -> [MediaItem] {
        var items = [
            URLQueryItem(name: "resource", value: "catalog"),
            URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "offset", value: String(offset))
        ]
        if let type { items.append(.init(name: "type", value: type)) }
        if let query, !query.isEmpty { items.append(.init(name: "query", value: query)) }
        let data = try await data(for: request(query: items))
        return try decoder.decode([MediaItem].self, from: data)
    }

    func detail(id: String) async throws -> MediaItem {
        let data = try await data(for: request(query: [
            .init(name: "resource", value: "catalog"),
            .init(name: "id", value: id)
        ]))
        return try decoder.decode(MediaItem.self, from: data)
    }

    func progress() async throws -> [ProgressItem] {
        let data = try await data(for: request(query: [.init(name: "resource", value: "progress")]))
        return try decoder.decode([ProgressItem].self, from: data)
    }

    func watchlist() async throws -> Set<String> {
        let data = try await data(for: request(query: [.init(name: "resource", value: "watchlist")]))
        return Set(try decoder.decode([String].self, from: data))
    }

    func saveProgress(mediaId: String, position: Double, completed: Bool) async throws {
        let payload: [String: Any] = [
            "action": "progress", "mediaId": mediaId,
            "position": position, "completed": completed
        ]
        let body = try JSONSerialization.data(withJSONObject: payload)
        _ = try await data(for: request(method: "POST", body: body))
    }

    func toggleWatchlist(mediaId: String) async throws {
        let body = try JSONSerialization.data(withJSONObject: [
            "action": "watchlist", "mediaId": mediaId
        ])
        _ = try await data(for: request(method: "POST", body: body))
    }

    nonisolated func absoluteStreamURL(for media: MediaItem) -> URL {
        Self.site.appending(path: media.streamURL)
    }
}

private struct ServerError: Codable { let error: String }

enum APIError: LocalizedError {
    case unauthorized
    case invalidResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .unauthorized: "Please sign in again."
        case .invalidResponse: "CloudCinema returned an invalid response."
        case .server(let message): message
        }
    }
}
