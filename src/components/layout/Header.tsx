import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Monitor, LogOut, Search, Download, Loader2, RefreshCw } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme/ThemeProvider";
import { supabase } from "@/lib/supabase";
import { QuickSearch } from "@/components/QuickSearch";
import { NotificationsMenu } from "@/components/notifications/NotificationsMenu";
import { NetworkStatus } from "@/components/layout/NetworkStatus";
import pamdIcon from "@/assets/pamd-icon.png";
import {
  exportInventoryToExcel, exportICSToExcel, exportPropertyCardsToExcel,
  exportTransfersToExcel, exportPurchaseOrdersToExcel, exportPhysicalCountToExcel,
  exportLossReportsToExcel, exportRegistryToExcel, exportReturnsToExcel,
  exportRSPIToExcel, exportFullBackupToExcel, setLastExported
} from "@/utils/excelExport";
import { useToast } from "@/hooks/use-toast";

export const Header = () => {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [searchOpen, setSearchOpen] = useState(false);
  const [backupLoading, setBackupLoading] = useState<string | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const EXPORTS = [
    { key: 'inventory',     label: '📦 Inventory',          fn: exportInventoryToExcel },
    { key: 'ics',           label: '📋 ICS / Custodian Slips', fn: exportICSToExcel },
    { key: 'propertyCards', label: '📑 Property Cards',     fn: exportPropertyCardsToExcel },
    { key: 'transfers',     label: '🔄 Transfers (ITR)',    fn: exportTransfersToExcel },
    { key: 'purchaseOrders',label: '🛒 Purchase Orders',    fn: exportPurchaseOrdersToExcel },
    { key: 'physicalCount', label: '🔢 Physical Count',     fn: exportPhysicalCountToExcel },
    { key: 'lossReports',   label: '⚠️ Loss Reports',      fn: exportLossReportsToExcel },
    { key: 'registry',      label: '📓 Registry',           fn: exportRegistryToExcel },
    { key: 'returns',       label: '↩️ Returns (RRSP)',     fn: exportReturnsToExcel },
    { key: 'rspi',          label: '📊 RSPI Reports',       fn: exportRSPIToExcel },
  ] as const;

  const handleExport = async (key: string, fn: () => Promise<any>) => {
    setBackupLoading(key);
    try {
      await fn();
      setLastExported(key as any);
      toast({ title: '✅ Download started', description: 'Excel file saved to your Downloads folder.' });
    } catch (e: any) {
      toast({ title: 'Export failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setBackupLoading(null);
    }
  };

  const handleFullBackup = async () => {
    setBackupLoading('full');
    try {
      await exportFullBackupToExcel();
      setLastExported('fullBackup');
      toast({ title: '✅ Full backup downloaded', description: 'All data exported to one Excel file.' });
    } catch (e: any) {
      toast({ title: 'Export failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setBackupLoading(null);
    }
  };

  // Keyboard shortcut for search (Ctrl+K or Cmd+K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <header className="bg-government-dark text-white shadow-formal print:hidden sticky top-0 z-50 w-full">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <img src={pamdIcon} alt="PAMD" className="h-10 w-10 rounded-full object-cover" />
              <div>
                <h1 className="text-xl font-bold">Semi-Expendable Property</h1>
                <p className="text-sm text-white/80">Property & Asset Management Division</p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 md:space-x-3">
            {/* Network Latency Indicator */}
            <NetworkStatus />

            {/* Refresh Button */}
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 flex items-center gap-2"
              onClick={handleRefresh}
              title="Refresh Data"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="text-sm hidden sm:inline">Refresh</span>
            </Button>

            {/* Quick Search Button */}
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 flex items-center gap-2"
              onClick={() => setSearchOpen(true)}
              title="Quick Search (Ctrl+K / Cmd+K)"
            >
              <Search className="h-4 w-4" />
              <span className="text-sm hidden sm:inline">Search</span>
              <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-white/30 bg-white/20 px-1.5 font-mono text-[10px] font-medium text-white opacity-100 md:flex">
                <span className="text-xs">{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</span>K
              </kbd>
            </Button>

            {/* Backup / Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 flex items-center gap-2"
                  title="Download Excel Backup"
                  disabled={backupLoading !== null}
                >
                  {backupLoading !== null ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span className="text-sm hidden sm:inline">Backup</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Download Excel Backup</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXPORTS.map(({ key, label, fn }) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => handleExport(key, fn)}
                    disabled={backupLoading !== null}
                    className="cursor-pointer"
                  >
                    {backupLoading === key ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                    {label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleFullBackup}
                  disabled={backupLoading !== null}
                  className="cursor-pointer font-semibold text-primary"
                >
                  {backupLoading === 'full' ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Download className="h-3 w-3 mr-2" />}
                  💾 Full Backup (All Data)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notifications */}
            <NotificationsMenu />

            {/* Theme Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                  {theme === "light" ? (
                    <Sun className="h-4 w-4" />
                  ) : theme === "dark" ? (
                    <Moon className="h-4 w-4" />
                  ) : (
                    <Monitor className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Theme</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <Sun className="mr-2 h-4 w-4" />
                  <span>Light</span>
                  {theme === "light" && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <Moon className="mr-2 h-4 w-4" />
                  <span>Dark</span>
                  {theme === "dark" && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <Monitor className="mr-2 h-4 w-4" />
                  <span>System</span>
                  {theme === "system" && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Logout Button */}
            <Button
              variant="outline"
              size="sm"
              className="bg-transparent text-white border-white/30 hover:bg-white/10 hover:text-white"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
      <QuickSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
};