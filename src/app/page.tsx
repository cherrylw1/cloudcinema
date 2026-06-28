import { PageContainer } from "@/components/layout/PageContainer";
import { GlassPanel } from "@/components/ui/GlassPanel";

export default function Home() {
  return (
    <PageContainer
      title="Home"
      description="Welcome to CloudCinema. This is the main dashboard."
    >
      <GlassPanel>
        <p className="text-sm text-foreground/75 leading-relaxed">
          Deployment test — Sun Jun 28 2026 10:54:09
        </p>
      </GlassPanel>
    </PageContainer>
  );
}
