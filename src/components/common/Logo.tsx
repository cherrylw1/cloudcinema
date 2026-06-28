import { Film } from "lucide-react";

export function Logo() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary text-white shadow-[0_0_15px_rgba(229,9,20,0.5)]">
        <Film className="h-5 w-5" />
      </div>
      <span className="bg-gradient-to-r from-slate-50 via-slate-200 to-slate-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">
        CloudCinema
      </span>
    </div>
  );
}
