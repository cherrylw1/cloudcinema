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
