import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { lookupService, LookupItem } from "@/services/lookupService";
import { annexService } from "@/services/annexService";
import { syncInventoryRelatedRecords } from "@/services/simpleInventoryService";
import { toast } from "sonner";

interface QuickEditInventoryDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    inventoryItem: any;
    poNumber?: string;
    fundCluster?: string;
    onSaveSuccess: () => void;
}

export const QuickEditInventoryDialog = ({
    isOpen,
    onOpenChange,
    inventoryItem,
    poNumber,
    fundCluster,
    onSaveSuccess
}: QuickEditInventoryDialogProps) => {
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<LookupItem[]>([]);
    const [categoryOpen, setCategoryOpen] = useState(false);

    const [formData, setFormData] = useState<any>({
        brand: inventoryItem?.brand || "",
        model: inventoryItem?.model || "",
        serialNumber: inventoryItem?.serial_number || "",
        semiExpandableCategory: inventoryItem?.semi_expandable_category || "",
        description: inventoryItem?.description || "",
        reference: poNumber || "",
    });

    const [autoCreateCard, setAutoCreateCard] = useState(true);
    const [isDescriptionManual, setIsDescriptionManual] = useState(false);

    // Initialize form when item changes
    useEffect(() => {
        if (inventoryItem) {
            setFormData({
                brand: inventoryItem.brand || "",
                model: inventoryItem.model || "",
                serialNumber: inventoryItem.serial_number || "",
                semiExpandableCategory: inventoryItem.semi_expandable_category || "",
                description: inventoryItem.description || "",
                reference: poNumber || "",
            });
            setIsDescriptionManual(false);
        }
    }, [inventoryItem]);

    // Load categories
    useEffect(() => {
        const loadCategories = async () => {
            const data = await lookupService.getSemiExpandableCategories();
            setCategories(data);
        };
        loadCategories();
    }, []);

    // Auto-computed description
    const computedDescription = useMemo(() => {
        const brandModel = [formData.brand?.trim(), formData.model?.trim()].filter(Boolean).join(' ');
        const sn = formData.serialNumber?.trim();
        // Strip any previously embedded SN so an edited serial REPLACES the old one
        const existingDesc = (inventoryItem?.description || "")
            .replace(/,?\s*SN:\s*[^,]*/gi, '')
            .replace(/\s{2,}/g, ' ')
            .replace(/^[,\s]+|[,\s]+$/g, '')
            .trim();

        // If brand/model are filled, build from those
        if (brandModel && sn) return `${brandModel} SN: ${sn}`;
        if (brandModel) return brandModel;

        // If only SN was added (no brand/model), append it to the existing description
        if (sn) {
            if (existingDesc) {
                return `${existingDesc} SN: ${sn}`;
            }
            return `SN: ${sn}`;
        }

        return existingDesc;
    }, [formData.brand, formData.model, formData.serialNumber, inventoryItem?.description]);

    // Update description if not manual
    useEffect(() => {
        if (!isDescriptionManual && computedDescription) {
            setFormData(prev => ({ ...prev, description: computedDescription }));
        }
    }, [computedDescription, isDescriptionManual]);

    const handleSave = async () => {
        setLoading(true);
        try {
            // 1. Update Inventory Item
            const { error: updateError } = await supabase
                .from('inventory_items')
                .update({
                    brand: formData.brand,
                    model: formData.model,
                    serial_number: formData.serialNumber,
                    semi_expandable_category: formData.semiExpandableCategory,
                    description: formData.description,
                    updated_at: new Date().toISOString()
                })
                .eq('id', inventoryItem.id);

            if (updateError) throw updateError;

            // Cascade the change to linked records (Property Cards, ICS, Transfers)
            // so an edited serial number / description shows up on the property card
            await syncInventoryRelatedRecords(inventoryItem.id);

            // 2. Auto-create Property Card if requested
            if (autoCreateCard) {
                // Check if card already exists
                const existingCard = await annexService.findPropertyCardByInventoryItem(inventoryItem.id);

                if (!existingCard) {
                    await annexService.createPropertyCardFromInventory({
                        inventoryItemId: inventoryItem.id,
                        entityName: "PROVINCIAL GOVERNMENT OF APAYAO",
                        fundCluster: fundCluster || "01", // Use PO's fund cluster
                        initialEntry: {
                            date: inventoryItem.date_acquired || new Date().toISOString().split('T')[0],
                            reference: formData.reference || "Initial Receipt",
                            receiptQty: inventoryItem.quantity || 1,
                            unitCost: inventoryItem.unit_cost || 0,
                            totalCost: (inventoryItem.quantity || 1) * (inventoryItem.unit_cost || 0)
                        }
                    });
                    toast.success("Property card created successfully");
                }
            }

            toast.success("Inventory item updated successfully");
            onSaveSuccess();
            onOpenChange(false);
        } catch (error: any) {
            console.error("Error updating inventory item:", error);
            toast.error(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-600" />
                        Quick Edit Item - {inventoryItem?.property_number}
                    </DialogTitle>
                    <DialogDescription>
                        Update essential details for this item upon physical arrival.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="brand">Brand</Label>
                            <Input
                                id="brand"
                                value={formData.brand}
                                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                placeholder="e.g. Dell"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="model">Model</Label>
                            <Input
                                id="model"
                                value={formData.model}
                                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                placeholder="e.g. Optiplex"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="serialNumber">Serial Number</Label>
                        <Input
                            id="serialNumber"
                            value={formData.serialNumber}
                            onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                            placeholder="Enter S/N"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Semi-Expendable Category</Label>
                        <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    className="w-full justify-between"
                                >
                                    {formData.semiExpandableCategory || "Select category..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0">
                                <Command>
                                    <CommandInput placeholder="Search category..." />
                                    <CommandList>
                                        <CommandEmpty>No category found.</CommandEmpty>
                                        <CommandGroup>
                                            {categories.map((cat) => (
                                                <CommandItem
                                                    key={cat.id}
                                                    value={cat.name}
                                                    onSelect={() => {
                                                        setFormData({ ...formData, semiExpandableCategory: cat.name });
                                                        setCategoryOpen(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            formData.semiExpandableCategory === cat.name ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {cat.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Input
                            id="description"
                            value={formData.description}
                            onChange={(e) => {
                                setIsDescriptionManual(true);
                                setFormData({ ...formData, description: e.target.value });
                            }}
                        />
                        {!isDescriptionManual && (
                            <p className="text-[10px] text-muted-foreground italic">
                                Auto-generating from Brand/Model/SN
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reference">Audit Reference (e.g. PO Number)</Label>
                        <Input
                            id="reference"
                            value={formData.reference}
                            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                            placeholder="e.g. PO-2026-0001"
                        />
                    </div>

                    <div className="flex items-center space-x-2 pt-2 border-t mt-2">
                        <Checkbox
                            id="autoCreate"
                            checked={autoCreateCard}
                            onCheckedChange={(checked) => setAutoCreateCard(!!checked)}
                        />
                        <Label
                            htmlFor="autoCreate"
                            className="text-sm font-medium leading-none cursor-pointer"
                        >
                            Auto-create Property Card for this unit
                        </Label>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
