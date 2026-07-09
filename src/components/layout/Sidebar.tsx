import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  FileText,
  ClipboardList,
  ArrowRightLeft,
  AlertTriangle,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Users,
  FileSpreadsheet,
  BookOpen,
  Clock,
  RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfflineModeToggle } from "@/offline/OfflineModeToggle";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Purchase Orders", href: "/purchase-orders", icon: ClipboardList, step: 1, tooltip: "Step 1: Receive" },
  { name: "Property Cards", href: "/property-cards", icon: FileText, step: 2, tooltip: "Step 2: Record" },
  { name: "Custodian Slips", href: "/custodian-slips", icon: ClipboardList, step: 3, tooltip: "Step 3: Issue" },
  { name: "RSPI Reports", href: "/rspi", icon: FileSpreadsheet, step: 4, tooltip: "Step 4: Report" },
  { name: "Transfers", href: "/transfers", icon: ArrowRightLeft, step: 5, tooltip: "Step 5: Transfer" },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "Custodians", href: "/custodians", icon: Users },
  { name: "Registry", href: "/registry", icon: BookOpen },
  { name: "Returns", href: "/returns", icon: RotateCcw, step: 6, tooltip: "Step 6: Return" },
  { name: "Activity Log", href: "/activity-log", icon: Clock },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Lookups", href: "/settings/lookups", icon: Settings },
];

export const Sidebar = ({ className }: { className?: string }) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div
      className={cn(
        "bg-card border-r border-border transition-all duration-300 flex flex-col print:hidden",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
        {!collapsed && <div className="font-semibold text-sm tracking-wide text-muted-foreground uppercase ml-2">Main Menu</div>}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("shrink-0", collapsed ? "mx-auto" : "")}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;

          return (
            <Link
              key={item.name}
              to={item.href}
              title={item.tooltip || item.name}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors w-full group",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
              )}
            >
              <div className="relative shrink-0">
                <Icon className="h-5 w-5" />
                {collapsed && item.step && (
                  <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-3.5 h-3.5 text-[8px] font-bold rounded-full bg-blue-500 text-white border-2 border-card">
                    {item.step}
                  </span>
                )}
              </div>
              
              {!collapsed && (
                <div className="flex flex-1 items-center justify-between overflow-hidden">
                  <span className="text-sm font-medium truncate">{item.name}</span>
                  {item.step && (
                    <span 
                      className={cn(
                        "flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full shrink-0 ml-2 shadow-sm",
                        isActive 
                          ? "bg-primary-foreground text-primary" 
                          : "bg-blue-100 text-blue-800 border border-blue-200 group-hover:bg-blue-200"
                      )}
                    >
                      {item.step}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* OFFLINE EXPERIMENT — toggle at bottom of sidebar */}
      <OfflineModeToggle collapsed={collapsed} />
    </div>
  );
};
