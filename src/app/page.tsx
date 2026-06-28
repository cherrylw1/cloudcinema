import { PageContainer } from "@/components/layout/PageContainer";
import { GlassPanel } from "@/components/ui/GlassPanel";

export default function Home() {
  // Rebuild trigger for deployment verification
  return (
    <PageContainer
      title="Home"
      description="Welcome to CloudCinema. This is the main dashboard."
    >
      <GlassPanel>
        <p className="text-sm text-foreground/75 leading-relaxed">
          The home feed is currently empty. Media content and dashboard feeds will appear here in future updates.
        </p>
      </GlassPanel>
    </PageContainer>
  );
}
