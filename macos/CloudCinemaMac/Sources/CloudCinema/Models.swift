import Foundation

struct MediaItem: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let driveFileId: String
    let title: String
    let series: String?
    let season: Int?
    let episode: Int?
    let mediaType: String
    let posterURL: String?
    let backdropURL: String?
    let overview: String?
    let runtime: Int?
    let fileSize: Int64?
    let mimeType: String?
    let dvProfile: Int?
    let audioCodec: String?
    let audioStreams: [AudioStream]?
    let subtitleStreams: [SubtitleStream]?
    let folderPath: String?
    let episodeCount: Int?
    let createdAt: String
    let streamURL: String

    enum CodingKeys: String, CodingKey {
        case id, title, series, season, episode, runtime, overview
        case driveFileId = "drive_file_id"
        case mediaType = "media_type"
        case posterURL = "poster_url"
        case backdropURL = "backdrop_url"
        case fileSize = "file_size"
        case mimeType = "mime_type"
        case dvProfile = "dv_profile"
        case audioCodec = "audio_codec"
        case audioStreams = "audio_streams"
        case subtitleStreams = "subtitle_streams"
        case folderPath = "folder_path"
        case episodeCount = "episode_count"
        case createdAt = "created_at"
        case streamURL = "stream_url"
    }

    var displayTitle: String { series ?? title }
    var episodeLabel: String? {
        guard let season, let episode else { return nil }
        return "S\(String(format: "%02d", season)) E\(String(format: "%02d", episode))"
    }
    var poster: URL? { posterURL.flatMap(URL.init(string:)) }
    var backdrop: URL? { backdropURL.flatMap(URL.init(string:)) }
}

struct AudioStream: Codable, Hashable, Sendable {
    let index: Int
    let language: String?
    let codec: String?
    let channels: Int?
}

struct SubtitleStream: Codable, Hashable, Sendable {
    let index: Int
    let language: String?
    let codec: String?
}

struct UserProfile: Codable, Sendable {
    let id: String
    let email: String
    let displayName: String?
    let avatarUrl: String?
}

struct ProgressItem: Codable, Sendable {
    let mediaId: String
    let playbackPosition: Double
    let completed: Bool
    let lastWatched: String

    enum CodingKeys: String, CodingKey {
        case mediaId = "media_id"
        case playbackPosition = "playback_position"
        case completed
        case lastWatched = "last_watched"
    }
}

struct LibraryStats: Codable, Sendable {
    let total: Int
    let movies: Int
    let shows: Int
    let anime: Int
    let dv5: Int
    let dv78: Int
}

struct FolderListing: Codable, Sendable {
    let path: String
    let folders: [String]
    let files: [MediaItem]
}

struct SyncResult: Codable, Sendable {
    let scanned: Int
    let folders: Int
    let videos: Int
    let added: Int
    let updated: Int
    let removed: Int
    let skipped: Int
}

struct MetadataResult: Codable, Sendable {
    let processed: Int
    let matched: Int
    let unmatched: Int
    let reclassifiedAnime: Int
    let remaining: Int?
}

struct EmbeddingResult: Codable, Sendable {
    let processed: Int
    let remaining: Int
    let message: String
}

enum SidebarSection: String, CaseIterable, Identifiable {
    case home = "Home"
    case library = "Library"
    case folders = "Folders"
    case movies = "Movies"
    case shows = "TV Shows"
    case anime = "Anime"
    case watchlist = "Watchlist"
    case settings = "Settings"

    var id: String { rawValue }
    var symbol: String {
        switch self {
        case .home: "house"
        case .library: "rectangle.stack"
        case .folders: "folder"
        case .movies: "film"
        case .shows: "tv"
        case .anime: "sparkles.tv"
        case .watchlist: "bookmark"
        case .settings: "gearshape"
        }
    }
}
