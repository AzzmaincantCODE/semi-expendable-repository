import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, ShieldAlert, Upload, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  parseSnapshotFiles, restorableTables, restoreSnapshot,
  type ParsedSnapshot, type RestoreResult,
} from "@/services/restoreService";

const CONFIRM_PHRASE = "RESTORE";

export function Settings() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [snapshot, setSnapshot] = useState<ParsedSnapshot | null>(null);
  const [folderName, setFolderName] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [running, setRunning] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [currentTable, setCurrentTable] = useState("");
  const [result, setResult] = useState<RestoreResult | null>(null);

  const handleFolderPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    // derive the folder name from the first file's relative path
    const rel = (files[0] as any).webkitRelativePath as string | undefined;
    setFolderName(rel ? rel.split("/")[0] : "selected files");
    setResult(null);

    const snap = await parseSnapshotFiles(files);
    if (Object.keys(snap.tables).length === 0) {
      toast({
        title: "No data files found",
        description: "That folder has no table .json files. Pick a mirror 'current' or an archive folder.",
        variant: "destructive",
      });
      setSnapshot(null);
      return;
    }
    setSnapshot(snap);
    if (snap.errors.length) {
      toast({
        title: `${snap.errors.length} file(s) could not be read`,
        description: snap.errors.map((x) => x.file).join(", "),
        variant: "destructive",
      });
    }
  };

  const doRestore = async () => {
    if (!snapshot) return;
    setConfirmOpen(false);
    setRunning(true);
    setResult(null);
    setProgressPct(0);

    const tables = restorableTables(snapshot);
    const totalTables = Math.max(tables.length, 1);
    let done = 0;

    try {
      const res = await restoreSnapshot(snapshot, (p) => {
        if (p.status === "ok" || p.status === "skipped") {
          done += 1;
          setProgressPct(Math.round((done / totalTables) * 100));
        }
        setCurrentTable(p.table);
      });
      setResult(res);
      setProgressPct(100);
      if (res.failed.length === 0) {
        toast({
          title: "Restore complete",
          description: `${res.restored.length} tables restored, ${res.skipped.length} skipped.`,
        });
      } else {
        toast({
          title: "Restore finished with errors",
          description: `${res.failed.length} table(s) failed — see the report below.`,
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Restore failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setRunning(false);
      setCurrentTable("");
      setConfirmText("");
    }
  };

  const preview = snapshot ? restorableTables(snapshot) : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">System configuration and maintenance.</p>
      </div>

      {/* DANGER ZONE ------------------------------------------------------- */}
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </div>
          <CardDescription>
            Restore the database from a local backup or mirror folder. These
            actions change live data for everyone and cannot be automatically undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Why this is risky */}
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm space-y-2">
            <div className="flex items-center gap-2 font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" /> Why this is risky
            </div>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong>It overwrites live data.</strong> Records with matching IDs in the backup replace what's in the database now.</li>
              <li><strong>Everyone is affected.</strong> This writes to the shared online database, not just your screen — all users see the result.</li>
              <li><strong>It can't be auto-undone.</strong> There is no "undo" button. Your safety net is that a fresh mirror runs every 20 minutes, so take a manual mirror first if in doubt.</li>
              <li><strong>Stale backups move data backwards.</strong> Restoring an old folder reintroduces records that were later deleted or edited.</li>
              <li><strong>Use the newest folder</strong> (<code>SemiPropertyMirror\current</code>) unless you are deliberately rolling back to a specific date.</li>
            </ul>
            <p className="text-muted-foreground">
              This restore runs through your logged-in account, so it can only do
              what you're already allowed to do. It merges data (safe upsert); it
              does not delete rows that aren't in the backup. For a full wipe-and-clone,
              use the <code>npm run restore -- &lt;folder&gt; --apply --wipe</code> command
              (see BACKUP-AND-RESTORE.md).
            </p>
          </div>

          {/* Step 1: pick folder */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Step 1 — Choose a backup folder</label>
            <input
              ref={fileInputRef}
              type="file"
              // @ts-expect-error non-standard but supported in Chromium/Electron
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={handleFolderPicked}
            />
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={running}>
                <Upload className="h-4 w-4 mr-2" /> Select folder…
              </Button>
              {folderName && <Badge variant="secondary">{folderName}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              Pick <code>Documents\SemiPropertyMirror\current</code> for the latest data,
              or an <code>archives\YYYY-MM-DD</code> folder for a specific day.
            </p>
          </div>

          {/* Step 2: preview */}
          {snapshot && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Step 2 — Review what will be restored</label>
              {snapshot.manifest?.finishedAt && (
                <p className="text-xs text-muted-foreground">
                  Snapshot taken: {new Date(snapshot.manifest.finishedAt).toLocaleString()}
                </p>
              )}
              <div className="max-h-56 overflow-y-auto rounded-md border text-sm">
                <table className="w-full">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium">Table</th>
                      <th className="text-right p-2 font-medium">Rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((t) => (
                      <tr key={t.table} className="border-t">
                        <td className="p-2 font-mono text-xs">{t.table}</td>
                        <td className="p-2 text-right">{t.rows}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted-foreground">
                Total: <strong>{preview.reduce((s, t) => s + t.rows, 0)}</strong> rows across{" "}
                <strong>{preview.length}</strong> tables.
              </p>
            </div>
          )}

          {/* Step 3: run */}
          {snapshot && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Step 3 — Restore</label>
              <div>
                <Button
                  variant="destructive"
                  disabled={running}
                  onClick={() => setConfirmOpen(true)}
                >
                  {running ? "Restoring…" : "Restore this data"}
                </Button>
              </div>
            </div>
          )}

          {/* progress */}
          {running && (
            <div className="space-y-1">
              <Progress value={progressPct} />
              <p className="text-xs text-muted-foreground">
                {progressPct}% {currentTable && `— ${currentTable}`}
              </p>
            </div>
          )}

          {/* result report */}
          {result && (
            <div className="rounded-md border p-4 text-sm space-y-2">
              <div className="flex items-center gap-2 font-medium">
                {result.failed.length === 0
                  ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                  : <XCircle className="h-4 w-4 text-destructive" />}
                Restore report
              </div>
              <p className="text-muted-foreground">
                Restored <strong>{result.restored.length}</strong> tables
                ({result.restored.reduce((s, r) => s + r.rows, 0)} rows),
                skipped <strong>{result.skipped.length}</strong> (empty/views).
              </p>
              {result.failed.length > 0 && (
                <div className="text-destructive">
                  <p className="font-medium">Failed:</p>
                  <ul className="list-disc pl-5">
                    {result.failed.map((f) => (
                      <li key={f.table}><span className="font-mono">{f.table}</span>: {f.error}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-muted-foreground">Verify by opening a few records in the app.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* typed confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Confirm database restore
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You're about to write <strong>{preview.reduce((s, t) => s + t.rows, 0)} rows</strong> from{" "}
                  <strong>{folderName}</strong> into the live database. Existing records with
                  matching IDs will be overwritten for <strong>all users</strong>. This cannot be auto-undone.
                </p>
                <p>Type <strong>{CONFIRM_PHRASE}</strong> to proceed:</p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_PHRASE}
                  autoFocus
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText !== CONFIRM_PHRASE}
              onClick={doRestore}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Restore now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default Settings;
