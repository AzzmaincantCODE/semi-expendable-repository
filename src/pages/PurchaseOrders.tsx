import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { purchaseOrderService } from "@/services/purchaseOrderService";
import { lookupService } from "@/services/lookupService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ClipboardList, Eye, CheckCircle2, XCircle, ArrowDownToLine, PackagePlus, Trash2, LayoutGrid, Pencil } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PurchaseOrderForm } from "@/components/procurement/PurchaseOrderForm";
import { StockInDialog } from "@/components/procurement/StockInDialog";
import { POItemsList } from "@/components/procurement/POItemsList";
import { POHistoryDialog } from "@/components/procurement/POHistoryDialog";
import { History } from "lucide-react";
import { useDataMode } from "@/offline/dataModeContext";

export const PurchaseOrders = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isOfflineMode } = useDataMode();
    const [isCreatePoOpen, setIsCreatePoOpen] = useState(false);
    const [selectedPoForStockIn, setSelectedPoForStockIn] = useState<any>(null);
    const [selectedPoForDetails, setSelectedPoForDetails] = useState<any>(null);
    const [selectedPoForHistory, setSelectedPoForHistory] = useState<any>(null);
    const [selectedPoForEdit, setSelectedPoForEdit] = useState<any>(null);

    const { data: pos, isLoading: loadingPos } = useQuery({
        queryKey: ['purchase-orders'],
        queryFn: () => purchaseOrderService.getAllPOs()
    });

    const createPoMutation = useMutation({
        mutationFn: async (data: any) => {
            const result = await purchaseOrderService.createPO(data, data.items);
            if (data.supplierId && data.address !== undefined) {
                try {
                    await lookupService.update('suppliers', data.supplierId, { address: data.address });
                } catch (err) {
                    console.error("Failed to update supplier address", err);
                }
            }
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
            toast.success("Purchase Order created successfully");
            localStorage.removeItem('po_form_data');
            setIsCreatePoOpen(false);
        },
        onError: (error: any) => toast.error(error.message)
    });

    const updatePoMutation = useMutation({
        mutationFn: async (data: any) => {
            const result = await purchaseOrderService.updatePO(selectedPoForEdit.id, data, data.items);
            if (data.supplierId && data.address !== undefined) {
                try {
                    await lookupService.update('suppliers', data.supplierId, { address: data.address });
                } catch (err) {
                    console.error("Failed to update supplier address", err);
                }
            }
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
            toast.success("Purchase Order updated successfully");
            setSelectedPoForEdit(null);
        },
        onError: (error: any) => toast.error(error.message)
    });

    const stockInMutation = useMutation({
        mutationFn: ({ poId, items }: { poId: string, items: any[] }) =>
            purchaseOrderService.stockInItems(poId, items),
        onSuccess: (data: any, variables: any) => {
            queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            toast.success(`Successfully added ${data.length} items to inventory!`);
            
            // Clear persistence for this specific PO
            if (variables?.poId) {
                localStorage.removeItem(`stock_in_quantities_${variables.poId}`);
                localStorage.removeItem(`stock_in_date_${variables.poId}`);
                localStorage.removeItem(`stock_in_legacy_mode_${variables.poId}`);
                localStorage.removeItem(`stock_in_legacy_numbers_${variables.poId}`);
            }
            
            setSelectedPoForStockIn(null);
        },
        onError: (error: any) => toast.error(error.message)
    });

    const deletePoMutation = useMutation({
        mutationFn: (id: string) => purchaseOrderService.deletePO(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
            toast.success("Purchase Order deleted");
        },
        onError: (error: any) => toast.error(`Failed to delete PO: ${error.message}`)
    });

    const handleDeletePO = (id: string, poNumber: string) => {
        if (window.confirm(`Are you sure you want to delete Purchase Order ${poNumber}? This will also delete all its associated items.`)) {
            deletePoMutation.mutate(id);
        }
    };

    const handleStockInClick = async (poId: string) => {
        try {
            const fullPo = await purchaseOrderService.getPOById(poId);
            setSelectedPoForStockIn(fullPo);
        } catch (error) {
            toast.error("Failed to load PO details");
        }
    };

    const handleViewItemsClick = async (poId: string) => {
        try {
            const fullPo = await purchaseOrderService.getPOById(poId);
            setSelectedPoForDetails(fullPo);
        } catch (error) {
            toast.error("Failed to load PO details");
        }
    };

    const handleEditClick = async (poId: string) => {
        try {
            const fullPo = await purchaseOrderService.getPOById(poId);
            const formData = {
                ...fullPo,
                items: fullPo.purchase_order_items?.map((i: any) => ({
                    id: i.id,
                    description: i.description,
                    quantity: i.quantity,
                    unit: i.unit,
                    unitCost: i.unitCost || i.unit_cost,
                    category: i.category || i.semi_expandable_category || '',
                    estimatedUsefulLife: i.estimatedUsefulLife || i.estimated_useful_life || '',
                    serialNumber: i.serialNumber || i.serial_number || ''
                })) || []
            };
            setSelectedPoForEdit(formData);
        } catch (error) {
            toast.error("Failed to load PO details for editing");
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Received':
                return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> {status}</Badge>;
            case 'Cancelled':
                return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> {status}</Badge>;
            case 'Partial':
                return <Badge className="bg-blue-500">Partial</Badge>;
            default:
                return <Badge variant="outline">Pending</Badge>;
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
                    <p className="text-muted-foreground">Manage procurement and ingest items directly into inventory</p>
                    {isOfflineMode && (
                        <Badge variant="outline" className="mt-2 border-amber-300 bg-amber-50 text-amber-700">
                            Read-only while offline
                        </Badge>
                    )}
                </div>
                <div className="flex gap-2">
                    <Dialog open={isCreatePoOpen} onOpenChange={setIsCreatePoOpen}>
                        <DialogTrigger asChild>
                            <Button disabled={isOfflineMode}>
                                <Plus className="w-4 h-4 mr-2" /> New Purchase Order
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Create Purchase Order</DialogTitle>
                                <DialogDescription>Enter PO details. Items must be under 50k for semi-expandable inventory.</DialogDescription>
                            </DialogHeader>
                            <PurchaseOrderForm
                                onSubmit={(data) => createPoMutation.mutate(data)}
                                onCancel={() => setIsCreatePoOpen(false)}
                                isLoading={createPoMutation.isPending}
                            />
                        </DialogContent>
                    </Dialog>

                    <Dialog open={!!selectedPoForEdit} onOpenChange={(open) => !open && setSelectedPoForEdit(null)}>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Edit Purchase Order</DialogTitle>
                                <DialogDescription>Modify PO details and update its items safely.</DialogDescription>
                            </DialogHeader>
                            {selectedPoForEdit && (
                                <PurchaseOrderForm
                                    initialData={selectedPoForEdit}
                                    onSubmit={(data) => updatePoMutation.mutate(data)}
                                    onCancel={() => setSelectedPoForEdit(null)}
                                    isLoading={updatePoMutation.isPending}
                                />
                            )}
                        </DialogContent>
                    </Dialog>

                    <Button variant="outline" onClick={() => navigate('/inventory')}>
                        <LayoutGrid className="w-4 h-4 mr-2" /> View Inventory
                    </Button>
                </div>
            </div>

            <Dialog open={!!selectedPoForDetails} onOpenChange={(open) => !open && setSelectedPoForDetails(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Purchase Order Items - #{selectedPoForDetails?.po_number}</DialogTitle>
                        <DialogDescription>List of items in this PO and their corresponding inventory records.</DialogDescription>
                    </DialogHeader>
                    {selectedPoForDetails && (
                        <POItemsList
                            poId={selectedPoForDetails.id}
                            poNumber={selectedPoForDetails.po_number || ''}
                            fundCluster={selectedPoForDetails.fund_cluster || '01'}
                            items={selectedPoForDetails.purchase_order_items || []}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={!!selectedPoForStockIn} onOpenChange={(open) => !open && setSelectedPoForStockIn(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Stock In to Inventory</DialogTitle>
                        <DialogDescription>Add items from PO #{selectedPoForStockIn?.po_number} into the system inventory.</DialogDescription>
                    </DialogHeader>
                    {selectedPoForStockIn && (
                        <StockInDialog
                            po={selectedPoForStockIn}
                            onSubmit={(items) => stockInMutation.mutate({ poId: selectedPoForStockIn.id, items })}
                            onCancel={() => setSelectedPoForStockIn(null)}
                            isLoading={stockInMutation.isPending}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {selectedPoForHistory && (
                <POHistoryDialog
                    poId={selectedPoForHistory.id}
                    poNumber={selectedPoForHistory.po_number}
                    isOpen={!!selectedPoForHistory}
                    onOpenChange={(open) => !open && setSelectedPoForHistory(null)}
                />
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Recent Purchase Orders</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>PO Number</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Supplier</TableHead>
                                <TableHead>Office</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingPos ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
                            ) : pos?.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8">No purchase orders found.</TableCell></TableRow>
                            ) : (
                                pos?.map((po: any) => (
                                    <TableRow key={po.id}>
                                        <TableCell className="font-medium">{po.po_number}</TableCell>
                                        <TableCell>{format(new Date(po.po_date), "MMM dd, yyyy")}</TableCell>
                                        <TableCell>{po.suppliers?.name || "N/A"}</TableCell>
                                        <TableCell>{po.office || "N/A"}</TableCell>
                                        <TableCell>{getStatusBadge(po.status)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="outline" size="sm" onClick={() => setSelectedPoForHistory(po)} title="View History">
                                                    <History className="w-4 h-4 mr-1" /> History
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => handleEditClick(po.id)} disabled={isOfflineMode}>
                                                    <Pencil className="w-4 h-4 mr-1" /> Edit
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => handleStockInClick(po.id)} disabled={isOfflineMode}>
                                                    <ArrowDownToLine className="w-4 h-4 mr-1" /> Stock In
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => handleViewItemsClick(po.id)}>
                                                    <ClipboardList className="w-4 h-4 mr-1" /> Items
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => navigate(`/purchase-orders/${po.id}/print`)}>
                                                    <Eye className="w-4 h-4 mr-1" /> Print
                                                </Button>
                                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeletePO(po.id, po.po_number)} disabled={isOfflineMode}>
                                                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};
