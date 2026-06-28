import { PageContainer } from "@/components/layout/PageContainer";
import { GlassPanel } from "@/components/ui/GlassPanel";

export default function SettingsPage() {
  return (
    <PageContainer
      title="Settings"
      description="Manage your account, libraries, and application preferences."
    >
      <GlassPanel>
        <p className="text-sm text-foreground/75 leading-relaxed">
          Application configuration parameters and preferences will be available in future phases.
        </p>
      </GlassPanel>
    </PageContainer>
  );
}
