import SwiftUI

struct PlayerView: View {
    let media: MediaItem
    let resumeAt: Double
    let onClose: () -> Void
    let onProgress: (Double, Double) -> Void

    @StateObject private var engine = MPVEngine()
    @State private var controlsVisible = true
    @State private var lastSavedPosition = 0.0
    @State private var isScrubbing = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            MPVSurface(engine: engine)
                .ignoresSafeArea()

            if let error = engine.errorMessage {
                ContentUnavailableView(
                    "Playback unavailable",
                    systemImage: "exclamationmark.triangle",
                    description: Text(error)
                )
                .foregroundStyle(.white)
            }

            if controlsVisible {
                controls
                    .transition(.opacity)
            }
        }
        .onAppear {
            engine.load(APIClient.shared.absoluteStreamURL(for: media), resumeAt: resumeAt)
        }
        .onChange(of: engine.position) { _, position in
            if abs(position - lastSavedPosition) >= 15 {
                lastSavedPosition = position
                onProgress(position, engine.duration)
            }
        }
        .onDisappear {
            onProgress(engine.position, engine.duration)
            engine.shutdown()
        }
        .onHover { hovering in
            withAnimation(.easeOut(duration: 0.18)) { controlsVisible = hovering }
        }
        .focusable()
        .onKeyPress(.space) {
            engine.togglePause()
            return .handled
        }
        .onKeyPress(.leftArrow) {
            engine.seek(by: -10)
            return .handled
        }
        .onKeyPress(.rightArrow) {
            engine.seek(by: 10)
            return .handled
        }
    }

    private var controls: some View {
        VStack(spacing: 0) {
            HStack {
                Button(action: onClose) {
                    Label("Back", systemImage: "chevron.left")
                }
                .buttonStyle(.borderedProminent)
                .tint(.black.opacity(0.45))
                Spacer()
                Text(media.title)
                    .font(.headline)
                    .lineLimit(1)
                Spacer()
                Color.clear.frame(width: 80)
            }
            .padding(18)
            .background(.ultraThinMaterial)

            Spacer()

            VStack(spacing: 12) {
                Slider(
                    value: Binding(
                        get: { engine.position },
                        set: { value in if isScrubbing { engine.position = value } }
                    ),
                    in: 0...max(engine.duration, 1),
                    onEditingChanged: { editing in
                        isScrubbing = editing
                        if !editing { engine.seek(to: engine.position) }
                    }
                )
                .tint(.red)

                HStack(spacing: 14) {
                    Text(time(engine.position))
                        .monospacedDigit()
                        .frame(width: 62, alignment: .leading)

                    Button { engine.seek(by: -10) } label: {
                        Image(systemName: "gobackward.10")
                    }
                    Button { engine.togglePause() } label: {
                        Image(systemName: engine.isPaused ? "play.fill" : "pause.fill")
                            .font(.title2)
                            .frame(width: 28)
                    }
                    .keyboardShortcut(.space, modifiers: [])
                    Button { engine.seek(by: 10) } label: {
                        Image(systemName: "goforward.10")
                    }

                    HStack(spacing: 7) {
                        Image(systemName: engine.volume == 0 ? "speaker.slash.fill" : "speaker.wave.2.fill")
                        Slider(
                            value: Binding(
                                get: { engine.volume },
                                set: { value in engine.setVolume(value) }
                            ),
                            in: 0...100
                        )
                        .frame(width: 100)
                    }

                    Spacer()

                    Menu {
                        if engine.audioTracks.isEmpty {
                            Text("Tracks appear when playback starts")
                        }
                        ForEach(engine.audioTracks) { track in
                            Button {
                                engine.selectAudio(track.id)
                            } label: {
                                if engine.selectedAudio == track.id {
                                    Label(track.title, systemImage: "checkmark")
                                } else {
                                    Text(track.title)
                                }
                            }
                        }
                    } label: {
                        Label("Audio", systemImage: "waveform")
                    }

                    Menu {
                        Button("Off") { engine.selectSubtitle(0) }
                        Divider()
                        ForEach(engine.subtitleTracks) { track in
                            Button {
                                engine.selectSubtitle(track.id)
                            } label: {
                                if engine.selectedSubtitle == track.id {
                                    Label(track.title, systemImage: "checkmark")
                                } else {
                                    Text(track.title)
                                }
                            }
                        }
                    } label: {
                        Label("Subtitles", systemImage: "captions.bubble")
                    }

                    Text("-\(time(max(0, engine.duration - engine.position)))")
                        .monospacedDigit()
                        .frame(width: 68, alignment: .trailing)
                }
                .buttonStyle(.plain)
                .font(.system(size: 13, weight: .semibold))
            }
            .padding(18)
            .background(.ultraThinMaterial)
        }
        .foregroundStyle(.white)
    }

    private func time(_ seconds: Double) -> String {
        guard seconds.isFinite else { return "0:00" }
        let value = max(0, Int(seconds))
        let hours = value / 3600
        let minutes = (value % 3600) / 60
        let secs = value % 60
        return hours > 0
            ? String(format: "%d:%02d:%02d", hours, minutes, secs)
            : String(format: "%d:%02d", minutes, secs)
    }
}
