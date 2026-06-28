import { PageContainer } from "@/components/layout/PageContainer";
import { GlassPanel } from "@/components/ui/GlassPanel";

export default function TVShowsPage() {
  return (
    <PageContainer
      title="TV Shows"
      description="Browse your personal series and television episodes."
    >
      <GlassPanel>
        <p className="text-sm text-foreground/75 leading-relaxed">
          No TV shows indexed. Organize your media folders by series name to watch episodes here.
        </p>
      </GlassPanel>
    </PageContainer>
  );
}
