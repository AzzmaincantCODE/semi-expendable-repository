import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface POHistoryDialogProps {
    poId: string;
    poNumber: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function POHistoryDialog({ poId, poNumber, isOpen, onOpenChange }: POHistoryDialogProps) {
    // Fetch all inventory items related to this PO along with their custodian assignments
    const { data: historyItems, isLoading } = useQuery({
        queryKey: ['po-history', poId],
        queryFn: async () => {
            // 1. Get all PO items to find which inventory IDs they are linked to
            // Also fetch the original PO item description
            const { data: poItems, error: poError } = await supabase
                .from('purchase_order_items')
                .select('id, description, inventory_item_ids')
                .eq('po_id', poId);

            if (poError) throw poError;

            // Collect all inventory IDs and create a map to easily find the PO item description
            const allInventoryIds: string[] = [];
            const inventoryToPoDescMap: Record<string, string> = {};

            poItems?.forEach(poItem => {
                const ids = poItem.inventory_item_ids || [];
                ids.forEach((invId: string) => {
                    allInventoryIds.push(invId);
                    inventoryToPoDescMap[invId] = poItem.description;
                });
            });

            if (allInventoryIds.length === 0) return [];

            // 2. Fetch the actual inventory items
            const { data: items, error } = await supabase
                .from('inventory_items')
                .select(`
                    id,
                    property_number,
                    description,
                    status,
                    created_at
                `)
                .in('id', allInventoryIds)
                .order('created_at', { ascending: true });

            if (error) throw error;
            if (!items || items.length === 0) return [];

            // 3. Get property numbers to look up assignments
            const propertyNumbers = items
                .map(item => item.property_number)
                .filter(Boolean) as string[];

            if (propertyNumbers.length === 0) {
                // Return items with original PO description attached even if no assignments
                return items.map(item => ({
                    ...item,
                    original_po_description: inventoryToPoDescMap[item.id] || null,
                    custodian_slips: []
                }));
            }

            // 4. Fetch assignments based on property_number
            const { data: assignments, error: assignError } = await supabase
                .from('custodian_slip_items')
                .select(`
                    property_number,
                    custodian_slips (
                        id,
                        slip_number,
                        issued_by,
                        received_by,
                        custodian_name,
                        date_issued,
                        office,
                        designation
                    )
                `)
                .in('property_number', propertyNumbers);

            if (assignError) throw assignError;

            // 5. Attach assignments and original description to their respective items
            return items.map(item => {
                const itemAssignments = assignments
                    ?.filter(a => a.property_number === item.property_number)
                    ?.map(a => a.custodian_slips)
                    ?.filter(Boolean) || [];

                return {
                    ...item,
                    original_po_description: inventoryToPoDescMap[item.id] || null,
                    custodian_slips: itemAssignments
                };
            });
        },
        enabled: isOpen && !!poId,
    });

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Stock & Custodian History - {poNumber}</DialogTitle>
                    <DialogDescription>
                        Track which items were stocked in from this PO and their current assignments.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Stock Date</TableHead>
                                <TableHead className="w-[30%]">Item Details</TableHead>
                                <TableHead>Property/Item No.</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[35%]">Assignment (ICS)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">Loading history...</TableCell>
                                </TableRow>
                            ) : !historyItems || historyItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">
                                        No items have been stocked in yet for this Purchase Order.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                historyItems.map((item) => {
                                    // We've attached custodian_slips directly in the queryFn
                                    const hasAssignments = item.custodian_slips && item.custodian_slips.length > 0;

                                    return (
                                        <TableRow key={item.id} className="align-top">
                                            <TableCell className="text-xs">
                                                {format(new Date(item.created_at), "MMM dd, yyyy")}
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-xs font-medium line-clamp-2" title={item.description || ''}>
                                                    {item.description}
                                                </div>
                                                {item.original_po_description && item.original_po_description !== item.description && (
                                                    <div className="text-[10px] text-muted-foreground mt-1 line-clamp-1" title={`Original PO Name: ${item.original_po_description}`}>
                                                        <span className="font-semibold">Orig PO Name:</span> {item.original_po_description}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-xs space-y-1">
                                                    {item.property_number && (
                                                        <div className="font-mono text-muted-foreground">{item.property_number}</div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={item.status === 'In Use' ? 'default' : item.status === 'Available' ? 'secondary' : 'outline'} className="text-[10px]">
                                                    {item.status || "Unknown"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {hasAssignments ? (
                                                    <div className="space-y-3">
                                                        {item.custodian_slips?.map((ics: any) => (
                                                            <div key={ics.id} className="text-xs bg-slate-50 p-2 rounded border border-slate-100">
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className="font-medium text-blue-700">{ics.slip_number}</span>
                                                                    <span className="text-[10px] text-muted-foreground">
                                                                        {ics.date_issued ? format(new Date(ics.date_issued), "MMM dd, yyyy") : ''}
                                                                    </span>
                                                                </div>
                                                                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[10px]">
                                                                    <span className="text-muted-foreground">Received By:</span>
                                                                    <span className="font-medium">{ics.received_by || ics.custodian_name}</span>

                                                                    {(ics.office || ics.designation) && (
                                                                        <>
                                                                            <span className="text-muted-foreground">Office/Role:</span>
                                                                            <span className="truncate" title={`${ics.office || ''} ${ics.designation ? `(${ics.designation})` : ''}`}>
                                                                                {ics.office} {ics.designation ? `(${ics.designation})` : ''}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">No custodian assigned</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
}
