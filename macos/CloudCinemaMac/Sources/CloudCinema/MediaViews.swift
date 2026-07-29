import SwiftUI

struct MediaCard: View {
    let media: MediaItem
    let progress: ProgressItem?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                ZStack(alignment: .bottom) {
                    AsyncImage(url: media.poster) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().scaledToFill()
                        default:
                            Rectangle()
                                .fill(.white.opacity(0.06))
                                .overlay {
                                    Image(systemName: media.mediaType == "movie" ? "film" : "tv")
                                        .font(.largeTitle)
                                        .foregroundStyle(.secondary)
                                }
                        }
                    }
                    .aspectRatio(2 / 3, contentMode: .fit)
                    .clipped()

                    if let progress, progress.playbackPosition > 0, !progress.completed {
                        GeometryReader { geometry in
                            VStack {
                                Spacer()
                                ZStack(alignment: .leading) {
                                    Rectangle().fill(.black.opacity(0.5))
                                    Rectangle()
                                        .fill(.red)
                                        .frame(width: geometry.size.width * min(progress.playbackPosition / max(Double(media.runtime ?? 1) * 60, 1), 1))
                                }
                                .frame(height: 3)
                            }
                        }
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                Text(media.displayTitle)
                    .font(.system(size: 13, weight: .semibold))
                    .lineLimit(1)
                if let episode = media.episodeLabel {
                    Text(episode)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else if let count = media.episodeCount {
                    Text("\(count) episodes")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    Text(media.mediaType == "movie" ? "Movie" : "Series")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button("Play") { action() }
        }
    }
}

struct SeriesDetailView: View {
    let series: MediaItem
    let episodes: [MediaItem]
    let progress: [String: ProgressItem]
    let isWatchlisted: Bool
    let play: (MediaItem) -> Void
    let toggleWatchlist: () -> Void
    let close: () -> Void

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    hero
                    VStack(alignment: .leading, spacing: 24) {
                        if episodes.isEmpty {
                            ProgressView("Loading episodes")
                                .frame(maxWidth: .infinity, minHeight: 220)
                        } else {
                            ForEach(seasons, id: \.self) { season in
                                VStack(alignment: .leading, spacing: 10) {
                                    Text("Season \(season)")
                                        .font(.title3.bold())
                                    ForEach(episodesForSeason(season)) { episode in
                                        episodeRow(episode)
                                    }
                                }
                            }
                        }
                    }
                    .padding(28)
                }
            }
        }
        .foregroundStyle(.white)
    }

    private var hero: some View {
        ZStack(alignment: .bottomLeading) {
            AsyncImage(url: series.backdrop) { phase in
                if case .success(let image) = phase {
                    image.resizable().scaledToFill()
                } else {
                    Color.black
                }
            }
            .frame(height: 360)
            .clipped()
            .overlay(.black.opacity(0.42))
            .overlay {
                LinearGradient(
                    colors: [.clear, .black.opacity(0.96)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }

            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Button(action: close) {
                        Label("Back", systemImage: "chevron.left")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.black.opacity(0.5))
                    Spacer()
                }
                Spacer()
                Text(series.displayTitle)
                    .font(.system(size: 38, weight: .bold))
                    .lineLimit(2)
                HStack(spacing: 10) {
                    Text("\(episodes.count) episodes")
                    if series.mediaType == "anime" { Text("Anime") }
                    else { Text("TV Show") }
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)

                if let overview = series.overview {
                    Text(overview)
                        .foregroundStyle(.white.opacity(0.78))
                        .lineLimit(3)
                        .frame(maxWidth: 720, alignment: .leading)
                }

                HStack(spacing: 12) {
                    Button {
                        if let target = playTarget { play(target) }
                    } label: {
                        Label("Play", systemImage: "play.fill")
                            .frame(minWidth: 90)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.white)
                    .foregroundStyle(.black)
                    .disabled(playTarget == nil)

                    Button(action: toggleWatchlist) {
                        Label(
                            isWatchlisted ? "In Watchlist" : "Add to Watchlist",
                            systemImage: isWatchlisted ? "checkmark" : "plus"
                        )
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.black.opacity(0.5))
                }
            }
            .padding(28)
            .frame(height: 360)
        }
    }

    private func episodeRow(_ episode: MediaItem) -> some View {
        Button {
            play(episode)
        } label: {
            HStack(spacing: 14) {
                Image(systemName: progress[episode.id]?.completed == true
                    ? "checkmark.circle.fill"
                    : "play.circle.fill")
                    .font(.title2)
                    .foregroundStyle(progress[episode.id]?.completed == true ? .green : .white)
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(episode.episodeLabel ?? episode.title)
                            .font(.headline)
                        Text(episode.title)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    if let position = progress[episode.id]?.playbackPosition, position > 0 {
                        Text("Resume at \(duration(position))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                if let runtime = episode.runtime {
                    Text(duration(Double(runtime)))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 64)
            .background(.white.opacity(0.055))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }

    private var seasons: [Int] {
        Array(Set(episodes.map { $0.season ?? 1 })).sorted()
    }

    private func episodesForSeason(_ season: Int) -> [MediaItem] {
        episodes.filter { ($0.season ?? 1) == season }
    }

    private var playTarget: MediaItem? {
        guard !episodes.isEmpty else { return nil }
        let watched = episodes.compactMap { episode -> (MediaItem, ProgressItem)? in
            progress[episode.id].map { (episode, $0) }
        }
        guard let latest = watched.max(by: { $0.1.lastWatched < $1.1.lastWatched }),
              let index = episodes.firstIndex(of: latest.0)
        else { return episodes.first }
        if latest.1.completed, episodes.indices.contains(index + 1) {
            return episodes[index + 1]
        }
        return latest.0
    }

    private func duration(_ seconds: Double) -> String {
        let value = max(0, Int(seconds))
        let hours = value / 3600
        let minutes = (value % 3600) / 60
        let secs = value % 60
        return hours > 0
            ? String(format: "%d:%02d:%02d", hours, minutes, secs)
            : String(format: "%d:%02d", minutes, secs)
    }
}

struct MediaDetailView: View {
    let media: MediaItem
    let isWatchlisted: Bool
    let progress: ProgressItem?
    let play: () -> Void
    let toggleWatchlist: () -> Void
    let close: () -> Void

    var body: some View {
        ZStack {
            AsyncImage(url: media.backdrop) { phase in
                if case .success(let image) = phase {
                    image.resizable().scaledToFill()
                } else {
                    Color.black
                }
            }
            .ignoresSafeArea()
            .overlay(.black.opacity(0.48))
            .overlay {
                LinearGradient(
                    colors: [.clear, .black.opacity(0.4), .black.opacity(0.96)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }

            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    Button(action: close) { Image(systemName: "chevron.left") }
                        .buttonStyle(.borderedProminent)
                        .tint(.black.opacity(0.4))
                    Spacer()
                }
                Spacer()
                Text(media.displayTitle)
                    .font(.system(size: 38, weight: .bold))
                    .lineLimit(2)
                    .frame(maxWidth: 760, alignment: .leading)

                HStack(spacing: 10) {
                    if let episode = media.episodeLabel { Text(episode) }
                    if let runtime = media.runtime { Text("\(runtime) min") }
                    if let codec = media.audioCodec { Text(codec.uppercased()) }
                    if media.dvProfile != nil { Text("Dolby Vision") }
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)

                Text(media.overview ?? "Ready to play from your CloudCinema library.")
                    .font(.body)
                    .foregroundStyle(.white.opacity(0.82))
                    .lineLimit(4)
                    .frame(maxWidth: 700, alignment: .leading)

                HStack(spacing: 12) {
                    Button(action: play) {
                        Label(progress == nil ? "Play" : "Resume", systemImage: "play.fill")
                            .frame(minWidth: 100)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.white)
                    .foregroundStyle(.black)
                    .controlSize(.large)

                    Button(action: toggleWatchlist) {
                        Label(
                            isWatchlisted ? "In Watchlist" : "Add to Watchlist",
                            systemImage: isWatchlisted ? "checkmark" : "plus"
                        )
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.black.opacity(0.42))
                    .controlSize(.large)
                }
            }
            .padding(32)
        }
        .foregroundStyle(.white)
    }
}
