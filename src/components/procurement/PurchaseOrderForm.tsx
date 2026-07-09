import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Controller, useForm, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, AlertCircle, Trash, ArrowDown } from "lucide-react";
import { lookupService, LookupItem } from "@/services/lookupService";
import { PurchaseOrder, PurchaseOrderItem } from "@/types/purchaseOrder";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface PurchaseOrderFormProps {
    initialData?: any;
    onSubmit: (data: any) => void;
    onCancel: () => void;
    isLoading?: boolean;
}

export const PurchaseOrderForm = ({ initialData, onSubmit, onCancel, isLoading }: PurchaseOrderFormProps) => {
    const queryClient = useQueryClient();
    const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
    const [newSupplierName, setNewSupplierName] = useState("");
    const [newSupplierAddress, setNewSupplierAddress] = useState("");

    const addSupplierMutation = useMutation({
        mutationFn: async () => {
            return await lookupService.create('suppliers', { 
                name: newSupplierName, 
                address: newSupplierAddress 
            });
        },
        onSuccess: (newSupplier) => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            setValue("supplierId", newSupplier.id);
            setValue("address", (newSupplier as LookupItem).address || "");
            setIsAddSupplierOpen(false);
            setNewSupplierName("");
            setNewSupplierAddress("");
            toast.success("Supplier added successfully");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to add supplier");
        }
    });

    const handleAddSupplier = () => {
        if (!newSupplierName.trim()) {
            toast.error("Supplier name is required");
            return;
        }
        addSupplierMutation.mutate();
    };

    const { data: suppliers } = useQuery({
        queryKey: ['suppliers'],
        queryFn: () => lookupService.getSuppliers()
    });

    const { data: fundSources } = useQuery({
        queryKey: ['fund-sources'],
        queryFn: () => lookupService.getFundSources()
    });

    const { data: semiExpandableCategories } = useQuery({
        queryKey: ['semi-expandable-categories'],
        queryFn: () => lookupService.getSemiExpandableCategories()
    });

    const { register, control, handleSubmit, watch, setValue, getValues, reset, formState: { errors } } = useForm({
        defaultValues: initialData || {
            poNumber: `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
            poDate: new Date().toISOString().split('T')[0],
            supplierId: "",
            address: "",
            modeOfProcurement: "Shopping",
            placeOfDelivery: "GSO Warehouse",
            deliveryTerm: "30 Days",
            paymentTerm: "30 Days",
            fundCluster: "01",
            fundSourceId: "",
            orsBursNumber: "",
            orsBursDate: "",
            office: "",
            purpose: "",
            abc: 0,
            prNumber: "",
            status: 'Pending' as const,
            remarks: "",
            items: [
                { description: "", quantity: 1, unit: "piece", unitCost: 0, category: "", estimatedUsefulLife: "", serialNumber: "" }
            ]
        }
    });

    // Load persisted data for NEW POs only
    useEffect(() => {
        if (!initialData) {
            const savedData = localStorage.getItem('po_form_data');
            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);
                    // Merge with generated PO number if it was already used or keep generated
                    reset(parsed);
                } catch (e) {
                    console.error("Failed to parse saved PO form:", e);
                }
            }
        }
    }, [initialData, reset]);

    // Watch and persist changes
    const allValues = watch();
    useEffect(() => {
        if (!initialData && allValues) {
            localStorage.setItem('po_form_data', JSON.stringify(allValues));
        }
    }, [allValues, initialData]);

    // Handle clearing (will be handled by parent onSuccess now)
    const handleFormSubmit = (data: any) => {
        onSubmit(data);
    };

    useEffect(() => {
        if (initialData) {
            reset(initialData);
        }
    }, [initialData, reset]);

    const { fields, append, remove } = useFieldArray({
        control,
        name: "items"
    });

    const handleApplyAllEUL = () => {
        if (fields.length > 1) {
            const firstEul = getValues(`items.0.estimatedUsefulLife`);
            if (firstEul) {
                fields.forEach((_, index) => {
                    if (index > 0) {
                        setValue(`items.${index}.estimatedUsefulLife` as any, firstEul, { shouldDirty: true });
                    }
                });
            }
        }
    };

    const watchedItems = watch("items");

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            {initialData?.status === 'Received' && (
                <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-xs font-medium">
                        This Purchase Order is already marked as <strong>RECEIVED</strong>. 
                        Changes made here will now automatically update all items in inventory, Property Cards, and Custodian Slips.
                    </AlertDescription>
                </Alert>
            )}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="poNumber">PO Number</Label>
                    <Input id="poNumber" {...register("poNumber", { required: "PO Number is required" })} />
                    {errors.poNumber && <p className="text-xs text-red-500">{(errors.poNumber.message as string)}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="poDate">PO Date</Label>
                    <Input id="poDate" type="date" {...register("poDate", { required: true })} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="supplierId">Supplier</Label>
                    <Controller
                        name="supplierId"
                        control={control}
                        render={({ field }) => (
                            <Select 
                                onValueChange={(val) => {
                                    field.onChange(val);
                                    const supplier = suppliers?.find(s => s.id === val);
                                    if (supplier) {
                                        setValue("address", supplier.address || "");
                                    }
                                }} 
                                value={field.value}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select supplier" />
                                </SelectTrigger>
                                <SelectContent>
                                    {suppliers?.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    <div className="flex justify-end mt-1">
                        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs text-muted-foreground" onClick={() => setIsAddSupplierOpen(true)}>
                            + Add New Supplier
                        </Button>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="modeOfProcurement">Procurement Mode</Label>
                    <Controller
                        name="modeOfProcurement"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Shopping">Shopping</SelectItem>
                                    <SelectItem value="SVP">Small Value Procurement (SVP)</SelectItem>
                                    <SelectItem value="Public Bidding">Public Bidding</SelectItem>
                                    <SelectItem value="Direct Contracting">Direct Contracting</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="prNumber">PR Number</Label>
                    <Input id="prNumber" {...register("prNumber")} placeholder="e.g. 2025-07-195-A" />
                </div>
                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Supplier Address</Label>
                    <Input id="address" {...register("address")} placeholder="Auto-fills from supplier, edit to update" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-2">
                    <Label htmlFor="office">Office</Label>
                    <Input id="office" {...register("office")} placeholder="e.g. PHO" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="purpose">Purpose</Label>
                    <Input id="purpose" {...register("purpose")} placeholder="e.g. ICT FOR PESU PROGRAM USE" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-t pt-4">
                <div className="space-y-2">
                    <Label htmlFor="abc">ABC (Approved Budget)</Label>
                    <Input id="abc" type="number" step="0.01" {...register("abc", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="placeOfDelivery">Place of Delivery</Label>
                    <Input id="placeOfDelivery" {...register("placeOfDelivery")} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="deliveryTerm">Delivery Term</Label>
                    <Input id="deliveryTerm" {...register("deliveryTerm")} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="paymentTerm">Payment Term</Label>
                    <Input id="paymentTerm" {...register("paymentTerm")} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-2">
                    <Label htmlFor="fundSourceId">Fund Source *</Label>
                    <Controller
                        name="fundSourceId"
                        control={control}
                        render={({ field }) => (
                            <Select 
                                onValueChange={(val) => {
                                    field.onChange(val);
                                    const source = fundSources?.find(s => s.id === val);
                                    if (source?.code) {
                                        setValue("fundCluster", source.code);
                                    }
                                }} 
                                value={field.value}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select fund source" />
                                </SelectTrigger>
                                <SelectContent>
                                    {fundSources?.map((fs) => (
                                        <SelectItem key={fs.id} value={fs.id}>{fs.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="fundCluster">Fund Cluster Code</Label>
                    <Input id="fundCluster" {...register("fundCluster")} placeholder="e.g. 01, 07" />
                </div>
            </div>

            <div className="space-y-4 border-t pt-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Items</h3>
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ description: "", quantity: 1, unit: "piece", unitCost: 0, category: "", estimatedUsefulLife: "", serialNumber: "" })}>
                        <Plus className="w-4 h-4 mr-2" /> Add Item
                    </Button>
                </div>

                <div className="border rounded-md overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-[22%]">Item Description</TableHead>
                                <TableHead className="w-[14%]">Category</TableHead>
                                <TableHead className="w-[14%]">Serial No.</TableHead>
                                <TableHead className="w-[7%] group relative">
                                    EUL
                                    <button
                                        type="button"
                                        onClick={handleApplyAllEUL}
                                        className="opacity-0 group-hover:opacity-100 absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded text-slate-500 transition-opacity"
                                        title="Copy first row EUL to all rows"
                                    >
                                        <ArrowDown className="w-3 h-3" />
                                    </button>
                                </TableHead>
                                <TableHead className="w-[6%]">Qty</TableHead>
                                <TableHead className="w-[8%]">Unit</TableHead>
                                <TableHead className="w-[10%]">Unit Cost</TableHead>
                                <TableHead className="w-[10%]">Total Cost</TableHead>
                                <TableHead className="w-[5%] text-right"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((field, index) => (
                                <TableRow key={field.id} className="group hover:bg-muted/30">
                                    <TableCell className="p-0 border-r align-top">
                                        <Textarea 
                                            {...register(`items.${index}.description` as const, { required: true })}
                                            placeholder="Enter item description..."
                                            className="min-h-[40px] resize-none border-0 rounded-none focus-visible:ring-1 focus-visible:ring-inset py-3 px-3 w-full bg-transparent"
                                            onInput={(e) => {
                                                const target = e.currentTarget;
                                                target.style.height = 'auto';
                                                target.style.height = target.scrollHeight + 'px';
                                            }}
                                            onFocus={(e) => {
                                                e.currentTarget.style.height = 'auto';
                                                e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                                            }}
                                            data-row={index}
                                            data-field="description"
                                        />
                                    </TableCell>
                                    <TableCell className="p-0 border-r align-top">
                                        <Controller
                                            name={`items.${index}.category` as const}
                                            control={control}
                                            render={({ field: catField }) => (
                                                <Select onValueChange={catField.onChange} value={catField.value || ""}>
                                                    <SelectTrigger className="border-0 rounded-none focus:ring-1 focus:ring-inset h-full py-3 px-2 bg-transparent text-xs">
                                                        <SelectValue placeholder="Select..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {semiExpandableCategories?.map((cat) => (
                                                            <SelectItem key={cat.id} value={cat.name} className="text-xs">
                                                                {cat.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell className="p-0 border-r align-top">
                                        <Textarea
                                            {...register(`items.${index}.serialNumber` as const)}
                                            placeholder="SN: ..."
                                            className="min-h-[40px] resize-none border-0 rounded-none focus-visible:ring-1 focus-visible:ring-inset py-3 px-2 w-full bg-transparent text-xs"
                                            onInput={(e) => {
                                                const target = e.currentTarget;
                                                target.style.height = 'auto';
                                                target.style.height = target.scrollHeight + 'px';
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell className="p-0 border-r align-top">
                                        <Input
                                            {...register(`items.${index}.estimatedUsefulLife` as const)}
                                            placeholder="Estimate..."
                                            className="border-0 rounded-none focus-visible:ring-1 focus-visible:ring-inset h-full py-3 px-2 bg-transparent text-xs"
                                        />
                                    </TableCell>
                                    <TableCell className="p-0 border-r align-top">
                                        <Input 
                                            type="number" 
                                            {...register(`items.${index}.quantity` as const, { valueAsNumber: true, min: 1 })}
                                            className="border-0 rounded-none focus-visible:ring-1 focus-visible:ring-inset h-full py-3 px-3 bg-transparent"
                                            data-row={index}
                                            data-field="quantity"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const nextRow = document.querySelector(`[data-row="${index + 1}"][data-field="quantity"]`) as HTMLElement;
                                                    nextRow?.focus();
                                                }
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell className="p-0 border-r align-top">
                                        <Controller
                                            name={`items.${index}.unit` as const}
                                            control={control}
                                            render={({ field: unitField }) => (
                                                <Select 
                                                    onValueChange={unitField.onChange} 
                                                    value={unitField.value || "piece"}
                                                >
                                                    <SelectTrigger className="border-0 rounded-none focus:ring-1 focus:ring-inset h-full py-3 px-3 bg-transparent uppercase text-xs">
                                                        <SelectValue placeholder="Unit" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="piece" className="text-xs uppercase">PIECE</SelectItem>
                                                        <SelectItem value="unit" className="text-xs uppercase">UNIT</SelectItem>
                                                        <SelectItem value="set" className="text-xs uppercase">SET</SelectItem>
                                                        <SelectItem value="box" className="text-xs uppercase">BOX</SelectItem>
                                                        <SelectItem value="lot" className="text-xs uppercase">LOT</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell className="p-0 border-r align-top">
                                        <div className="relative group/cost">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                {...register(`items.${index}.unitCost` as const, {
                                                    valueAsNumber: true
                                                })}
                                                className={cn(
                                                    "border-0 rounded-none focus-visible:ring-1 focus-visible:ring-inset h-full py-3 px-3 bg-transparent",
                                                    watchedItems[index]?.unitCost >= 50000 && "text-orange-600 font-semibold"
                                                )}
                                                data-row={index}
                                                data-field="unitCost"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const nextRow = document.querySelector(`[data-row="${index + 1}"][data-field="unitCost"]`) as HTMLElement;
                                                        nextRow?.focus();
                                                    }
                                                }}
                                            />
                                            {watchedItems[index]?.unitCost >= 50000 && (
                                                <div className="absolute -top-8 left-0 z-10 bg-orange-500 text-white text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover/cost:opacity-100 transition-opacity whitespace-nowrap">
                                                    PPE Item (Tracking Only)
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="p-3 text-right font-medium align-top">
                                        {(watchedItems[index]?.quantity * watchedItems[index]?.unitCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="p-1 text-right align-top">
                                        {fields.length > 1 && (
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => remove(index)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Saving..." : (initialData ? "Save Changes" : "Create Purchase Order")}
                </Button>
            </div>

            {/* Add Supplier Dialog */}
            <Dialog open={isAddSupplierOpen} onOpenChange={setIsAddSupplierOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Supplier</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="newSupplierName">Name *</Label>
                            <Input 
                                id="newSupplierName" 
                                value={newSupplierName} 
                                onChange={(e) => setNewSupplierName(e.target.value)} 
                                placeholder="Enter supplier name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="newSupplierAddress">Address</Label>
                            <Input 
                                id="newSupplierAddress" 
                                value={newSupplierAddress} 
                                onChange={(e) => setNewSupplierAddress(e.target.value)} 
                                placeholder="Enter supplier address"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsAddSupplierOpen(false)}>Cancel</Button>
                        <Button type="button" onClick={handleAddSupplier} disabled={addSupplierMutation.isPending}>
                            {addSupplierMutation.isPending ? "Adding..." : "Add Supplier"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </form>
    );
};
