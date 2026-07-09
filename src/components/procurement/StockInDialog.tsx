import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackagePlus, Info } from "lucide-react";
import { PurchaseOrder } from "@/types/purchaseOrder";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface StockInDialogProps {
    po: PurchaseOrder;
    onSubmit: (items: any[]) => void;
    onCancel: () => void;
    isLoading?: boolean;
}

export const StockInDialog = ({ po, onSubmit, onCancel, isLoading }: StockInDialogProps) => {
    const [dateAcquired, setDateAcquired] = useState<string>(new Date().toISOString().split('T')[0]);
    // Local state to track quantities for this "Stock In" session
    const [stockQuantities, setStockQuantities] = useState<Record<string, number>>(() => {
        const saved = localStorage.getItem(`stock_in_quantities_${po.id}`);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse saved stock quantities:", e);
            }
        }
        return po.purchase_order_items?.reduce((acc: any, item: any) => {
            const remaining = item.quantity - (item.quantityStocked || 0);
            acc[item.id] = remaining > 0 ? remaining : 0;
            return acc;
        }, {}) || {};
    });

    // Load persisted date
    useEffect(() => {
        const savedDate = localStorage.getItem(`stock_in_date_${po.id}`);
        if (savedDate) setDateAcquired(savedDate);
    }, [po.id]);

    // Save changes
    useEffect(() => {
        localStorage.setItem(`stock_in_quantities_${po.id}`, JSON.stringify(stockQuantities));
    }, [stockQuantities, po.id]);

    useEffect(() => {
        localStorage.setItem(`stock_in_date_${po.id}`, dateAcquired);
    }, [dateAcquired, po.id]);

    const handleQuantityChange = (itemId: string, val: number, max: number) => {
        const safeVal = Math.max(0, Math.min(val, max));
        setStockQuantities(prev => ({ ...prev, [itemId]: safeVal }));
    };

    const handleStockIn = () => {
        const itemsToStock = po.purchase_order_items
            ?.filter(item => stockQuantities[item.id] > 0)
            .map(item => {
                const uCost = Number(item.unitCost || (item as any).unit_cost || 0);
                return {
                    poItemId: item.id,
                    quantityToStock: stockQuantities[item.id],
                    description: item.description,
                    unit: item.unit,
                    unitCost: uCost,
                    dateAcquired: dateAcquired, // Use the selected date
                    category: (item as any).category || (item as any).semi_expandable_category || '',
                    estimatedUsefulLife: (item as any).estimatedUsefulLife || (item as any).estimated_useful_life || '',
                    serialNumber: (item as any).serialNumber || (item as any).serial_number || ''
                };
            });

        if (!itemsToStock || itemsToStock.length === 0) {
            return;
        }

        onSubmit(itemsToStock);
    };

    const totalToStock = Object.values(stockQuantities).reduce((a, b) => a + b, 0);

    return (
        <div className="space-y-6">
            <Alert variant="default" className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800">Direct Inventory Ingestion</AlertTitle>
                <AlertDescription className="text-blue-700">
                    Entering these items will create individual records in the system inventory.
                    You can edit specific Brands/Models in the Inventory list after delivery.
                </AlertDescription>
            </Alert>

            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border">
                <div className="space-y-1">
                    <label className="text-sm font-semibold">Date of Acquisition</label>
                    <p className="text-[10px] text-muted-foreground uppercase">This date will be applied to all items</p>
                </div>
                <Input
                    type="date"
                    value={dateAcquired}
                    onChange={(e) => setDateAcquired(e.target.value)}
                    className="max-w-[200px]"
                />
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-center">Total Qty</TableHead>
                        <TableHead className="text-center">Stocked</TableHead>
                        <TableHead className="text-center">Remaining</TableHead>
                        <TableHead className="w-[120px] text-right">To Stock In Now</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {po.purchase_order_items?.map((item: any) => {
                        const remaining = item.quantity - (item.quantityStocked || 0);
                        return (
                            <TableRow key={item.id}>
                                <TableCell>
                                    <div className="font-medium">{item.description}</div>
                                    <div className="text-xs text-muted-foreground">₱{item.unitCost?.toLocaleString()} per {item.unit}</div>
                                </TableCell>
                                <TableCell className="text-center">{item.quantity}</TableCell>
                                <TableCell className="text-center">
                                    <Badge variant={item.quantityStocked >= item.quantity ? "default" : "secondary"}>
                                        {item.quantityStocked || 0}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center font-bold">
                                    {remaining}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Input
                                        type="number"
                                        min={0}
                                        max={remaining}
                                        value={stockQuantities[item.id]}
                                        disabled={remaining <= 0}
                                        onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0, remaining)}
                                        className="w-20 ml-auto h-8"
                                    />
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>

            <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={onCancel}>Cancel</Button>
                <Button
                    onClick={handleStockIn}
                    disabled={totalToStock === 0 || isLoading}
                    className="bg-green-600 hover:bg-green-700"
                >
                    <PackagePlus className="w-4 h-4 mr-2" />
                    {isLoading ? "Ingesting..." : `Stock In ${totalToStock} Items`}
                </Button>
            </div>
        </div>
    );
};
