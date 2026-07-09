import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X, AlertCircle } from "lucide-react";
import { PurchaseOrder, PurchaseOrderItem } from "@/types/purchaseOrder";
import { Checkbox } from "@/components/ui/checkbox";

interface IARFormProps {
    po: any; // Purchase Order with items
    onSubmit: (data: any) => void;
    onCancel: () => void;
    isLoading?: boolean;
}

export const IARForm = ({ po, onSubmit, onCancel, isLoading }: IARFormProps) => {
    const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm({
        defaultValues: {
            iarNumber: `IAR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
            iarDate: new Date().toISOString().split('T')[0],
            poId: po.id,
            invoiceNo: "",
            invoiceDate: "",
            deliveryReceiptNo: "",
            deliveryReceiptDate: "",
            inspectionDate: new Date().toISOString().split('T')[0],
            acceptanceDate: new Date().toISOString().split('T')[0],
            inspectionOfficer: "GSO-JOHN DOE", 
            acceptanceOfficer: "GSO-JANE SMITH", 
            status: "Pending" as const,
            items: po.purchase_order_items.map((item: any) => ({
                poItemId: item.id,
                description: item.description,
                quantityOrdered: item.quantity,
                quantityReceived: item.quantity,
                unit: item.unit,
                unit_cost: item.unit_cost,
                unitCost: item.unit_cost,
                brand: "",
                model: "",
                serialNumber: "",
                isAccepted: true,
                iarRemarks: ""
            }))
        }
    });

    const { fields } = useFieldArray({
        control,
        name: "items"
    });

    const watchedItems = watch("items");

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="iarNumber">IAR Number</Label>
                    <Input id="iarNumber" {...register("iarNumber", { required: "IAR Number is required" })} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="iarDate">IAR Date</Label>
                    <Input id="iarDate" type="date" {...register("iarDate", { required: true })} />
                </div>
                <div className="space-y-2">
                    <Label>Reference PO</Label>
                    <Input disabled value={po.po_number} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-4">
                    <h4 className="font-semibold text-sm uppercase text-muted-foreground">Invoice Information</h4>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label htmlFor="invoiceNo">Invoice No.</Label>
                            <Input id="invoiceNo" {...register("invoiceNo")} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="invoiceDate">Invoice Date</Label>
                            <Input id="invoiceDate" type="date" {...register("invoiceDate")} />
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <h4 className="font-semibold text-sm uppercase text-muted-foreground">Delivery Receipt</h4>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label htmlFor="deliveryReceiptNo">DR No.</Label>
                            <Input id="deliveryReceiptNo" {...register("deliveryReceiptNo")} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="deliveryReceiptDate">DR Date</Label>
                            <Input id="deliveryReceiptDate" type="date" {...register("deliveryReceiptDate")} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-2">
                    <Label htmlFor="inspectionOfficer">Inspection Officer (FORMAT: OFFICE-NAME)</Label>
                    <Input id="inspectionOfficer" {...register("inspectionOfficer")} placeholder="e.g., GSO-JOHN DOE" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="acceptanceOfficer">Acceptance Officer (FORMAT: OFFICE-NAME)</Label>
                    <Input id="acceptanceOfficer" {...register("acceptanceOfficer")} placeholder="e.g., GSO-JANE SMITH" />
                </div>
            </div>

            <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold">Inspection & Acceptance of Items</h3>
                <div className="space-y-3">
                    {fields.map((field, index) => (
                        <Card key={field.id} className={watchedItems[index]?.isAccepted ? "" : "opacity-60 bg-muted"}>
                            <CardContent className="p-4">
                                <div className="flex items-start gap-4">
                                    <div className="pt-2">
                                        <Checkbox
                                            checked={watchedItems[index]?.isAccepted}
                                            onCheckedChange={(checked) => setValue(`items.${index}.isAccepted`, !!checked)}
                                        />
                                    </div>
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                        <div className="md:col-span-5">
                                            <p className="font-medium">{watchedItems[index]?.description}</p>
                                            <p className="text-xs text-muted-foreground">Ordered: {watchedItems[index]?.quantityOrdered} {watchedItems[index]?.unit} @ ₱{watchedItems[index]?.unitCost?.toLocaleString()}</p>
                                        </div>
                                        <div className="md:col-span-2">
                                            <Label className="text-[10px] uppercase">Qty Received</Label>
                                            <Input type="number" {...register(`items.${index}.quantityReceived` as const, { valueAsNumber: true })} size={1} />
                                        </div>
                                        <div className="md:col-span-5">
                                            <Label className="text-[10px] uppercase">Remarks/Condition</Label>
                                            <Input {...register(`items.${index}.iarRemarks` as const)} placeholder="Good condition, etc." />
                                        </div>
                                        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 border-t pt-2">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase">Brand</Label>
                                                <Input {...register(`items.${index}.brand` as const)} placeholder="e.g. Dell" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase">Model</Label>
                                                <Input {...register(`items.${index}.model` as const)} placeholder="e.g. Latitude" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase">Serial Number (SN)</Label>
                                                <Input {...register(`items.${index}.serialNumber` as const)} placeholder="e.g. TAG-12345" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Saving..." : "Record Inspection & Acceptance"}
                </Button>
            </div>
        </form>
    );
};
