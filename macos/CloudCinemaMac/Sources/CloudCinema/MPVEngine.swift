import AppKit
import Darwin
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

    private var api: MPVAPI?
    private var handle: OpaquePointer?
    private var timer: Timer?
    private var pendingURL: URL?
    private var pendingPosition = 0.0

    func attach(to view: NSView) {
        guard handle == nil else { return }
        do {
            let api = try MPVAPI()
            guard let handle = api.create() else { throw MPVError.initialization }
            self.api = api
            self.handle = handle

            let pointer = UInt(bitPattern: Unmanaged.passUnretained(view).toOpaque())
            api.setOption(handle, "wid", String(pointer))
            api.setOption(handle, "vo", "gpu-next")
            api.setOption(handle, "gpu-api", "metal")
            api.setOption(handle, "hwdec", "auto-safe")
            api.setOption(handle, "cache", "yes")
            api.setOption(handle, "demuxer-max-bytes", "256MiB")
            api.setOption(handle, "demuxer-max-back-bytes", "64MiB")
            api.setOption(handle, "audio-client-name", "CloudCinema")
            api.setOption(handle, "sub-auto", "fuzzy")
            guard api.initialize(handle) >= 0 else { throw MPVError.initialization }
            isReady = true
            startPolling()
            if let pendingURL { load(pendingURL, resumeAt: pendingPosition) }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func load(_ url: URL, resumeAt: Double = 0) {
        guard let api, let handle else {
            pendingURL = url
            pendingPosition = resumeAt
            return
        }
        api.command(handle, "loadfile \"\(escape(url.absoluteString))\" replace")
        if resumeAt > 0 { api.command(handle, "seek \(resumeAt) absolute exact") }
        api.command(handle, "set pause no")
    }

    func togglePause() {
        guard let api, let handle else { return }
        api.command(handle, "cycle pause")
    }
    func seek(by seconds: Double) {
        guard let api, let handle else { return }
        api.command(handle, "seek \(seconds) relative exact")
    }
    func seek(to seconds: Double) {
        guard let api, let handle else { return }
        api.command(handle, "seek \(seconds) absolute exact")
    }
    func setVolume(_ value: Double) {
        guard let api, let handle else { return }
        volume = value
        api.command(handle, "set volume \(value)")
    }
    func selectAudio(_ id: Int) {
        guard let api, let handle else { return }
        selectedAudio = id
        api.command(handle, "set aid \(id)")
    }
    func selectSubtitle(_ id: Int) {
        guard let api, let handle else { return }
        selectedSubtitle = id
        api.command(handle, id == 0 ? "set sid no" : "set sid \(id)")
    }

    private func startPolling() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.poll() }
        }
    }

    private func poll() {
        guard let api, let handle else { return }
        position = api.double(handle, "time-pos") ?? position
        duration = api.double(handle, "duration") ?? duration
        isPaused = api.string(handle, "pause") == "yes"
        if let volume = api.double(handle, "volume") { self.volume = volume }
        if audioTracks.isEmpty && duration > 0 { refreshTracks() }
    }

    private func refreshTracks() {
        guard let api, let handle else { return }
        let count = Int(api.double(handle, "track-list/count") ?? 0)
        var audio: [MPVTrack] = []
        var subtitles: [MPVTrack] = []
        for index in 0..<count {
            let prefix = "track-list/\(index)"
            guard let type = api.string(handle, "\(prefix)/type"),
                  let id = api.double(handle, "\(prefix)/id") else { continue }
            let language = api.string(handle, "\(prefix)/lang") ?? "und"
            let title = api.string(handle, "\(prefix)/title") ?? language.uppercased()
            let track = MPVTrack(id: Int(id), type: type, title: title, language: language)
            if type == "audio" { audio.append(track) }
            if type == "sub" { subtitles.append(track) }
        }
        audioTracks = audio
        subtitleTracks = subtitles
    }

    private func escape(_ value: String) -> String {
        value.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"")
    }

    func shutdown() {
        timer?.invalidate()
        timer = nil
        if let handle { api?.terminate(handle) }
        handle = nil
    }
}

private final class MPVAPI {
    typealias Create = @convention(c) () -> OpaquePointer?
    typealias Initialize = @convention(c) (OpaquePointer?) -> Int32
    typealias SetOption = @convention(c) (OpaquePointer?, UnsafePointer<CChar>?, UnsafePointer<CChar>?) -> Int32
    typealias CommandString = @convention(c) (OpaquePointer?, UnsafePointer<CChar>?) -> Int32
    typealias GetPropertyString = @convention(c) (OpaquePointer?, UnsafePointer<CChar>?) -> UnsafeMutablePointer<CChar>?
    typealias Free = @convention(c) (UnsafeMutableRawPointer?) -> Void
    typealias Terminate = @convention(c) (OpaquePointer?) -> Void

    let library: UnsafeMutableRawPointer
    let create: Create
    let initialize: Initialize
    private let setOptionFn: SetOption
    private let commandFn: CommandString
    private let getStringFn: GetPropertyString
    private let freeFn: Free
    let terminate: Terminate

    init() throws {
        let bundled = Bundle.main.bundleURL.appending(path: "Contents/Frameworks/libmpv.2.dylib").path
        let candidates = [bundled, "/Applications/IINA.app/Contents/Frameworks/libmpv.2.dylib"]
        guard let library = candidates.compactMap({ dlopen($0, RTLD_NOW | RTLD_LOCAL) }).first else {
            throw MPVError.missingRuntime
        }
        self.library = library
        create = try MPVAPI.symbol(library, "mpv_create", as: Create.self)
        initialize = try MPVAPI.symbol(library, "mpv_initialize", as: Initialize.self)
        setOptionFn = try MPVAPI.symbol(library, "mpv_set_option_string", as: SetOption.self)
        commandFn = try MPVAPI.symbol(library, "mpv_command_string", as: CommandString.self)
        getStringFn = try MPVAPI.symbol(library, "mpv_get_property_string", as: GetPropertyString.self)
        freeFn = try MPVAPI.symbol(library, "mpv_free", as: Free.self)
        terminate = try MPVAPI.symbol(library, "mpv_terminate_destroy", as: Terminate.self)
    }

    func setOption(_ handle: OpaquePointer, _ name: String, _ value: String) {
        name.withCString { n in value.withCString { v in _ = setOptionFn(handle, n, v) } }
    }
    func command(_ handle: OpaquePointer, _ command: String) {
        command.withCString { _ = commandFn(handle, $0) }
    }
    func string(_ handle: OpaquePointer, _ name: String) -> String? {
        let pointer = name.withCString { getStringFn(handle, $0) }
        guard let pointer else { return nil }
        defer { freeFn(UnsafeMutableRawPointer(pointer)) }
        return String(cString: pointer)
    }
    func double(_ handle: OpaquePointer, _ name: String) -> Double? {
        string(handle, name).flatMap(Double.init)
    }

    private static func symbol<T>(_ library: UnsafeMutableRawPointer, _ name: String, as: T.Type) throws -> T {
        guard let symbol = dlsym(library, name) else { throw MPVError.missingSymbol(name) }
        return unsafeBitCast(symbol, to: T.self)
    }

    deinit { dlclose(library) }
}

enum MPVError: LocalizedError {
    case missingRuntime
    case missingSymbol(String)
    case initialization
    var errorDescription: String? {
        switch self {
        case .missingRuntime: "The bundled playback engine could not be loaded."
        case .missingSymbol(let name): "The playback engine is missing \(name)."
        case .initialization: "The playback engine could not be initialized."
        }
    }
}

struct MPVSurface: NSViewRepresentable {
    @ObservedObject var engine: MPVEngine
    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.black.cgColor
        DispatchQueue.main.async { engine.attach(to: view) }
        return view
    }
    func updateNSView(_ nsView: NSView, context: Context) {}
}
