export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading page">
      <div className="h-8 w-36 rounded-lg bg-white/[0.06]" />
      <div className="h-4 w-64 rounded bg-white/[0.04]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {Array.from({ length: 12 }, (_, index) => (
          <div
            key={index}
            className="aspect-[2/3] rounded-2xl border border-white/[0.06] bg-white/[0.035]"
          />
        ))}
      </div>
    </div>
  );
}
