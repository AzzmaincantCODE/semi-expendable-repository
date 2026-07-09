import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import {
  PackagePlus, ArrowRightLeft, ClipboardCheck, Undo2, Trash2, Search,
  Package, Clock, Filter
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

// Event types for the activity log
type ActivityEvent = {
  id: string;
  type: "stock_in" | "issued" | "transferred" | "returned" | "deleted" | "added";
  date: string;
  description: string;
  propertyNumber: string;
  reference: string;
  details: string;
  actor: string; // office or custodian involved
  amount?: number;
};

export const ActivityLog = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["activity-log"],
    queryFn: async () => {
      const allEvents: ActivityEvent[] = [];

      // 1. Inventory items added (stock-in from PO or manual add)
      const { data: inventoryItems } = await supabase
        .from("inventory_items")
        .select("id, property_number, description, total_cost, created_at, remarks, unit_cost, date_acquired")
        .order("created_at", { ascending: false })
        .limit(500);

      (inventoryItems || []).forEach(item => {
        const isFromPO = item.remarks?.includes("Stocked in from PO");
        allEvents.push({
          id: `inv-${item.id}`,
          type: isFromPO ? "stock_in" : "added",
          date: item.created_at || item.date_acquired || "",
          description: item.description || "",
          propertyNumber: item.property_number || "",
          reference: isFromPO ? (item.remarks?.match(/PO\s+(.+)/)?.[1] || "") : "",
          details: isFromPO
            ? `Stocked into inventory from ${item.remarks?.replace("Stocked in from ", "") || "PO"}`
            : "Manually added to inventory",
          actor: "",
          amount: Number(item.unit_cost || item.total_cost || 0),
        });
      });

      // 2. Custodian slip issuances (ICS)
      const { data: slipItems } = await supabase
        .from("custodian_slip_items")
        .select(`
          id, property_number, description, total_cost, created_at,
          custodian_slips!inner (
            slip_number, custodian_name, office, date_issued
          )
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      (slipItems || []).forEach(row => {
        const slip = row.custodian_slips as unknown as Record<string, unknown>;
        allEvents.push({
          id: `ics-${row.id}`,
          type: "issued",
          date: (slip.date_issued as string) || row.created_at || "",
          description: row.description || "",
          propertyNumber: row.property_number || "",
          reference: `ICS ${(slip.slip_number as string) || ""}`,
          details: `Issued to ${(slip.custodian_name as string) || "unknown"}`,
          actor: `${(slip.office as string) || ""} - ${(slip.custodian_name as string) || ""}`.replace(/^\s*-\s*/, ""),
          amount: Number(row.total_cost || 0),
        });
      });

      // 3. Property transfers (ITR)
      const { data: transfers } = await supabase
        .from("property_transfers")
        .select(`
          id, itr_number, transfer_number, date, from_custodian, to_custodian,
          from_department, to_department, status, created_at,
          transfer_items (
            id, property_number, description, quantity, inventory_item_id
          )
        `)
        .order("created_at", { ascending: false })
        .limit(300);

      (transfers || []).forEach(transfer => {
        const tItems = transfer.transfer_items as any[];
        const itrNum = transfer.itr_number || transfer.transfer_number || "Draft";
        const itrRef = itrNum;

        (tItems || []).forEach(item => {
          allEvents.push({
            id: `itr-${item.id}`,
            type: "transferred",
            date: transfer.date || transfer.created_at || "",
            description: item.description || "",
            propertyNumber: item.property_number || "",
            reference: itrRef,
            details: `Transferred from ${transfer.from_custodian || "N/A"} → ${transfer.to_custodian || "N/A"}`,
            actor: `${transfer.to_department || ""} - ${transfer.to_custodian || ""}`.replace(/^\s*-\s*/, ""),
            amount: 0,
          });
        });
      });

      // Sort all events by date descending (most recent first)
      allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return allEvents;
    },
    staleTime: 30_000,
  });

  // Filter events
  const filteredEvents = useMemo(() => {
    let result = events;

    if (typeFilter !== "all") {
      result = result.filter(e => e.type === typeFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.description.toLowerCase().includes(q) ||
        e.propertyNumber.toLowerCase().includes(q) ||
        e.reference.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q) ||
        e.details.toLowerCase().includes(q)
      );
    }

    return result;
  }, [events, typeFilter, search]);

  const getEventIcon = (type: ActivityEvent["type"]) => {
    switch (type) {
      case "stock_in": return <PackagePlus className="w-4 h-4" />;
      case "added": return <Package className="w-4 h-4" />;
      case "issued": return <ClipboardCheck className="w-4 h-4" />;
      case "transferred": return <ArrowRightLeft className="w-4 h-4" />;
      case "returned": return <Undo2 className="w-4 h-4" />;
      case "deleted": return <Trash2 className="w-4 h-4" />;
    }
  };

  const getEventBadge = (type: ActivityEvent["type"]) => {
    switch (type) {
      case "stock_in": return <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0">Stock In</Badge>;
      case "added": return <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0">Added</Badge>;
      case "issued": return <Badge className="bg-amber-600 text-white text-[10px] px-1.5 py-0">Issued</Badge>;
      case "transferred": return <Badge className="bg-purple-600 text-white text-[10px] px-1.5 py-0">Transferred</Badge>;
      case "returned": return <Badge className="bg-teal-600 text-white text-[10px] px-1.5 py-0">Returned</Badge>;
      case "deleted": return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Deleted</Badge>;
    }
  };

  const getEventColor = (type: ActivityEvent["type"]) => {
    switch (type) {
      case "stock_in": return "border-l-green-500";
      case "added": return "border-l-blue-500";
      case "issued": return "border-l-amber-500";
      case "transferred": return "border-l-purple-500";
      case "returned": return "border-l-teal-500";
      case "deleted": return "border-l-red-500";
    }
  };

  // Stats
  const stats = useMemo(() => {
    const counts = { stock_in: 0, added: 0, issued: 0, transferred: 0, returned: 0, deleted: 0 };
    events.forEach(e => { counts[e.type]++; });
    return counts;
  }, [events]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-muted-foreground">Complete timeline of all system activity — items added, issued, transferred, and more.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card 
          className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0 group"
          onClick={() => navigate("/purchase-orders")}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
              <PackagePlus className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xl font-bold text-green-700 dark:text-green-400">{stats.stock_in}</div>
              <div className="text-[10px] text-green-600/70 uppercase tracking-wider font-semibold">Stocked In</div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0 group"
          onClick={() => navigate("/inventory")}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xl font-bold text-blue-700 dark:text-blue-400">{stats.added}</div>
              <div className="text-[10px] text-blue-600/70 uppercase tracking-wider font-semibold">Manually Added</div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200 dark:border-amber-800 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0 group"
          onClick={() => navigate("/rspi")}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xl font-bold text-amber-700 dark:text-amber-400">{stats.issued}</div>
              <div className="text-[10px] text-amber-600/70 uppercase tracking-wider font-semibold">Issued (ICS)</div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0 group"
          onClick={() => navigate("/transfers")}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-purple-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xl font-bold text-purple-700 dark:text-purple-400">{stats.transferred}</div>
              <div className="text-[10px] text-purple-600/70 uppercase tracking-wider font-semibold">Transferred</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by description, property number, custodian, or reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="stock_in">Stock In</SelectItem>
              <SelectItem value="added">Manually Added</SelectItem>
              <SelectItem value="issued">Issued (ICS)</SelectItem>
              <SelectItem value="transferred">Transferred (ITR)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Timeline
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({filteredEvents.length} events)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[calc(100vh-420px)] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading activity log...</div>
            ) : filteredEvents.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {search || typeFilter !== "all" ? "No events match your filters." : "No activity found."}
              </div>
            ) : (
              <div className="divide-y">
                {filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`flex items-start gap-4 px-5 py-3 hover:bg-muted/50 transition-colors border-l-4 ${getEventColor(event.type)}`}
                  >
                    {/* Icon */}
                    <div className="mt-1 text-muted-foreground shrink-0">
                      {getEventIcon(event.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getEventBadge(event.type)}
                        <span className="font-semibold text-sm truncate">{event.description || "Unnamed Item"}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                        {event.propertyNumber && (
                          <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">{event.propertyNumber}</span>
                        )}
                        {event.reference && (
                          <span>Ref: <span className="font-medium text-foreground/80">{event.reference}</span></span>
                        )}
                        {event.actor && (
                          <span>→ <span className="font-medium text-foreground/80">{event.actor}</span></span>
                        )}
                        {event.amount ? (
                          <span>₱{event.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-muted-foreground/60 mt-0.5">{event.details}</div>
                    </div>

                    {/* Date */}
                    <div className="text-xs text-muted-foreground text-right shrink-0 whitespace-nowrap">
                      {event.date ? (
                        <>
                          <div className="font-medium">{format(new Date(event.date), "MMM dd, yyyy")}</div>
                          <div className="text-[10px]">{format(new Date(event.date), "hh:mm a")}</div>
                        </>
                      ) : (
                        <span className="italic">No date</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
