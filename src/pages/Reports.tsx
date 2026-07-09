import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export const Reports = () => {
  const navigate = useNavigate();

  const { data: acquisitionsByYear = [] } = useQuery({
    queryKey: ["inventory-acquisitions-by-year"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_items").select("total_cost, date_acquired, created_at");
      if (error) throw error;
      
      const yearMap = new Map<number, { year: number; items_count: number; total_value: number }>();
      (data || []).forEach(item => {
        const dateStr = item.date_acquired || item.created_at;
        if (!dateStr) return;
        const year = new Date(dateStr).getFullYear();
        if (isNaN(year)) return;
        
        const existing = yearMap.get(year) || { year, items_count: 0, total_value: 0 };
        existing.items_count += 1;
        existing.total_value += Number(item.total_cost || 0);
        yearMap.set(year, existing);
      });
      
      return Array.from(yearMap.values()).sort((a, b) => b.year - a.year);
    },
    staleTime: 60_000,
  });

  const { data: expiringSoon = [] } = useQuery({
    queryKey: ["inventory-lifecycle-expiring"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, property_number, description, warranty_end_date, estimated_useful_life")
        .not("warranty_end_date", "is", null); // basic filter to reduce payload

      if (error && error.code !== "PGRST116") {
         // fallback to full scan if the column is missing/strict
         const { data: fallback, error: fallbackErr } = await supabase.from("inventory_items").select("id, property_number, description, warranty_end_date, estimated_useful_life");
         if (fallbackErr) throw fallbackErr;
         var allItems = fallback || [];
      } else {
         var allItems = data || [];
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const in60 = new Date(today);
      in60.setDate(in60.getDate() + 60);

      const expiring: any[] = [];
      allItems.forEach((row: any) => {
        let wStatus = null;
        if (row.warranty_end_date) {
          const w = new Date(row.warranty_end_date + "T00:00:00");
          if (w < today) wStatus = "Expired";
          else if (w <= in60) wStatus = "Expiring Soon";
        }
        
        let lStatus = null;
        if (row.estimated_useful_life) { // Date or string containing date
            const l = new Date(row.estimated_useful_life + "T00:00:00");
            if (!isNaN(l.getTime())) {
                if (l < today) lStatus = "Ended";
                else if (l <= in60) lStatus = "Ending Soon";
            }
        }

        if (wStatus === "Expiring Soon" || lStatus === "Ending Soon") {
          expiring.push({
            id: row.id,
            property_number: row.property_number,
            description: row.description,
            warranty_end_date: row.warranty_end_date,
            warranty_status: wStatus,
            lifespan_end_date: isNaN(new Date(row.estimated_useful_life).getTime()) ? null : row.estimated_useful_life,
            lifespan_status: lStatus
          });
        }
      });
      
      return expiring.sort((a, b) => {
         const tA = new Date(a.warranty_end_date || a.lifespan_end_date || "2099-01-01").getTime();
         const tB = new Date(b.warranty_end_date || b.lifespan_end_date || "2099-01-01").getTime();
         return tA - tB;
      }).slice(0, 20);
    },
    staleTime: 30_000,
  });

  const topYears = useMemo(() => acquisitionsByYear.slice(0, 6), [acquisitionsByYear]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
      </div>

      {/* Search Summary Report - assigned items only */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Summary Report
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Search for assigned (custodied) inventory items and generate a printable summary report. Uses its own search area; only items currently assigned to custodians are included.
          </p>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate("/reports/search-summary")} variant="outline" className="gap-2">
            <Search className="h-4 w-4" />
            Open Summary Search Report
          </Button>
        </CardContent>
      </Card>

      {/* Warranty / Lifespan Monitoring */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <span>Warranty & Lifespan Monitoring</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expiringSoon.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No items currently expiring within the next 60 days (based on `warranty_end_date` / `lifespan_end_date`).
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Showing up to 20 items that are expiring soon.
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3">Property No.</th>
                      <th className="text-left py-2 pr-3">Description</th>
                      <th className="text-left py-2 pr-3">Warranty</th>
                      <th className="text-left py-2 pr-3">Lifespan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiringSoon.map((row) => (
                      <tr key={row.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-3 font-mono">{row.property_number}</td>
                        <td className="py-2 pr-3">{row.description || "-"}</td>
                        <td className="py-2 pr-3">
                          {row.warranty_status ? (
                            <Badge variant={row.warranty_status === "Expiring Soon" ? ("secondary" as any) : ("outline" as any)}>
                              {row.warranty_status} {row.warranty_end_date ? `(${row.warranty_end_date})` : ""}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {row.lifespan_status ? (
                            <Badge variant={row.lifespan_status === "Ending Soon" ? ("secondary" as any) : ("outline" as any)}>
                              {row.lifespan_status} {row.lifespan_end_date ? `(${row.lifespan_end_date})` : ""}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Yearly Acquisitions */}
      <Card>
        <CardHeader>
          <CardTitle>Yearly Acquisitions Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {topYears.length === 0 ? (
            <div className="text-sm text-muted-foreground">No acquisitions data yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-3">Year</th>
                    <th className="text-left py-2 pr-3">Items</th>
                    <th className="text-left py-2 pr-3">Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {topYears.map((row) => (
                    <tr key={row.year} className="border-b last:border-b-0">
                      <td className="py-2 pr-3 font-medium">{row.year}</td>
                      <td className="py-2 pr-3">{row.items_count}</td>
                      <td className="py-2 pr-3">₱{Number(row.total_value || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};