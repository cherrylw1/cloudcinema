import AppKit
import Foundation
import OSLog
import SwiftUI

private let appStateLog = Logger(
    subsystem: "com.cloudcinema.mac",
    category: "AppState"
)

@MainActor
final class AppState: ObservableObject {
    @Published var isAuthenticated = KeychainStore.read(account: "accessToken") != nil
    @Published var isLoading = false
    @Published var isLoadingMore = false
    @Published var hasMoreMedia = true
    @Published var profile: UserProfile?
    @Published var catalog: [MediaItem] = []
    @Published var progress: [String: ProgressItem] = [:]
    @Published var watchlist: Set<String> = []
    @Published var selectedSection: SidebarSection = .home
    @Published var selectedMedia: MediaItem?
    @Published var playingMedia: MediaItem?
    @Published var searchText = ""
    @Published private var searchResults: [MediaItem] = []
    @Published var errorMessage: String?

    func bootstrap() async {
        guard isAuthenticated else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            async let profile = APIClient.shared.profile()
            async let catalog = APIClient.shared.catalog()
            async let progress = APIClient.shared.progress()
            async let watchlist = APIClient.shared.watchlist()
            self.profile = try await profile
            self.catalog = try await catalog
            self.hasMoreMedia = self.catalog.count == 80
            self.progress = Dictionary(uniqueKeysWithValues: try await progress.map { ($0.mediaId, $0) })
            self.watchlist = try await watchlist
        } catch APIError.unauthorized {
            appStateLog.error("Native API rejected the stored session")
            signOut()
        } catch {
            appStateLog.error(
                "Bootstrap failed: \(error.localizedDescription, privacy: .public)"
            )
            errorMessage = error.localizedDescription
        }
    }

    func loadMoreIfNeeded(current media: MediaItem) async {
        guard searchText.isEmpty,
              hasMoreMedia,
              !isLoading,
              !isLoadingMore,
              media.id == visibleMedia.last?.id
        else { return }

        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            let next = try await APIClient.shared.catalog(limit: 80, offset: catalog.count)
            let known = Set(catalog.map(\.id))
            catalog.append(contentsOf: next.filter { !known.contains($0.id) })
            hasMoreMedia = next.count == 80
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateSearch() async {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            searchResults = []
            return
        }
        try? await Task.sleep(for: .milliseconds(250))
        guard !Task.isCancelled, query == searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        else { return }
        do {
            searchResults = try await APIClient.shared.catalog(query: query, limit: 200)
        } catch {
            guard !Task.isCancelled else { return }
            errorMessage = error.localizedDescription
        }
    }

    func completeAuthentication(accessToken: String, refreshToken: String) async {
        KeychainStore.save(accessToken, account: "accessToken")
        KeychainStore.save(refreshToken, account: "refreshToken")
        appStateLog.notice("Stored native session; loading library")
        isAuthenticated = true
        await bootstrap()
    }

    func startAuthentication() {
        do {
            try NativeAuthentication.start()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func handleAuthenticationCallback(_ url: URL) async {
        do {
            let tokens = try NativeAuthentication.consumeCallback(url)
            NSApp.activate(ignoringOtherApps: true)
            await completeAuthentication(
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken
            )
        } catch {
            appStateLog.error(
                "Authentication callback failed: \(error.localizedDescription, privacy: .public)"
            )
            NSApp.activate(ignoringOtherApps: true)
            errorMessage = error.localizedDescription
        }
    }

    func signOut() {
        KeychainStore.clear()
        profile = nil
        catalog = []
        progress = [:]
        watchlist = []
        searchResults = []
        hasMoreMedia = true
        selectedMedia = nil
        playingMedia = nil
        isAuthenticated = false
    }

    func toggleWatchlist(_ media: MediaItem) async {
        let wasPresent = watchlist.contains(media.id)
        if wasPresent { watchlist.remove(media.id) } else { watchlist.insert(media.id) }
        do {
            try await APIClient.shared.toggleWatchlist(mediaId: media.id)
        } catch {
            if wasPresent { watchlist.insert(media.id) } else { watchlist.remove(media.id) }
            errorMessage = error.localizedDescription
        }
    }

    func saveProgress(mediaId: String, position: Double, duration: Double) {
        Task {
            try? await APIClient.shared.saveProgress(
                mediaId: mediaId,
                position: position,
                completed: duration > 0 && position / duration >= 0.92
            )
        }
    }

    var visibleMedia: [MediaItem] {
        if !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return searchResults
        }
        let base: [MediaItem]
        switch selectedSection {
        case .home, .library: base = catalog
        case .movies: base = catalog.filter { $0.mediaType == "movie" }
        case .shows: base = catalog.filter { $0.mediaType == "tv-show" }
        case .anime: base = catalog.filter { $0.mediaType == "anime" }
        case .watchlist: base = catalog.filter { watchlist.contains($0.id) }
        }
        return base
    }

    var continueWatching: [MediaItem] {
        catalog.filter {
            guard let item = progress[$0.id] else { return false }
            return item.playbackPosition > 30 && !item.completed
        }.sorted {
            (progress[$0.id]?.lastWatched ?? "") > (progress[$1.id]?.lastWatched ?? "")
        }
    }
}
