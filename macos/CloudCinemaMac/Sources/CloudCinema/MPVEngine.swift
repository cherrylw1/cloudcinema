import AppKit
import CMPV
import Foundation
import SwiftUI

struct MPVTrack: Identifiable, Hashable {
    let id: Int
    let type: String
    let title: String
    let language: String
}

@MainActor
final class MPVEngine: ObservableObject {
    @Published var isReady = false
    @Published var isPaused = true
    @Published var position = 0.0
    @Published var duration = 0.0
    @Published var volume = 80.0
    @Published var audioTracks: [MPVTrack] = []
    @Published var subtitleTracks: [MPVTrack] = []
    @Published var selectedAudio = 0
    @Published var selectedSubtitle = 0
    @Published var errorMessage: String?

    private weak var surface: CCMPVView?
    private var timer: Timer?
    private var pendingURL: URL?
    private var pendingPosition = 0.0

    func attach(to view: CCMPVView) {
        guard surface == nil else { return }
        surface = view
        if let error = view.startPlaybackEngine() {
            errorMessage = error
            return
        }
        isReady = true
        startPolling()
        if let pendingURL {
            load(pendingURL, resumeAt: pendingPosition)
        }
    }

    func load(_ url: URL, resumeAt: Double = 0) {
        guard let surface, surface.isEngineReady else {
            pendingURL = url
            pendingPosition = resumeAt
            return
        }
        errorMessage = surface.loadURLString(url.absoluteString, resumeAt: resumeAt)
    }

    func togglePause() {
        run("cycle pause")
    }

    func seek(by seconds: Double) {
        run("seek \(seconds) relative exact")
    }

    func seek(to seconds: Double) {
        run("seek \(seconds) absolute exact")
    }

    func setVolume(_ value: Double) {
        volume = value
        run("set volume \(value)")
    }

    func selectAudio(_ id: Int) {
        selectedAudio = id
        run("set aid \(id)")
    }

    func selectSubtitle(_ id: Int) {
        selectedSubtitle = id
        run(id == 0 ? "set sid no" : "set sid \(id)")
    }

    private func run(_ command: String) {
        if let error = surface?.command(command) {
            errorMessage = error
        }
    }

    private func startPolling() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.poll() }
        }
    }

    private func poll() {
        guard let surface else { return }
        position = surface.propertyDouble("time-pos", fallback: position)
        duration = surface.propertyDouble("duration", fallback: duration)
        isPaused = surface.propertyString("pause") == "yes"
        volume = surface.propertyDouble("volume", fallback: volume)
        if duration > 0, audioTracks.isEmpty, subtitleTracks.isEmpty {
            refreshTracks()
        }
        if duration == 0,
           let path = surface.propertyString("path"),
           !path.isEmpty,
           surface.propertyString("error") != nil {
            errorMessage = "The playback engine could not decode this file."
        }
    }

    private func refreshTracks() {
        guard let surface else { return }
        let count = Int(surface.propertyDouble("track-list/count", fallback: 0))
        var audio: [MPVTrack] = []
        var subtitles: [MPVTrack] = []
        for index in 0..<count {
            let prefix = "track-list/\(index)"
            guard let type = surface.propertyString("\(prefix)/type") else { continue }
            let id = Int(surface.propertyDouble("\(prefix)/id", fallback: 0))
            let language = surface.propertyString("\(prefix)/lang") ?? "und"
            let fallbackTitle = language == "und" ? "Track \(id)" : language.uppercased()
            let title = surface.propertyString("\(prefix)/title") ?? fallbackTitle
            let track = MPVTrack(id: id, type: type, title: title, language: language)
            if type == "audio" { audio.append(track) }
            if type == "sub" { subtitles.append(track) }
        }
        audioTracks = audio
        subtitleTracks = subtitles
        selectedAudio = Int(surface.propertyDouble("aid", fallback: Double(audio.first?.id ?? 0)))
        selectedSubtitle = Int(surface.propertyDouble("sid", fallback: 0))
    }

    func shutdown() {
        timer?.invalidate()
        timer = nil
        surface?.shutdown()
        surface = nil
    }
}

struct MPVSurface: NSViewRepresentable {
    @ObservedObject var engine: MPVEngine

    func makeNSView(context: Context) -> CCMPVView {
        let view = CCMPVView(frame: .zero)
        DispatchQueue.main.async {
            engine.attach(to: view)
        }
        return view
    }

    func updateNSView(_ nsView: CCMPVView, context: Context) {}
}
