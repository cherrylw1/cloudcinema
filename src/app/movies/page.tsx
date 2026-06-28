import { PageContainer } from "@/components/layout/PageContainer";
import { GlassPanel } from "@/components/ui/GlassPanel";

export default function MoviesPage() {
  return (
    <PageContainer
      title="Movies"
      description="Browse your personal collection of motion pictures."
    >
      <GlassPanel>
        <p className="text-sm text-foreground/75 leading-relaxed">
          No movies indexed. Add video files to your linked source folders to watch them here.
        </p>
      </GlassPanel>
    </PageContainer>
  );
}
