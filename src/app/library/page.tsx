import { PageContainer } from "@/components/layout/PageContainer";
import { GlassPanel } from "@/components/ui/GlassPanel";

export default function LibraryPage() {
  return (
    <PageContainer
      title="Library"
      description="View and manage your catalog collections."
    >
      <GlassPanel>
        <p className="text-sm text-foreground/75 leading-relaxed">
          Your personal library collections are empty. Link your cloud storage or select media directories to begin indexing.
        </p>
      </GlassPanel>
    </PageContainer>
  );
}
