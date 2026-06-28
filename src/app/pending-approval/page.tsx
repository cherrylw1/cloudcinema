import { PageContainer } from "@/components/layout/PageContainer";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Clock } from "lucide-react";

export default function PendingApprovalPage() {
  return (
    <PageContainer
      title="Pending Approval"
      description="Access verification in progress."
    >
      <div className="flex justify-center items-center py-12">
        <GlassPanel className="max-w-md w-full p-8 flex flex-col items-center text-center space-y-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 shadow-lg">
            <Clock className="h-6 w-6" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-50 via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Awaiting Verification
            </h2>
            <p className="text-sm text-foreground/75 leading-relaxed">
              Your account is awaiting approval. You&apos;ll get access once approved.
            </p>
          </div>

          <div className="text-xs text-foreground/45 border-t border-border pt-4 w-full">
            Please contact your system administrator to approve your profile.
          </div>
        </GlassPanel>
      </div>
    </PageContainer>
  );
}
