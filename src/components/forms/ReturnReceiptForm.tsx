// =====================================================
// Return Receipt Form - Annex A.6 (RRSP)
// =====================================================

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save } from "lucide-react";
import { returnReceiptService, ReturnReceiptItem } from "@/services/returnReceiptService";
import { toast } from "sonner";

interface ReturnReceiptFormProps {
    onSuccess?: (receiptNumber: string) => void;
}

export const ReturnReceiptForm: React.FC<ReturnReceiptFormProps> = ({ onSuccess }) => {
    const queryClient = useQueryClient();

    // Form state
    const [entityName, setEntityName] = useState('');
    const [fundCluster, setFundCluster] = useState('');
    const [rrspDate, setRrspDate] = useState(new Date().toISOString().split('T')[0]);

    // Items state
    const [items, setItems] = useState<ReturnReceiptItem[]>([{
        description: '',
        quantity: 0,
        ics_no: '',
        end_user: '',
        remarks: ''
    }]);

    // Signature state
    const [returnedByName, setReturnedByName] = useState('');
    const [returnedByDate, setReturnedByDate] = useState('');
    const [receivedByName, setReceivedByName] = useState('');
    const [receivedByPosition, setReceivedByPosition] = useState('');
    const [receivedByDate, setReceivedByDate] = useState('');

    // Create mutation
    const createMutation = useMutation({
        mutationFn: returnReceiptService.create,
        onSuccess: (receipt) => {
            toast.success(`Return Receipt ${receipt.rrsp_number} created successfully!`);
            queryClient.invalidateQueries({ queryKey: ['return-receipts'] });
            queryClient.invalidateQueries({ queryKey: ['property-registry'] });

            // Reset form
            resetForm();

            // Call success callback
            onSuccess?.(receipt.rrsp_number);
        },
        onError: (error: Error) => {
            toast.error(`Failed to create return receipt: ${error.message}`);
        }
    });

    const resetForm = () => {
        setEntityName('');
        setFundCluster('');
        setRrspDate(new Date().toISOString().split('T')[0]);
        setItems([{
            description: '',
            quantity: 0,
            ics_no: '',
            end_user: '',
            remarks: ''
        }]);
        setReturnedByName('');
        setReturnedByDate('');
        setReceivedByName('');
        setReceivedByPosition('');
        setReceivedByDate('');
    };

    // Item management
    const addItem = () => {
        setItems([...items, {
            description: '',
            quantity: 0,
            ics_no: '',
            end_user: '',
            remarks: ''
        }]);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        } else {
            toast.error('At least one item is required');
        }
    };

    const updateItem = (index: number, field: keyof ReturnReceiptItem, value: string | number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    // Form validation
    const validateForm = (): boolean => {
        if (!entityName.trim()) {
            toast.error('Entity name is required');
            return false;
        }

        if (!rrspDate) {
            toast.error('RRSP date is required');
            return false;
        }

        if (!returnedByName.trim()) {
            toast.error('Returned by name is required');
            return false;
        }

        if (!receivedByName.trim()) {
            toast.error('Received by name is required');
            return false;
        }

        // Validate items
        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            if (!item.description.trim()) {
                toast.error(`Item ${i + 1}: Description is required`);
                return false;
            }

            if (!item.quantity || item.quantity <= 0) {
                toast.error(`Item ${i + 1}: Quantity must be greater than 0`);
                return false;
            }

            if (!item.ics_no.trim()) {
                toast.error(`Item ${i + 1}: ICS No. is required`);
                return false;
            }

            if (!item.end_user.trim()) {
                toast.error(`Item ${i + 1}: End user is required`);
                return false;
            }
        }

        return true;
    };

    // Form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        createMutation.mutate({
            entity_name: entityName,
            fund_cluster: fundCluster || undefined,
            rrsp_date: rrspDate,
            items,
            returned_by_name: returnedByName,
            returned_by_date: returnedByDate || undefined,
            received_by_name: receivedByName,
            received_by_position: receivedByPosition || undefined,
            received_by_date: receivedByDate || undefined
        });
    };

    return (
        <Card className="max-w-5xl mx-auto">
            <CardHeader>
                <CardTitle className="text-2xl">Receipt of Returned Semi-Expendable Property (RRSP)</CardTitle>
                <p className="text-sm text-muted-foreground">Annex A.6 - Acknowledge return of property from end users</p>
            </CardHeader>

            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Header Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                        <div className="space-y-2">
                            <Label htmlFor="entityName">Entity Name *</Label>
                            <Input
                                id="entityName"
                                value={entityName}
                                onChange={(e) => setEntityName(e.target.value)}
                                placeholder="e.g., Department of Example"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="fundCluster">Fund Cluster</Label>
                            <Input
                                id="fundCluster"
                                value={fundCluster}
                                onChange={(e) => setFundCluster(e.target.value)}
                                placeholder="e.g., 01"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="rrspDate">RRSP Date *</Label>
                            <Input
                                id="rrspDate"
                                type="date"
                                value={rrspDate}
                                onChange={(e) => setRrspDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Items Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Returned Items</h3>
                            <Button type="button" onClick={addItem} size="sm" variant="outline">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Item
                            </Button>
                        </div>

                        {items.map((item, index) => (
                            <div key={index} className="p-4 border rounded-lg space-y-4 bg-card">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium">Item {index + 1}</h4>
                                    {items.length > 1 && (
                                        <Button
                                            type="button"
                                            onClick={() => removeItem(index)}
                                            size="sm"
                                            variant="destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Description *</Label>
                                        <Textarea
                                            value={item.description}
                                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                                            placeholder="Brief description of the returned item"
                                            rows={2}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Quantity *</Label>
                                        <Input
                                            type="number"
                                            value={item.quantity || ''}
                                            onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                                            placeholder="0"
                                            min="1"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>ICS No. *</Label>
                                        <Input
                                            value={item.ics_no}
                                            onChange={(e) => updateItem(index, 'ics_no', e.target.value)}
                                            placeholder="e.g., 2024-01-001"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>End User *</Label>
                                        <Input
                                            value={item.end_user}
                                            onChange={(e) => updateItem(index, 'end_user', e.target.value)}
                                            placeholder="Name of end user returning the item"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Remarks</Label>
                                        <Input
                                            value={item.remarks || ''}
                                            onChange={(e) => updateItem(index, 'remarks', e.target.value)}
                                            placeholder="Optional remarks"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Signatures Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-muted/50">
                        {/* Returned By */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg border-b pb-2">Returned By (End User)</h3>

                            <div className="space-y-2">
                                <Label htmlFor="returnedByName">Name *</Label>
                                <Input
                                    id="returnedByName"
                                    value={returnedByName}
                                    onChange={(e) => setReturnedByName(e.target.value)}
                                    placeholder="Signature over printed name"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="returnedByDate">Date</Label>
                                <Input
                                    id="returnedByDate"
                                    type="date"
                                    value={returnedByDate}
                                    onChange={(e) => setReturnedByDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Received By */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg border-b pb-2">Received By (Property Division)</h3>

                            <div className="space-y-2">
                                <Label htmlFor="receivedByName">Name *</Label>
                                <Input
                                    id="receivedByName"
                                    value={receivedByName}
                                    onChange={(e) => setReceivedByName(e.target.value)}
                                    placeholder="Head, Property and/or Supply Division"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="receivedByPosition">Position/Office</Label>
                                <Input
                                    id="receivedByPosition"
                                    value={receivedByPosition}
                                    onChange={(e) => setReceivedByPosition(e.target.value)}
                                    placeholder="e.g., Property Custodian"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="receivedByDate">Date</Label>
                                <Input
                                    id="receivedByDate"
                                    type="date"
                                    value={receivedByDate}
                                    onChange={(e) => setReceivedByDate(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={resetForm}
                            disabled={createMutation.isPending}
                        >
                            Reset
                        </Button>
                        <Button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="min-w-32"
                        >
                            {createMutation.isPending ? (
                                <>Saving...</>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Create RRSP
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
};
