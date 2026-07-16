import { useState, useEffect, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackagePlus, Info, History } from "lucide-react";
import { PurchaseOrder } from "@/types/purchaseOrder";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface StockInDialogProps {
    po: PurchaseOrder;
    onSubmit: (items: any[]) => void;
    onCancel: () => void;
    isLoading?: boolean;
}

// Parse a legacy property-number textarea: one number per line, trimmed, blanks dropped
const parseLegacyLines = (raw: string): string[] =>
    (raw || '').split('\n').map(l => l.trim()).filter(l => l.length > 0);

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

    // Legacy PO mode: items already have property numbers (pre-system POs)
    const [isLegacyMode, setIsLegacyMode] = useState<boolean>(() => {
        return localStorage.getItem(`stock_in_legacy_mode_${po.id}`) === 'true';
    });
    // Per PO-item raw textarea text, one property number per line
    const [legacyNumbers, setLegacyNumbers] = useState<Record<string, string>>(() => {
        const saved = localStorage.getItem(`stock_in_legacy_numbers_${po.id}`);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse saved legacy numbers:", e);
            }
        }
        return {};
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

    useEffect(() => {
        localStorage.setItem(`stock_in_legacy_mode_${po.id}`, String(isLegacyMode));
    }, [isLegacyMode, po.id]);

    useEffect(() => {
        localStorage.setItem(`stock_in_legacy_numbers_${po.id}`, JSON.stringify(legacyNumbers));
    }, [legacyNumbers, po.id]);

    const handleQuantityChange = (itemId: string, val: number, max: number) => {
        const safeVal = Math.max(0, Math.min(val, max));
        setStockQuantities(prev => ({ ...prev, [itemId]: safeVal }));
    };

    const getUnitCost = (item: any) => Number(item.unitCost || item.unit_cost || 0);

    // Legacy validation (derived per render): every non-PPE item being stocked needs
    // exactly quantityToStock numbers, with no duplicates across the whole batch
    const legacyValidation = (() => {
        if (!isLegacyMode) return { valid: true, itemErrors: {} as Record<string, string>, summary: '' };
        const itemErrors: Record<string, string> = {};
        const allNumbers: string[] = [];
        let missingCount = 0;

        for (const item of po.purchase_order_items || []) {
            const qty = stockQuantities[item.id] || 0;
            if (qty <= 0 || getUnitCost(item) >= 50000) continue;
            const lines = parseLegacyLines(legacyNumbers[item.id] || '');
            if (lines.length !== qty) {
                itemErrors[item.id] = `${lines.length} of ${qty} property numbers entered`;
                missingCount++;
            }
            allNumbers.push(...lines);
        }

        const seen = new Set<string>();
        const dupes = new Set<string>();
        for (const n of allNumbers) {
            if (seen.has(n)) dupes.add(n); else seen.add(n);
        }
        if (dupes.size > 0) {
            for (const item of po.purchase_order_items || []) {
                const lines = parseLegacyLines(legacyNumbers[item.id] || '');
                const itemDupes = lines.filter(l => dupes.has(l));
                if (itemDupes.length > 0) {
                    itemErrors[item.id] = `Duplicate: ${[...new Set(itemDupes)].join(', ')}`;
                }
            }
        }

        const valid = Object.keys(itemErrors).length === 0;
        let summary = '';
        if (dupes.size > 0) summary = `Duplicate property numbers: ${[...dupes].join(', ')}`;
        else if (missingCount > 0) summary = `${missingCount} item(s) are missing property numbers`;
        return { valid, itemErrors, summary };
    })();

    const handleStockIn = () => {
        if (isLegacyMode && !legacyValidation.valid) return;

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
                    serialNumber: (item as any).serialNumber || (item as any).serial_number || '',
                    manualPropertyNumbers: isLegacyMode && uCost < 50000
                        ? parseLegacyLines(legacyNumbers[item.id] || '')
                        : undefined
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

            <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg border">
                <Checkbox
                    id="legacy-po-mode"
                    checked={isLegacyMode}
                    onCheckedChange={(checked) => setIsLegacyMode(checked === true)}
                    className="mt-0.5"
                />
                <div className="space-y-1">
                    <label htmlFor="legacy-po-mode" className="text-sm font-semibold cursor-pointer flex items-center gap-2">
                        <History className="w-4 h-4" />
                        Legacy PO — items already have property numbers
                    </label>
                    <p className="text-[10px] text-muted-foreground uppercase">
                        Enter the existing property number for each unit; auto-generation is skipped. Any format allowed.
                    </p>
                </div>
            </div>

            {isLegacyMode && (
                <Alert variant="default" className="bg-amber-50 border-amber-200">
                    <History className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">Legacy Mode Active</AlertTitle>
                    <AlertDescription className="text-amber-700">
                        Property numbers will be recorded exactly as typed — one per unit, one per line.
                        PPE items (₱50,000 and above) are tracked only and do not need property numbers.
                    </AlertDescription>
                </Alert>
            )}

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
                        const qtyToStock = stockQuantities[item.id] || 0;
                        const uCost = getUnitCost(item);
                        const isPPE = uCost >= 50000;
                        const filledCount = parseLegacyLines(legacyNumbers[item.id] || '').length;
                        const itemError = legacyValidation.itemErrors[item.id];
                        return (
                            <Fragment key={item.id}>
                                <TableRow>
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
                                {isLegacyMode && qtyToStock > 0 && (
                                    <TableRow key={`${item.id}-legacy`} className="bg-muted/20 hover:bg-muted/20">
                                        <TableCell colSpan={5} className="py-3">
                                            {isPPE ? (
                                                <p className="text-xs text-muted-foreground italic">
                                                    PPE — tracked only, no property number
                                                </p>
                                            ) : (
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-xs font-semibold">
                                                            Existing property numbers
                                                        </label>
                                                        <Badge
                                                            variant="outline"
                                                            className={filledCount === qtyToStock
                                                                ? "text-green-700 border-green-300 bg-green-50"
                                                                : "text-red-700 border-red-300 bg-red-50"}
                                                        >
                                                            {filledCount} / {qtyToStock} numbers
                                                        </Badge>
                                                    </div>
                                                    <Textarea
                                                        value={legacyNumbers[item.id] || ''}
                                                        onChange={(e) => setLegacyNumbers(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                        placeholder={`One property number per line (${qtyToStock} line${qtyToStock > 1 ? 's' : ''} needed)`}
                                                        rows={Math.min(qtyToStock, 6)}
                                                        className="font-mono text-sm"
                                                    />
                                                    {itemError && (
                                                        <p className="text-xs text-red-600">{itemError}</p>
                                                    )}
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </Fragment>
                        );
                    })}
                </TableBody>
            </Table>

            <div className="flex justify-end items-center gap-2 pt-4 border-t">
                {isLegacyMode && !legacyValidation.valid && totalToStock > 0 && (
                    <p className="text-xs text-red-600 mr-auto">{legacyValidation.summary}</p>
                )}
                <Button variant="outline" onClick={onCancel}>Cancel</Button>
                <Button
                    onClick={handleStockIn}
                    disabled={totalToStock === 0 || isLoading || (isLegacyMode && !legacyValidation.valid)}
                    className="bg-green-600 hover:bg-green-700"
                >
                    <PackagePlus className="w-4 h-4 mr-2" />
                    {isLoading ? "Ingesting..." : `Stock In ${totalToStock} Items`}
                </Button>
            </div>
        </div>
    );
};
