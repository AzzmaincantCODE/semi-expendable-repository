import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NetworkStatus } from "@/components/ui/network-status";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { localforagePersister, DEFAULT_GC_TIME_MS, DEFAULT_STALE_TIME_MS, PERSIST_MAX_AGE_MS } from "@/lib/queryPersistence";
import { processOfflineQueue } from "@/lib/offlineQueue";
import { propertyCardService } from "@/services/propertyCardService";
import { simpleInventoryService } from "@/services/simpleInventoryService";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { MobileDesktopTip } from "@/components/ui/MobileDesktopTip";
import { GlobalRealtimeSyncProvider } from "@/providers/GlobalRealtimeSyncProvider";
import { Dashboard } from "@/pages/Dashboard";
import { Inventory } from "@/pages/Inventory";
import { PropertyCards } from "@/pages/PropertyCards";
import { PropertyCardsAnnex } from "@/pages/PropertyCardsAnnex";
import { CustodianSlipsAnnex } from "@/pages/CustodianSlipsAnnex";
import Custodians from "@/pages/Custodians";
import { ReturnsAnnex } from "@/pages/ReturnsAnnex";
import { ReturnsPrint } from "@/pages/ReturnsPrint";
import { Transfers } from "@/pages/Transfers";
import { PhysicalCount } from "@/pages/PhysicalCount";
import { LossReports } from "@/pages/LossReports";
import { Reports } from "@/pages/Reports";
import { PersonnelReport } from "@/pages/PersonnelReport";
import { SearchSummaryReport } from "@/pages/SearchSummaryReport";
import { RSPIAnnex } from "@/pages/RSPIAnnex";
import { Registry } from "@/pages/Registry";
import { PurchaseOrders } from "@/pages/PurchaseOrders";
import { ActivityLog } from "@/pages/ActivityLog";
import { PurchaseOrderPrint } from "@/components/procurement/PurchaseOrderPrint";
import { IARPrint } from "@/components/procurement/IARPrint";
import { WeeklyPropertyReportPrint } from "@/components/reports/WeeklyPropertyReportPrint";
import Debug from "@/pages/Debug";
import Lookups from "@/pages/Lookups";
import Login from "@/pages/Login";
import NotFound from "./pages/NotFound";
import React from "react";
import { supabase } from "@/lib/supabase";
import { DataModeProvider } from "@/offline/dataModeContext";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Clock, RotateCcw } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: DEFAULT_STALE_TIME_MS, gcTime: DEFAULT_GC_TIME_MS, retry: 1, refetchOnReconnect: true, refetchOnWindowFocus: true },
    mutations: { retry: 1 },
  },
});

persistQueryClient({
  queryClient,
  persister: localforagePersister,
  maxAge: PERSIST_MAX_AGE_MS,
  buster: 'v1',
  dehydrateOptions: { shouldDehydrateMutation: () => false },
});

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = React.useState<boolean | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setIsLoggedIn(!!data.session);
    };
    checkAuth();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => { checkAuth(); });
    return () => authListener?.subscription?.unsubscribe?.();
  }, []);

  if (isLoggedIn === null) return null;

  return (
    <DataModeProvider>
    <ThemeProvider defaultTheme="system" storageKey="semi-property-theme">
      <QueryClientProvider client={queryClient}>
        <GlobalRealtimeSyncProvider>
          <TooltipProvider>
            <Toaster /><Sonner />
            <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <div className={isLoggedIn ? "h-screen flex flex-col overflow-hidden bg-background print:h-auto print:overflow-visible" : "min-h-screen bg-background"}>
                {isLoggedIn && (
                  <>
                    <Header />
                    <div className="lg:hidden bg-background/80 backdrop-blur-sm p-4 border-b print:hidden shrink-0">
                      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                        <SheetTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Menu className="h-4 w-4" />
                            <span className="ml-2">Menu</span>
                          </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="p-0 w-64">
                          <Sidebar className="h-full" />
                        </SheetContent>
                      </Sheet>
                    </div>
                    <div className="print:hidden shrink-0">
                      <NetworkStatus />
                    </div>
                    <div className="print:hidden shrink-0">
                      <MobileDesktopTip />
                    </div>
                  </>
                )}
                <div className={isLoggedIn ? "flex-1 flex overflow-hidden print:block print:overflow-visible" : "flex"}>
                  {isLoggedIn && (
                    <Sidebar className="hidden lg:flex h-full shrink-0" />
                  )}
                  <main className={isLoggedIn ? "flex-1 overflow-y-auto p-6 print:p-0 print:overflow-visible" : "w-full"}>
                    <Routes>
                      {isLoggedIn ? (
                        <>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/login" element={<Navigate to="/" replace />} />
                          <Route path="/inventory" element={<Inventory />} />
                          <Route path="/purchase-orders" element={<PurchaseOrders />} />
                          <Route path="/purchase-orders/:id/print" element={<PurchaseOrderPrint />} />
                          <Route path="/iar/:id/print" element={<IARPrint />} />
                          <Route path="/property-cards" element={<PropertyCardsAnnex />} />
                          <Route path="/custodian-slips" element={<CustodianSlipsAnnex />} />
                          <Route path="/custodians" element={<Custodians />} />
                          <Route path="/transfers" element={<Transfers />} />
                          <Route path="/physical-count" element={<PhysicalCount />} />
                          <Route path="/loss-reports" element={<LossReports />} />
                          <Route path="/reports" element={<Reports />} />
                          <Route path="/reports/personnel" element={<PersonnelReport />} />
                          <Route path="/reports/search-summary" element={<SearchSummaryReport />} />
                          <Route path="/rspi" element={<RSPIAnnex />} />
                          <Route path="/rspi/:id" element={<WeeklyPropertyReportPrint />} />
                          <Route path="/registry" element={<Registry />} />
                          <Route path="/returns" element={<ReturnsAnnex />} />
                          <Route path="/returns/:id/print" element={<ReturnsPrint />} />
                          <Route path="/activity-log" element={<ActivityLog />} />
                          <Route path="/debug" element={<Debug />} />
                          <Route path="/settings/lookups" element={<Lookups />} />
                          <Route path="*" element={<NotFound />} />
                        </>
                      ) : (
                        <>
                          <Route path="/login" element={<Login />} />
                          <Route path="/" element={<Navigate to="/login" replace />} />
                          <Route path="*" element={<Navigate to="/login" replace />} />
                        </>
                      )}
                    </Routes>
                  </main>
                </div>
              </div>
            </HashRouter>
          </TooltipProvider>
        </GlobalRealtimeSyncProvider>
      </QueryClientProvider>
    </ThemeProvider>
    </DataModeProvider>
  );
};

export default App;

window.addEventListener("online", () => {
  processOfflineQueue({
    "propertyCards.create": async (d) => { await propertyCardService.create(d.card); },
    "propertyCards.update": async (d) => { await propertyCardService.update(d.id, d.updates); },
    "propertyCards.delete": async (d) => { await propertyCardService.delete(d.id); },
    "propertyCards.addEntry": async (d) => { await propertyCardService.addEntry(d.propertyCardId, d.entry); },
    "propertyCards.updateEntry": async (d) => { await propertyCardService.updateEntry(d.propertyCardId, d.entryId, d.updates); },
    "propertyCards.deleteEntry": async (d) => { await propertyCardService.deleteEntry(d.propertyCardId, d.entryId); },
    "inventory.create": async (d) => { await simpleInventoryService.create(d.item); },
    "inventory.update": async (d) => { await simpleInventoryService.update(d.id, d.updates); },
    "inventory.delete": async (d) => { await simpleInventoryService.delete(d.id); },
  }).then(({ processed, failed }) => { if (processed || failed) console.log(`[offline-queue] processed=${processed} failed=${failed}`); });
});
