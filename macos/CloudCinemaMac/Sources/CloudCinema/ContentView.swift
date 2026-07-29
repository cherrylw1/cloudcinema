import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var state: AppState

    var body: some View {
        Group {
            if !state.isAuthenticated {
                welcome
            } else if let playing = state.playingMedia {
                PlayerView(
                    media: playing,
                    resumeAt: state.progress[playing.id]?.playbackPosition ?? 0,
                    onClose: { state.playingMedia = nil },
                    onProgress: { position, duration in
                        state.saveProgress(mediaId: playing.id, position: position, duration: duration)
                    }
                )
            } else {
                appShell
            }
        }
        .frame(minWidth: 900, minHeight: 600)
        .task { await state.bootstrap() }
        .alert(
            "CloudCinema",
            isPresented: Binding(
                get: { state.errorMessage != nil },
                set: { if !$0 { state.errorMessage = nil } }
            )
        ) {
            Button("OK") { state.errorMessage = nil }
        } message: {
            Text(state.errorMessage ?? "")
        }
    }

    private var welcome: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.04, green: 0.05, blue: 0.08), .black],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 22) {
                Image(systemName: "play.rectangle.fill")
                    .font(.system(size: 64, weight: .semibold))
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(.white, .red)
                Text("CloudCinema")
                    .font(.system(size: 36, weight: .bold))
                Text("Your library, built for Mac.")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                Button("Sign in with Google") {
                    state.startAuthentication()
                }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .tint(.white)
                    .foregroundStyle(.black)
            }
            .padding(42)
            .glassPanel(radius: 22)
        }
    }

    private var appShell: some View {
        NavigationSplitView {
            VStack(spacing: 8) {
                HStack(spacing: 10) {
                    Image(systemName: "play.rectangle.fill")
                        .foregroundStyle(.red)
                    Text("CloudCinema")
                        .font(.headline)
                }
                .padding(.vertical, 12)

                List {
                    ForEach(SidebarSection.allCases) { section in
                        Button {
                            Task { await state.navigate(to: section) }
                        } label: {
                            HStack {
                                Label(section.rawValue, systemImage: section.symbol)
                                Spacer()
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(
                            state.selectedSection == section
                                ? Color.accentColor.opacity(0.18)
                                : Color.clear
                        )
                    }
                }
                .listStyle(.sidebar)

                Spacer()
                if let profile = state.profile {
                    Menu {
                        Text(profile.email)
                        Divider()
                        Button("Sign Out", role: .destructive) { state.signOut() }
                    } label: {
                        HStack {
                            Image(systemName: "person.crop.circle.fill")
                                .font(.title2)
                            Text(profile.displayName ?? profile.email)
                                .lineLimit(1)
                            Spacer()
                            Image(systemName: "ellipsis")
                        }
                        .padding(10)
                        .contentShape(Rectangle())
                    }
                    .menuStyle(.borderlessButton)
                    .padding(8)
                }
            }
            .navigationSplitViewColumnWidth(min: 190, ideal: 220, max: 260)
        } detail: {
            if let selected = state.selectedMedia {
                MediaDetailView(
                    media: selected,
                    isWatchlisted: state.watchlist.contains(selected.id),
                    progress: state.progress[selected.id],
                    play: { state.playingMedia = selected },
                    toggleWatchlist: { Task { await state.toggleWatchlist(selected) } },
                    close: { state.selectedMedia = nil }
                )
            } else if state.selectedSection == .settings {
                SettingsView()
            } else if state.selectedSection == .folders {
                FolderBrowserView()
            } else {
                catalog
            }
        }
        .searchable(text: $state.searchText, placement: .toolbar, prompt: "Search your library")
        .task(id: state.searchText) {
            await state.updateSearch()
        }
        .toolbar {
            ToolbarItem {
                Button { Task { await state.refreshCurrentSection() } } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .disabled(state.isLoading || state.activeOperation != nil)
                .help("Refresh Current View")
            }
        }
    }

    private var catalog: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 26) {
                if state.selectedSection == .home, !state.continueWatching.isEmpty {
                    section(title: "Continue Watching", items: Array(state.continueWatching.prefix(12)))
                }

                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(state.selectedSection.rawValue)
                            .font(.system(size: 28, weight: .bold))
                        Text("\(state.visibleMedia.count) titles")
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if state.isLoading {
                        ProgressView().controlSize(.small)
                    } else {
                        Button {
                            Task { await state.refreshCurrentSection() }
                        } label: {
                            Label("Refresh", systemImage: "arrow.clockwise")
                        }
                        .buttonStyle(.borderless)
                    }
                }

                if state.visibleMedia.isEmpty, !state.isLoading {
                    ContentUnavailableView(
                        "No titles found",
                        systemImage: "film.stack",
                        description: Text("Refresh this view after synchronizing your library.")
                    )
                    .frame(maxWidth: .infinity, minHeight: 300)
                } else {
                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: 145, maximum: 190), spacing: 18)],
                        spacing: 24
                    ) {
                        ForEach(state.visibleMedia) { media in
                            MediaCard(media: media, progress: state.progress[media.id]) {
                                state.selectedMedia = media
                            }
                            .task {
                                await state.loadMoreIfNeeded(current: media)
                            }
                        }
                    }
                }
                if state.isLoadingMore {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
            }
            .padding(26)
        }
        .background {
            VisualEffect(material: .underWindowBackground, blending: .behindWindow)
                .ignoresSafeArea()
        }
    }

    private func section(title: String, items: [MediaItem]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.title2.bold())
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 16) {
                    ForEach(items) { media in
                        MediaCard(media: media, progress: state.progress[media.id]) {
                            state.selectedMedia = media
                        }
                        .frame(width: 150)
                    }
                }
            }
        }
    }
}
