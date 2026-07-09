import { Loader2 } from "lucide-react";

type GlobalRefreshOverlayProps = {
  active: boolean;
};

export const GlobalRefreshOverlay = ({ active }: GlobalRefreshOverlayProps) => {
  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2 rounded-lg bg-card/80 px-6 py-4 shadow-lg ring-1 ring-border">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-foreground">Refreshing data…</p>
        <p className="text-xs text-muted-foreground">
          Please wait while the latest inventory and slip changes load.
        </p>
      </div>
    </div>
  );
};

