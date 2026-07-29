// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "CloudCinemaMac",
    platforms: [.macOS(.v15)],
    products: [
        .executable(name: "CloudCinema", targets: ["CloudCinema"])
    ],
    targets: [
        .target(
            name: "CMPV",
            path: "Sources/CMPV",
            publicHeadersPath: "include",
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("OpenGL"),
                .linkedLibrary("dl")
            ]
        ),
        .executableTarget(
            name: "CloudCinema",
            dependencies: ["CMPV"],
            path: "Sources/CloudCinema",
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("SwiftUI"),
                .linkedFramework("Security"),
                .linkedLibrary("dl")
            ]
        )
    ]
)
