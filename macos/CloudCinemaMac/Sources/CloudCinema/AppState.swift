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
    @Published var profile: UserProfile?
    @Published var catalog: [MediaItem] = []
    @Published var progress: [String: ProgressItem] = [:]
    @Published var watchlist: Set<String> = []
    @Published var selectedSection: SidebarSection = .home
    @Published var selectedMedia: MediaItem?
    @Published var selectedSeries: MediaItem?
    @Published var seriesEpisodes: [MediaItem] = []
    @Published var playingMedia: MediaItem?
    @Published var searchText = ""
    @Published var stats: LibraryStats?
    @Published var folderListing: FolderListing?
    @Published var activeOperation: String?
    @Published var syncResult: SyncResult?
    @Published var metadataResult: MetadataResult?
    @Published var embeddingResult: EmbeddingResult?
    @Published var errorMessage: String?

    @Published private var sectionMedia: [SidebarSection: [MediaItem]] = [:]
    @Published private var sectionHasMore: [SidebarSection: Bool] = [:]
    @Published private var searchResults: [MediaItem] = []

    func bootstrap() async {
        guard isAuthenticated, !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            async let profile = APIClient.shared.profile()
            async let home = APIClient.shared.catalog()
            async let progress = APIClient.shared.progress()
            async let watchlist = APIClient.shared.watchlist()
            async let stats = APIClient.shared.stats()

            self.profile = try await profile
            let homeItems = try await home
            self.sectionMedia[.home] = homeItems
            self.sectionHasMore[.home] = homeItems.count == 80
            mergeIntoCatalog(homeItems)
            self.progress = Dictionary(
                uniqueKeysWithValues: try await progress.map { ($0.mediaId, $0) }
            )
            self.watchlist = try await watchlist
            self.stats = try await stats
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

    func navigate(to section: SidebarSection) async {
        selectedSection = section
        selectedMedia = nil
        selectedSeries = nil
        seriesEpisodes = []
        searchText = ""
        searchResults = []

        if section == .folders {
            await loadFolder(path: folderListing?.path ?? "/")
        } else if section == .settings {
            await refreshStats()
        } else {
            await loadSection(section)
        }
    }

    func refreshCurrentSection() async {
        guard !isLoading else { return }
        if selectedSection == .folders {
            await loadFolder(path: folderListing?.path ?? "/")
            return
        }
        if selectedSection == .settings {
            await refreshStats()
            return
        }

        isLoading = true
        defer { isLoading = false }
        do {
            async let refreshedProgress = APIClient.shared.progress()
            async let refreshedWatchlist = APIClient.shared.watchlist()
            let items = try await fetchSection(selectedSection, offset: 0)
            sectionMedia[selectedSection] = items
            sectionHasMore[selectedSection] = items.count == 80
            mergeIntoCatalog(items)
            progress = Dictionary(
                uniqueKeysWithValues: try await refreshedProgress.map { ($0.mediaId, $0) }
            )
            watchlist = try await refreshedWatchlist
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadSection(_ section: SidebarSection, force: Bool = false) async {
        guard section != .folders, section != .settings else { return }
        if !force, sectionMedia[section] != nil { return }
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let items = try await fetchSection(section, offset: 0)
            sectionMedia[section] = items
            sectionHasMore[section] = items.count == 80
            mergeIntoCatalog(items)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadMoreIfNeeded(current media: MediaItem) async {
        let section = selectedSection
        guard searchText.isEmpty,
              section != .folders,
              section != .settings,
              sectionHasMore[section] == true,
              !isLoading,
              !isLoadingMore,
              media.id == visibleMedia.last?.id
        else { return }

        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            let currentItems = sectionMedia[section] ?? []
            let next = try await fetchSection(section, offset: currentItems.count)
            let known = Set(currentItems.map(\.id))
            let unique = next.filter { !known.contains($0.id) }
            sectionMedia[section] = currentItems + unique
            sectionHasMore[section] = next.count == 80
            mergeIntoCatalog(unique)
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
        guard !Task.isCancelled,
              query == searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        else { return }
        do {
            searchResults = try await APIClient.shared.catalog(query: query, limit: 200)
            mergeIntoCatalog(searchResults)
        } catch {
            guard !Task.isCancelled else { return }
            errorMessage = error.localizedDescription
        }
    }

    func loadFolder(path: String) async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            folderListing = try await APIClient.shared.folders(path: path)
            mergeIntoCatalog(folderListing?.files ?? [])
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func openMedia(_ media: MediaItem) async {
        let isSeries = (media.mediaType == "tv-show" || media.mediaType == "anime")
            && media.series != nil
        guard isSeries else {
            selectedSeries = nil
            seriesEpisodes = []
            selectedMedia = media
            return
        }

        selectedMedia = nil
        selectedSeries = media
        seriesEpisodes = []
        isLoading = true
        defer { isLoading = false }
        do {
            let episodes = try await APIClient.shared.episodes(series: media.series ?? media.title)
            seriesEpisodes = episodes
            mergeIntoCatalog(episodes)
        } catch {
            selectedSeries = nil
            errorMessage = error.localizedDescription
        }
    }

    func openFolder(_ name: String) async {
        let base = folderListing?.path ?? "/"
        let path = base == "/" ? "/\(name)" : "\(base)/\(name)"
        await loadFolder(path: path)
    }

    func openParentFolder() async {
        guard let path = folderListing?.path, path != "/" else { return }
        var segments = path.split(separator: "/").map(String.init)
        segments.removeLast()
        await loadFolder(path: segments.isEmpty ? "/" : "/\(segments.joined(separator: "/"))")
    }

    func runLibrarySync() async {
        guard activeOperation == nil else { return }
        activeOperation = "sync"
        syncResult = nil
        defer { activeOperation = nil }
        do {
            syncResult = try await APIClient.shared.syncLibrary()
            sectionMedia = [:]
            sectionHasMore = [:]
            await bootstrapAfterOperation()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func runMetadataSync() async {
        guard activeOperation == nil else { return }
        activeOperation = "metadata"
        metadataResult = nil
        defer { activeOperation = nil }
        do {
            metadataResult = try await APIClient.shared.syncMetadata()
            sectionMedia = [:]
            sectionHasMore = [:]
            await bootstrapAfterOperation()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func runEmbeddingGeneration() async {
        guard activeOperation == nil else { return }
        activeOperation = "embeddings"
        embeddingResult = nil
        defer { activeOperation = nil }
        do {
            embeddingResult = try await APIClient.shared.generateEmbeddings()
        } catch {
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
        sectionMedia = [:]
        sectionHasMore = [:]
        searchResults = []
        selectedMedia = nil
        selectedSeries = nil
        seriesEpisodes = []
        playingMedia = nil
        stats = nil
        folderListing = nil
        isAuthenticated = false
    }

    func toggleWatchlist(_ media: MediaItem) async {
        let wasPresent = watchlist.contains(media.id)
        if wasPresent {
            watchlist.remove(media.id)
            sectionMedia[.watchlist]?.removeAll { $0.id == media.id }
        } else {
            watchlist.insert(media.id)
            sectionMedia[.watchlist, default: []].insert(media, at: 0)
        }
        do {
            try await APIClient.shared.toggleWatchlist(mediaId: media.id)
        } catch {
            if wasPresent {
                watchlist.insert(media.id)
            } else {
                watchlist.remove(media.id)
            }
            sectionMedia[.watchlist] = nil
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
        return sectionMedia[selectedSection] ?? []
    }

    var continueWatching: [MediaItem] {
        catalog.filter {
            guard let item = progress[$0.id] else { return false }
            return item.playbackPosition > 30 && !item.completed
        }.sorted {
            (progress[$0.id]?.lastWatched ?? "") > (progress[$1.id]?.lastWatched ?? "")
        }
    }

    private func fetchSection(_ section: SidebarSection, offset: Int) async throws -> [MediaItem] {
        switch section {
        case .home, .library:
            return try await APIClient.shared.catalog(limit: 80, offset: offset)
        case .movies:
            return try await APIClient.shared.catalog(type: "movie", limit: 80, offset: offset)
        case .shows:
            return try await APIClient.shared.series(type: "tv-show", limit: 80, offset: offset)
        case .anime:
            return try await APIClient.shared.series(type: "anime", limit: 80, offset: offset)
        case .watchlist:
            return try await APIClient.shared.watchlistMedia(limit: 80, offset: offset)
        case .folders, .settings:
            return []
        }
    }

    private func mergeIntoCatalog(_ items: [MediaItem]) {
        guard !items.isEmpty else { return }
        var indexed = Dictionary(uniqueKeysWithValues: catalog.map { ($0.id, $0) })
        for item in items {
            indexed[item.id] = item
        }
        catalog = Array(indexed.values)
    }

    private func refreshStats() async {
        do {
            stats = try await APIClient.shared.stats()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func bootstrapAfterOperation() async {
        do {
            async let home = APIClient.shared.catalog()
            async let stats = APIClient.shared.stats()
            let homeItems = try await home
            sectionMedia[.home] = homeItems
            sectionHasMore[.home] = homeItems.count == 80
            mergeIntoCatalog(homeItems)
            self.stats = try await stats
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
