import { PageContainer } from "@/components/layout/PageContainer";
import { GlassPanel } from "@/components/ui/GlassPanel";

export default function AnimePage() {
  return (
    <PageContainer
      title="Anime"
      description="Browse your indexed anime collections and series."
    >
      <GlassPanel>
        <p className="text-sm text-foreground/75 leading-relaxed">
          No anime collections indexed. Group your anime titles with metadata resolvers to view them here.
        </p>
      </GlassPanel>
    </PageContainer>
  );
}
