export function FluidBackground() {
  return (
    <div className="fluid-background fixed inset-0 z-0 overflow-hidden pointer-events-none select-none opacity-45 dark:opacity-30 transition-opacity duration-1000">
      {/* Morphing color blobs container */}
      <div className="absolute inset-0 bg-transparent blur-[120px] saturate-[180%] transform-gpu">
        {/* Blob 1: Deep Royal Indigo */}
        <div 
          className="absolute rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-900 opacity-60 mix-blend-screen"
          style={{
            width: "55vw",
            height: "55vw",
            top: "-10%",
            left: "-10%",
            animation: "drift1 28s ease-in-out infinite alternate",
          }}
        />

        {/* Blob 2: Premium Cinema Velvet Ruby Red */}
        <div 
          className="absolute rounded-full bg-gradient-to-br from-red-600 to-rose-950 opacity-55 mix-blend-screen"
          style={{
            width: "60vw",
            height: "60vw",
            bottom: "-15%",
            right: "-10%",
            animation: "drift2 36s ease-in-out infinite alternate",
          }}
        />

        {/* Blob 3: Ambient Teal / Cyan Accent */}
        <div 
          className="absolute rounded-full bg-gradient-to-tr from-teal-600 to-cyan-900 opacity-40 mix-blend-screen"
          style={{
            width: "45vw",
            height: "45vw",
            top: "30%",
            right: "20%",
            animation: "drift3 42s ease-in-out infinite alternate",
          }}
        />
      </div>

      {/* Inject custom CSS keyframes for floating fluid animations directly */}
      <style jsx global>{`
        @keyframes drift1 {
          0% {
            transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
            border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%;
          }
          50% {
            transform: translate3d(8vw, 6vh, 0) scale(1.15) rotate(90deg);
            border-radius: 70% 30% 52% 48% / 60% 40% 60% 40%;
          }
          100% {
            transform: translate3d(-4vw, 12vh, 0) scale(0.9) rotate(180deg);
            border-radius: 30% 70% 40% 60% / 50% 60% 40% 50%;
          }
        }

        @keyframes drift2 {
          0% {
            transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
            border-radius: 50% 50% 30% 70% / 50% 60% 40% 50%;
          }
          50% {
            transform: translate3d(-10vw, -8vh, 0) scale(1.2) rotate(-120deg);
            border-radius: 40% 60% 60% 40% / 40% 50% 50% 60%;
          }
          100% {
            transform: translate3d(5vw, -4vh, 0) scale(0.95) rotate(-240deg);
            border-radius: 60% 40% 50% 50% / 50% 30% 70% 50%;
          }
        }

        @keyframes drift3 {
          0% {
            transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
            border-radius: 60% 40% 50% 50% / 50% 30% 70% 50%;
          }
          50% {
            transform: translate3d(12vw, -12vh, 0) scale(1.1) rotate(180deg);
            border-radius: 45% 55% 40% 60% / 60% 40% 60% 40%;
          }
          100% {
            transform: translate3d(-6vw, 4vh, 0) scale(0.85) rotate(360deg);
            border-radius: 50% 50% 30% 70% / 50% 60% 40% 50%;
          }
        }
      `}</style>
    </div>
  );
}
