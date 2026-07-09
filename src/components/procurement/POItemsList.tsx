import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Package, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { QuickEditInventoryDialog } from "./QuickEditInventoryDialog";

interface POItemsListProps {
    poId: string;
    poNumber: string;
    fundCluster: string;
    items: any[];
}

export const POItemsList = ({ poId, poNumber, fundCluster, items }: POItemsListProps) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    // Fetch all inventory items related to this PO for easy display of property numbers
    const { data: inventoryItems, isLoading } = useQuery({
        queryKey: ['inventory-by-po', poId],
        queryFn: async () => {
            const allIds = items.flatMap(item => item.inventoryItemIds || []);
            if (allIds.length === 0) return [];

            const { data, error } = await supabase
                .from('inventory_items')
                .select('*')
                .in('id', allIds);

            if (error) throw error;
            return data;
        },
        enabled: items.some(item => (item.inventoryItemIds || []).length > 0)
    });

    const getInventoryItem = (id: string) => inventoryItems?.find(item => item.id === id);

    return (
        <div className="space-y-4">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-center">Total Qty</TableHead>
                        <TableHead className="text-center">Stocked</TableHead>
                        <TableHead>Linked Inventory Items</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.description}</TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-center">
                                <Badge variant={item.quantityStocked >= item.quantity ? "default" : "secondary"}>
                                    {item.quantityStocked || 0} / {item.quantity}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-3">
                                    {(item.inventoryItemIds || []).map((id: string) => {
                                        const invItem = getInventoryItem(id);
                                        const isHighValue = invItem?.sub_category === 'High Value Expendable';
                                        const valueFilter = isHighValue ? 'high-value' : 'low-value';
                                        const isDescriptionDifferent = invItem?.description && invItem.description !== item.description;

                                        return (
                                            <div key={id} className="flex flex-col gap-1 pr-4 border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                                                <div className="flex items-center gap-2 group flex-wrap">
                                                    <Badge
                                                        variant="outline"
                                                        className="cursor-pointer hover:bg-slate-100 flex items-center gap-1 py-1"
                                                        onClick={() => navigate(`/inventory?search=${invItem?.property_number || id}&valueFilter=${valueFilter}`)}
                                                    >
                                                        <Package className="w-3 h-3 text-blue-500" />
                                                        {invItem?.property_number || 'Loading...'}
                                                        <ExternalLink className="w-3 h-3" />
                                                    </Badge>
                                                    {invItem?.custodian && (
                                                        <Badge 
                                                            variant="secondary" 
                                                            className={`text-[10px] py-0 h-5 font-normal bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200 ${invItem.ics_number ? 'cursor-pointer' : ''}`}
                                                            onClick={() => {
                                                                if (invItem.ics_number) {
                                                                    navigate(`/custodian-slips?search=${invItem.ics_number}`);
                                                                }
                                                            }}
                                                            title={invItem.ics_number ? `Click to view ICS ${invItem.ics_number}` : `Custodian: ${invItem.custodian}`}
                                                        >
                                                            Custodian: <span className="font-semibold ml-1">{invItem.custodian}</span>
                                                        </Badge>
                                                    )}
                                                    {invItem?.condition && (
                                                        <Badge variant="outline" className="text-[10px] py-0 h-5 font-normal text-amber-700 border-amber-200 bg-amber-50">
                                                            Condition: <span className="font-semibold ml-1">{invItem.condition}</span>
                                                        </Badge>
                                                    )}
                                                    {invItem?.status && (
                                                        <Badge variant="outline" className={`text-[10px] py-0 h-5 font-normal ${invItem.status === 'Available' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-slate-700 border-slate-200 bg-slate-50'}`}>
                                                            Status: <span className="font-semibold ml-1">{invItem.status}</span>
                                                        </Badge>
                                                    )}
                                                    {invItem && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 opacity-40 group-hover:opacity-100 transition-opacity"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedItem({
                                                                    ...invItem,
                                                                    brand: invItem.brand || "",
                                                                    model: invItem.model || "",
                                                                    serial_number: invItem.serial_number || "",
                                                                    semi_expandable_category: invItem.semi_expandable_category || "",
                                                                    description: invItem.description || "",
                                                                });
                                                                setIsEditDialogOpen(true);
                                                            }}
                                                            title="Quick edit item details"
                                                        >
                                                            <Edit className="w-3.5 h-3.5 text-blue-600" />
                                                        </Button>
                                                    )}
                                                </div>
                                                {invItem?.description && (
                                                    <div className={`text-xs pl-1 ${isDescriptionDifferent ? 'text-amber-700 font-medium' : 'text-slate-500'}`}>
                                                        {isDescriptionDifferent && <span className="text-[10px] uppercase font-bold text-amber-600 mr-1">Edited:</span>}
                                                        {invItem.description}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {(item.inventoryItemIds || []).length === 0 && (
                                        <span className="text-xs text-muted-foreground italic">Not yet stocked</span>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {selectedItem && (
                <QuickEditInventoryDialog
                    isOpen={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                    inventoryItem={selectedItem}
                    poNumber={poNumber}
                    fundCluster={fundCluster}
                    onSaveSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ['inventory-by-po', poId] });
                    }}
                />
            )}
        </div>
    );
};
