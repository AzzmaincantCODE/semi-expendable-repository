import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Loader2, Printer, Eye, RotateCcw, AlertTriangle, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { returnService } from "@/services/returnService";
import { formatReturnItemDescription } from "@/lib/returnItemDescription";
import { CustodianSelector } from "@/components/ui/custodian-selector";
import { ReturnReceiptReport } from "@/components/reports/ReturnReceiptReport";
import { ReturnRRSPPrintPage, RRSP_PRINT_STYLES } from "@/components/reports/ReturnRRSPPrintLayout";
import { PrintDocumentLayout, PrintLayoutHint } from "@/components/print/PrintDocumentLayout";
import { printDocument } from "@/lib/printDocument";
import { PRINT_LAYOUT } from "@/lib/printLayouts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AnnexReturnSlip, 
  CreateReturnSlipRequest 
} from "@/types/annex";

export const ReturnsAnnex = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<AnnexReturnSlip | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printSlip, setPrintSlip] = useState<AnnexReturnSlip | null>(null);

  useEffect(() => {
    if (printSlip) {
      const timer = setTimeout(() => {
        void printDocument(PRINT_LAYOUT.LONG_BOND_PORTRAIT_ZERO);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [printSlip]);
  
  // Selection state for creating a new return
  const [selectedInventoryItems, setSelectedInventoryItems] = useState<string[]>([]);
  const [itemRemarks, setItemRemarks] = useState<Record<string, string>>({});
  const [itemConditions, setItemConditions] = useState<Record<string, 'Serviceable' | 'Unserviceable' | 'For Repair' | 'Damaged' | 'Destroyed'>>({});
  const [returnForm, setReturnForm] = useState({
    entityName: "PROVINCIAL GOVERNMENT OF APAYAO",
    date: new Date().toISOString().split('T')[0],
    returnedBy: "",
    returnedByDesignation: "",
    receivedBy: "",
    receivedByDesignation: ""
  });

  const isEulReached = (dateAcquired: string | undefined, eul: string | null | undefined): boolean => {
    if (!dateAcquired || !eul) return false;
    const acquired = new Date(dateAcquired);
    if (isNaN(acquired.getTime())) return false;
    
    const match = eul.match(/(\d+)\s*(yr|year|month|mo)/i);
    if (!match) return false;
    
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    const expiry = new Date(acquired);
    if (unit.startsWith('y')) {
      expiry.setFullYear(expiry.getFullYear() + value);
    } else if (unit.startsWith('m')) {
      expiry.setMonth(expiry.getMonth() + value);
    }
    
    return expiry <= new Date();
  };

  // Fetch return slips
  const { data: slips = [], isLoading } = useQuery({
    queryKey: ['annex-return-slips'],
    queryFn: () => returnService.getReturnSlips(),
  });

  // Fetch inventory items currently assigned (eligible for return)
  const { data: assignedItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ['assigned-inventory-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('assignment_status', 'Assigned');
      if (error) throw error;
      return data || [];
    }
  });

  const createReturnMutation = useMutation({
    mutationFn: (request: CreateReturnSlipRequest) => returnService.createReturnSlip(request),
    onSuccess: () => {
      toast({ title: "Success", description: "Return receipt created successfully" });
      setIsCreating(false);
      setSelectedInventoryItems([]);
      setItemRemarks({});
      queryClient.invalidateQueries({ queryKey: ['annex-return-slips'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleCreateReturn = () => {
    if (!returnForm.returnedBy || !returnForm.receivedBy) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (selectedInventoryItems.length === 0) {
      toast({ title: "Error", description: "Please select at least one item to return", variant: "destructive" });
      return;
    }

    createReturnMutation.mutate({
      ...returnForm,
      inventoryItemIds: selectedInventoryItems,
      remarksByItemId: itemRemarks,
      conditionsByItemId: itemConditions
    });
  };

  const filteredSlips = slips.filter(slip => 
    slip.rrspNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    slip.returnedBy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    slip.entityName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredItems = assignedItems.filter((item: any) => {
    const matchesSearch = 
      item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.property_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.custodian?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <RotateCcw className="h-8 w-8 text-orange-500" />
          Receipt of Returned Property (RRSP)
        </h1>
        <Button onClick={() => setIsCreating(true)} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700">
          <Plus className="h-4 w-4" />
          Record Return
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search return receipts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Returns</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RRSP No.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Returned By</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSlips.map((slip) => (
                  <TableRow key={slip.id}>
                    <TableCell className="font-mono font-medium">{slip.rrspNumber}</TableCell>
                    <TableCell>{new Date(slip.date).toLocaleDateString()}</TableCell>
                    <TableCell>{slip.returnedBy}</TableCell>
                    <TableCell>{slip.items?.length || 0} items</TableCell>
                    <TableCell>
                      <Badge variant={slip.status === 'Completed' ? 'default' : 'secondary'}>
                        {slip.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedSlip(slip)}>
                        <Eye className="h-4 w-4 mr-1" /> View
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setPrintSlip(slip)}>
                        <Printer className="h-4 w-4 mr-1" /> Print
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Return Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Record Property Return (RRSP)</DialogTitle>
            <DialogDescription>Select the items being returned and fill in the details.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 pt-2">
            <div className="grid grid-cols-2 gap-6 p-4 bg-secondary/20 rounded-lg border border-border">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Entity Name</label>
                  <Input value={returnForm.entityName} onChange={e => setReturnForm({...returnForm, entityName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Date of Return</label>
                  <Input type="date" value={returnForm.date} onChange={e => setReturnForm({...returnForm, date: e.target.value})} />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Returned By (End User)</label>
                  <CustodianSelector 
                    value={returnForm.returnedBy}
                    onlyActive={false}
                    resultLimit={100}
                    onChange={(name, custodian) => {
                      const designation = custodian?.position || "End User";
                      const office = custodian?.department_name || "";
                      const combined = office ? `${designation} - ${office}` : designation;
                      setReturnForm({
                        ...returnForm, 
                        returnedBy: name, 
                        returnedByDesignation: combined
                      });
                    }} 
                    placeholder="Select or enter name..."
                    label=""
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Received By (Supply Officer)</label>
                  <Input value={returnForm.receivedBy} onChange={e => setReturnForm({...returnForm, receivedBy: e.target.value})} placeholder="Name" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-wider">Select Items to Return</h3>
                <Badge variant="outline">{selectedInventoryItems.length} items selected</Badge>
              </div>
              
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Property No.</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>End-user</TableHead>
                      <TableHead>ICS No.</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item: any) => {
                      const eulReached = isEulReached(item.date_acquired, item.estimated_useful_life);
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Checkbox 
                              checked={selectedInventoryItems.includes(item.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedInventoryItems([...selectedInventoryItems, item.id]);
                                  // Default to Unserviceable if EUL is reached to save time for user, otherwise Serviceable
                                  setItemConditions(prev => ({
                                    ...prev,
                                    [item.id]: eulReached ? 'Unserviceable' : 'Serviceable'
                                  }));
                                } else {
                                  setSelectedInventoryItems(selectedInventoryItems.filter(id => id !== item.id));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs">{item.property_number}</TableCell>
                          <TableCell className="text-sm">
                            <div className="font-medium">
                              {formatReturnItemDescription({
                                description: item.description,
                                date_acquired: item.date_acquired,
                                unit_cost: item.unit_cost,
                                total_cost: item.total_cost,
                                quantity: item.quantity,
                              })}
                            </div>
                            {eulReached && (
                              <Badge variant="outline" className="mt-1 bg-amber-500/10 text-amber-600 border-amber-500/30 flex items-center gap-1 w-fit text-[10px] px-1.5 py-0 h-5">
                                <AlertTriangle className="h-3 w-3" /> EUL Reached ({item.estimated_useful_life})
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{item.custodian}</TableCell>
                          <TableCell className="text-xs font-mono">{item.ics_number}</TableCell>
                          <TableCell>
                            {selectedInventoryItems.includes(item.id) && (
                              <Select
                                value={itemConditions[item.id] || "Serviceable"}
                                onValueChange={(val: any) => setItemConditions({...itemConditions, [item.id]: val})}
                              >
                                <SelectTrigger className="h-8 text-xs w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Serviceable">Serviceable</SelectItem>
                                  <SelectItem value="Unserviceable">Unserviceable</SelectItem>
                                  <SelectItem value="For Repair">For Repair</SelectItem>
                                  <SelectItem value="Damaged">Damaged</SelectItem>
                                  <SelectItem value="Destroyed">Destroyed</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            {selectedInventoryItems.includes(item.id) && (
                              <Input 
                                size={1}
                                placeholder="Remarks..." 
                                className="h-8 text-xs" 
                                value={itemRemarks[item.id] || ""}
                                onChange={e => setItemRemarks({...itemRemarks, [item.id]: e.target.value})}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 border-t bg-secondary/10">
            <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateReturn} 
              disabled={createReturnMutation.isPending || selectedInventoryItems.length === 0}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {createReturnMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              Complete Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View/Print Dialog */}
      <Dialog open={!!selectedSlip || showPrintDialog} onOpenChange={() => {
        if (!showPrintDialog) setSelectedSlip(null);
        else setShowPrintDialog(false);
      }}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          {selectedSlip && (
            <>
              <div className="flex justify-end mb-4 gap-2 print:hidden">
                <Button onClick={() => setPrintSlip(selectedSlip)} className="bg-orange-600 hover:bg-orange-700">
                  <Printer className="h-4 w-4 mr-2" /> Print RRSP
                </Button>
              </div>
              <div className="border border-border p-4 shadow-sm bg-white rounded-md">
                <ReturnReceiptReport data={{
                  rrspNumber: selectedSlip.rrspNumber,
                  entityName: selectedSlip.entityName,
                  date: selectedSlip.date,
                  returnedBy: selectedSlip.returnedBy,
                  returnedByDesignation: selectedSlip.returnedByDesignation || "End User",
                  receivedBy: selectedSlip.receivedBy,
                  receivedByDesignation: selectedSlip.receivedByDesignation || "Property Officer",
                  items: selectedSlip.items.map(i => ({
                    itemDescription: i.itemDescription,
                    quantity: i.quantity,
                    icsNumber: i.icsNumber,
                    endUser: i.endUser,
                    remarks: i.remarks || ""
                  }))
                }} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Print Slip Portal */}
      {printSlip && createPortal(
        <PrintDocumentLayout
          layout={PRINT_LAYOUT.LONG_BOND_PORTRAIT_ZERO}
          className="print-portal-root fixed inset-0 z-[9999] overflow-y-auto bg-gray-100 print:static print:overflow-visible print:bg-white"
        >
          <style>{RRSP_PRINT_STYLES}</style>
          <div className="no-print fixed top-4 right-4 z-50 flex gap-2 pr-12 print:!hidden">
            <PrintLayoutHint layout={PRINT_LAYOUT.LONG_BOND_PORTRAIT_ZERO} />
            <span className="self-center font-sans text-xs text-amber-800">2 forms, 50% / 50%</span>
            <Button onClick={() => printDocument(PRINT_LAYOUT.LONG_BOND_PORTRAIT_ZERO)} className="gap-2 shadow-lg bg-orange-600 hover:bg-orange-700 text-white">
              <Printer className="h-4 w-4" /> Print RRSP (2 Copies)
            </Button>
            <Button variant="outline" onClick={() => setPrintSlip(null)} className="gap-2 shadow-lg bg-white">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </div>

          <div className="flex min-h-full items-start justify-center py-8 print:min-h-0 print:py-0">
            <ReturnRRSPPrintPage slip={printSlip} className="shadow-2xl print:shadow-none border border-gray-200 print:border-none" />
          </div>
        </PrintDocumentLayout>,
        document.body
      )}
    </div>
  );
};
