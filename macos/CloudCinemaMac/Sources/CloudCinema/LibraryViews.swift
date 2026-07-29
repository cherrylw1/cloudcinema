import SwiftUI

struct FolderBrowserView: View {
    @EnvironmentObject private var state: AppState

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 22) {
                HStack(spacing: 10) {
                    Button {
                        Task { await state.openParentFolder() }
                    } label: {
                        Image(systemName: "chevron.left")
                    }
                    .disabled(state.folderListing?.path == "/" || state.folderListing == nil)

                    VStack(alignment: .leading, spacing: 3) {
                        Text("Folders")
                            .font(.system(size: 28, weight: .bold))
                        Text(state.folderListing?.path ?? "/")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if state.isLoading { ProgressView().controlSize(.small) }
                }

                if let folders = state.folderListing?.folders, !folders.isEmpty {
                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: 190, maximum: 260), spacing: 12)],
                        spacing: 12
                    ) {
                        ForEach(folders, id: \.self) { folder in
                            Button {
                                Task { await state.openFolder(folder) }
                            } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: "folder.fill")
                                        .foregroundStyle(.blue)
                                    Text(folder)
                                        .lineLimit(1)
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                .padding(12)
                                .background(.regularMaterial)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                if let files = state.folderListing?.files, !files.isEmpty {
                    Text("\(files.count) titles")
                        .font(.headline)
                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: 145, maximum: 190), spacing: 18)],
                        spacing: 24
                    ) {
                        ForEach(files) { media in
                            MediaCard(media: media, progress: state.progress[media.id]) {
                                Task { await state.openMedia(media) }
                            }
                        }
                    }
                } else if !state.isLoading, state.folderListing?.folders.isEmpty == true {
                    ContentUnavailableView(
                        "This folder is empty",
                        systemImage: "folder",
                        description: Text("Synchronize the library to pick up Drive changes.")
                    )
                    .frame(maxWidth: .infinity, minHeight: 300)
                }
            }
            .padding(26)
        }
        .background {
            VisualEffect(material: .underWindowBackground, blending: .behindWindow)
                .ignoresSafeArea()
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject private var state: AppState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Settings")
                        .font(.system(size: 28, weight: .bold))
                    Text("Library maintenance and playback information")
                        .foregroundStyle(.secondary)
                }

                if let stats = state.stats {
                    HStack(spacing: 1) {
                        stat("All Titles", value: stats.total)
                        stat("Movies", value: stats.movies)
                        stat("TV Shows", value: stats.shows)
                        stat("Anime", value: stats.anime)
                    }
                    .background(.separator)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                GroupBox {
                    VStack(alignment: .leading, spacing: 18) {
                        settingRow(
                            title: "Sync Library",
                            detail: "Scan Google Drive for new, changed, or removed videos.",
                            symbol: "arrow.triangle.2.circlepath",
                            operation: "sync",
                            action: { await state.runLibrarySync() }
                        )
                        Divider()
                        settingRow(
                            title: "Fetch Metadata",
                            detail: "Match up to 200 unmatched titles with TMDB metadata.",
                            symbol: "film.stack",
                            operation: "metadata",
                            action: { await state.runMetadataSync() }
                        )
                        Divider()
                        settingRow(
                            title: "Generate AI Embeddings",
                            detail: "Generate search embeddings for the next batch of unmatched titles.",
                            symbol: "sparkles",
                            operation: "embeddings",
                            action: { await state.runEmbeddingGeneration() }
                        )
                    }
                    .padding(6)
                } label: {
                    Label("Media Library", systemImage: "externaldrive")
                }

                if let result = state.syncResult {
                    resultPanel(
                        title: "Library Sync Complete",
                        text: "\(result.scanned) scanned, \(result.added) added, \(result.updated) updated, \(result.removed) removed, \(result.skipped) skipped."
                    )
                }
                if let result = state.metadataResult {
                    resultPanel(
                        title: "Metadata Fetch Complete",
                        text: "\(result.processed) processed, \(result.matched) matched, \(result.unmatched) unmatched, \(result.reclassifiedAnime) moved to Anime."
                    )
                }
                if let result = state.embeddingResult {
                    resultPanel(
                        title: "Embedding Generation Complete",
                        text: "\(result.message) \(result.remaining) remaining."
                    )
                }

                if let stats = state.stats {
                    GroupBox {
                        HStack {
                            Label(
                                "\(stats.dv5) Profile 5",
                                systemImage: "exclamationmark.triangle"
                            )
                            .foregroundStyle(.orange)
                            Spacer()
                            Label(
                                "\(stats.dv78) Profile 7 / 8",
                                systemImage: "checkmark.circle"
                            )
                            .foregroundStyle(.green)
                        }
                        .padding(6)
                    } label: {
                        Text("Dolby Vision")
                    }
                }
            }
            .padding(26)
            .frame(maxWidth: 900, alignment: .leading)
        }
        .background {
            VisualEffect(material: .underWindowBackground, blending: .behindWindow)
                .ignoresSafeArea()
        }
    }

    private func stat(_ title: String, value: Int) -> some View {
        VStack(spacing: 4) {
            Text(value.formatted())
                .font(.title2.bold())
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(.regularMaterial)
    }

    private func settingRow(
        title: String,
        detail: String,
        symbol: String,
        operation: String,
        action: @escaping () async -> Void
    ) -> some View {
        HStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.title2)
                .frame(width: 32)
                .foregroundStyle(.tint)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button {
                Task { await action() }
            } label: {
                if state.activeOperation == operation {
                    ProgressView()
                        .controlSize(.small)
                        .frame(width: 72)
                } else {
                    Text("Run")
                        .frame(width: 72)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(state.activeOperation != nil)
        }
    }

    private func resultPanel(title: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline)
                Text(text)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
