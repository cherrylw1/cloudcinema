import Link from "next/link";

interface MediaLoadErrorProps {
  href: string;
}

export function MediaLoadError({ href }: MediaLoadErrorProps) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-400/20 bg-red-500/10 p-6 text-center"
    >
      <h2 className="text-lg font-semibold text-foreground">Library unavailable</h2>
      <p className="mt-2 text-sm text-foreground/65">
        The library could not be loaded. Please try again.
      </p>
      <Link
        href={href}
        className="mt-4 inline-flex rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90"
      >
        Try again
      </Link>
    </div>
  );
}
