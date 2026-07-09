import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { simpleInventoryService } from "@/services/simpleInventoryService";
import { format, differenceInDays, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";

export function WarrantiesTab() {
  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['inventory-items-warranties'],
    queryFn: async () => {
      const response = await simpleInventoryService.getAll({});
      return response.success ? response.data : [];
    }
  });

  const itemsWithWarranty = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allItems
      .filter((i) => i.warrantyEndDate || i.lifespanEndDate)
      .map((item) => {
        const parseDate = (d?: string) => (d ? parseISO(d) : null);
        const w = parseDate(item.warrantyEndDate);
        const l = parseDate(item.lifespanEndDate);
        const warrantyDays = w ? differenceInDays(w, today) : null;
        const lifespanDays = l ? differenceInDays(l, today) : null;
        const warrantyStatus = warrantyDays === null ? null : warrantyDays < 0 ? "Expired" : warrantyDays <= 60 ? "Expiring" : "Active";
        const lifespanStatus = lifespanDays === null ? null : lifespanDays < 0 ? "Ended" : lifespanDays <= 60 ? "Ending" : "Active";
        return {
          ...item,
          warrantyDays,
          lifespanDays,
          warrantyStatus,
          lifespanStatus,
        };
      })
      .sort((a, b) => {
        const aDays = Math.min(a.warrantyDays ?? Infinity, a.lifespanDays ?? Infinity);
        const bDays = Math.min(b.warrantyDays ?? Infinity, b.lifespanDays ?? Infinity);
        return aDays - bDays;
      });
  }, [allItems]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Item Warranties & Lifespan
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Items with warranty or lifespan dates
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Property #</TableHead>
                <TableHead className="whitespace-nowrap">Description</TableHead>
                <TableHead className="whitespace-nowrap">Warranty</TableHead>
                <TableHead className="whitespace-nowrap">Lifespan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Loading warranties...
                  </TableCell>
                </TableRow>
              ) : itemsWithWarranty.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No items with warranty or lifespan dates.
                  </TableCell>
                </TableRow>
              ) : (
                itemsWithWarranty.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {item.propertyNumber}
                    </TableCell>
                    <TableCell className="max-w-[400px] truncate" title={item.description}>
                      {item.description}
                    </TableCell>
                    <TableCell>
                      {item.warrantyEndDate ? (
                        <div className="space-y-1">
                          <span className="text-sm block">{format(parseISO(item.warrantyEndDate), "MMM d, yyyy")}</span>
                          {item.warrantyStatus && (
                            <Badge
                              className={
                                item.warrantyStatus === "Expired"
                                  ? "bg-red-100 text-red-800"
                                  : item.warrantyStatus === "Expiring"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-green-100 text-green-800"
                              }
                            >
                              {item.warrantyStatus === "Expired"
                                ? "Expired"
                                : item.warrantyDays !== null
                                  ? `${item.warrantyDays}d left`
                                  : "Active"}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.lifespanEndDate ? (
                        <div className="space-y-1">
                          <span className="text-sm block">{format(parseISO(item.lifespanEndDate), "MMM d, yyyy")}</span>
                          {item.lifespanStatus && (
                            <Badge
                              className={
                                item.lifespanStatus === "Ended"
                                  ? "bg-red-100 text-red-800"
                                  : item.lifespanStatus === "Ending"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-green-100 text-green-800"
                              }
                            >
                              {item.lifespanStatus === "Ended"
                                ? "Ended"
                                : item.lifespanDays !== null
                                  ? `${item.lifespanDays}d left`
                                  : "Active"}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
