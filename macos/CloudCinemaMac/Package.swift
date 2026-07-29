// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "CloudCinemaMac",
    platforms: [.macOS(.v15)],
    products: [
        .executable(name: "CloudCinema", targets: ["CloudCinema"])
    ],
    targets: [
        .executableTarget(
            name: "CloudCinema",
            path: "Sources/CloudCinema",
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("SwiftUI"),
                .linkedFramework("WebKit"),
                .linkedFramework("Security"),
                .linkedLibrary("dl")
            ]
        )
    ]
)
