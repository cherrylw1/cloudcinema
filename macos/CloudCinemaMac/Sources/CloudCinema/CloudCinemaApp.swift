import AppKit
import SwiftUI

@main
struct CloudCinemaApp: App {
    @StateObject private var state = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(state)
                .preferredColorScheme(.dark)
        }
        .defaultSize(width: 1280, height: 800)
        .windowStyle(.hiddenTitleBar)
        .commands {
            CommandGroup(replacing: .newItem) {}
            CommandMenu("Playback") {
                Button("Play / Pause") {}
                    .keyboardShortcut(.space, modifiers: [])
                Button("Close Player") { state.playingMedia = nil }
                    .keyboardShortcut(.escape, modifiers: [])
                    .disabled(state.playingMedia == nil)
            }
        }

        Settings {
            Form {
                LabeledContent("Server", value: "cherrycinema.netlify.app")
                LabeledContent("Playback", value: "libmpv / FFmpeg")
                Button("Sign Out", role: .destructive) { state.signOut() }
            }
            .padding(24)
            .frame(width: 420)
        }
    }
}
