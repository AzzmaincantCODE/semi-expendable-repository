import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Printer, Search, Plus, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PrintDocumentLayout } from "@/components/print/PrintDocumentLayout";
import { printDocument } from "@/lib/printDocument";
import { PRINT_LAYOUT } from "@/lib/printLayouts";

interface PhysicalCountItem {
  propertyNumber: string;
  description: string;
  expectedQuantity: number;
  actualQuantity: number;
  condition: "Serviceable" | "For Repair" | "Unserviceable" | "Missing";
  location: string;
  remarks: string;
  variance: number;
}

interface PhysicalCount {
  id: string;
  countNumber: string;
  department: string;
  countDate: string;
  countType: "Annual" | "Quarterly" | "Special" | "Spot Check";
  status: "Planned" | "In Progress" | "Completed" | "Under Review";
  conductedBy: string[];
  witnessedBy: string;
  approvedBy: string;
  items: PhysicalCountItem[];
  totalExpected: number;
  totalActual: number;
  totalVariance: number;
  remarks: string;
}

export const PhysicalCount = () => {
  const [counts, setCounts] = useState<PhysicalCount[]>([]);
  const [selectedCount, setSelectedCount] = useState<PhysicalCount | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState<Partial<PhysicalCount>>({
    countNumber: "",
    department: "",
    countDate: "",
    countType: "Annual",
    status: "Planned",
    conductedBy: [""],
    witnessedBy: "",
    approvedBy: "",
    items: [{
      propertyNumber: "",
      description: "",
      expectedQuantity: 0,
      actualQuantity: 0,
      condition: "Serviceable",
      location: "",
      remarks: "",
      variance: 0
    }],
    remarks: ""
  });

  const calculateVariance = (expected: number, actual: number) => actual - expected;

  const handleCreateCount = () => {
    if (!formData.countNumber || !formData.department) {
      toast({
        title: "Error",
        description: "Please fill in required fields",
        variant: "destructive"
      });
      return;
    }

    const itemsWithVariance = formData.items?.map(item => ({
      ...item,
      variance: calculateVariance(item.expectedQuantity, item.actualQuantity)
    })) || [];

    const totalExpected = itemsWithVariance.reduce((sum, item) => sum + item.expectedQuantity, 0);
    const totalActual = itemsWithVariance.reduce((sum, item) => sum + item.actualQuantity, 0);
    const totalVariance = totalActual - totalExpected;

    const newCount: PhysicalCount = {
      id: Date.now().toString(),
      ...formData as PhysicalCount,
      items: itemsWithVariance,
      totalExpected,
      totalActual,
      totalVariance
    };

    setCounts([...counts, newCount]);
    setFormData({
      countNumber: "",
      department: "",
      countDate: "",
      countType: "Annual",
      status: "Planned",
      conductedBy: [""],
      witnessedBy: "",
      approvedBy: "",
      items: [{
        propertyNumber: "",
        description: "",
        expectedQuantity: 0,
        actualQuantity: 0,
        condition: "Serviceable",
        location: "",
        remarks: "",
        variance: 0
      }],
      remarks: ""
    });
    setIsCreating(false);
    toast({
      title: "Success",
      description: "Physical count record created successfully"
    });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...(formData.items || []), {
        propertyNumber: "",
        description: "",
        expectedQuantity: 0,
        actualQuantity: 0,
        condition: "Serviceable",
        location: "",
        remarks: "",
        variance: 0
      }]
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...(formData.items || [])];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    if (field === "expectedQuantity" || field === "actualQuantity") {
      const expected = field === "expectedQuantity" ? value : updatedItems[index].expectedQuantity;
      const actual = field === "actualQuantity" ? value : updatedItems[index].actualQuantity;
      updatedItems[index].variance = calculateVariance(expected, actual);
    }

    setFormData({ ...formData, items: updatedItems });
  };

  const removeItem = (index: number) => {
    const updatedItems = formData.items?.filter((_, i) => i !== index);
    setFormData({ ...formData, items: updatedItems });
  };

  const addConductor = () => {
    setFormData({
      ...formData,
      conductedBy: [...(formData.conductedBy || []), ""]
    });
  };

  const updateConductor = (index: number, value: string) => {
    const updated = [...(formData.conductedBy || [])];
    updated[index] = value;
    setFormData({ ...formData, conductedBy: updated });
  };

  const removeConductor = (index: number) => {
    const updated = formData.conductedBy?.filter((_, i) => i !== index);
    setFormData({ ...formData, conductedBy: updated });
  };

  const handleStatusUpdate = (countId: string, newStatus: PhysicalCount["status"]) => {
    setCounts(counts.map(count =>
      count.id === countId ? { ...count, status: newStatus } : count
    ));
    toast({
      title: "Success",
      description: `Physical count status updated to ${newStatus}`
    });
  };

  const handlePrint = (count: PhysicalCount) => {
    setSelectedCount(count);
    setShowPrintPreview(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Planned": return <Clock className="h-4 w-4" />;
      case "Completed": return <CheckCircle className="h-4 w-4" />;
      case "Under Review": return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Planned": return "secondary";
      case "In Progress": return "warning";
      case "Completed": return "success";
      case "Under Review": return "warning";
      default: return "secondary";
    }
  };

  const getVarianceColor = (variance: number) => {
    if (variance === 0) return "success";
    if (variance > 0) return "warning";
    return "destructive";
  };

  const filteredCounts = counts.filter(count => {
    const matchesSearch = count.countNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      count.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All" || count.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Physical Count of Semi-Expendable Property</h1>
        <Button onClick={() => setIsCreating(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Physical Count
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search physical counts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Status</SelectItem>
            <SelectItem value="Planned">Planned</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Under Review">Under Review</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Create Form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>Create Physical Count Record</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="countNumber">Count Number *</Label>
                <Input
                  id="countNumber"
                  value={formData.countNumber}
                  onChange={(e) => setFormData({ ...formData, countNumber: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="countDate">Count Date</Label>
                <Input
                  id="countDate"
                  type="date"
                  value={formData.countDate}
                  onChange={(e) => setFormData({ ...formData, countDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="department">Department *</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
              <div>
                <Label>Count Type</Label>
                <Select
                  value={formData.countType}
                  onValueChange={(value: any) => setFormData({ ...formData, countType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Annual">Annual</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="Special">Special</SelectItem>
                    <SelectItem value="Spot Check">Spot Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Conducted By */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Conducted By</Label>
                <Button type="button" onClick={addConductor} size="sm" variant="outline">
                  Add Person
                </Button>
              </div>

              {formData.conductedBy?.map((person, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <Input
                    placeholder="Name and Position"
                    value={person}
                    onChange={(e) => updateConductor(index, e.target.value)}
                  />
                  {formData.conductedBy && formData.conductedBy.length > 1 && (
                    <Button
                      type="button"
                      onClick={() => removeConductor(index)}
                      size="sm"
                      variant="destructive"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="witnessedBy">Witnessed By</Label>
                <Input
                  id="witnessedBy"
                  value={formData.witnessedBy}
                  onChange={(e) => setFormData({ ...formData, witnessedBy: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="approvedBy">Approved By</Label>
                <Input
                  id="approvedBy"
                  value={formData.approvedBy}
                  onChange={(e) => setFormData({ ...formData, approvedBy: e.target.value })}
                />
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Items</Label>
                <Button type="button" onClick={addItem} size="sm" variant="outline">
                  Add Item
                </Button>
              </div>

              <div className="space-y-2">
                {formData.items?.map((item, index) => (
                  <div key={index} className="grid grid-cols-8 gap-2 p-2 border rounded">
                    <Input
                      placeholder="Property #"
                      value={item.propertyNumber}
                      onChange={(e) => updateItem(index, "propertyNumber", e.target.value)}
                    />
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                    />
                    <Input
                      placeholder="Expected"
                      type="number"
                      value={item.expectedQuantity}
                      onChange={(e) => updateItem(index, "expectedQuantity", parseInt(e.target.value) || 0)}
                    />
                    <Input
                      placeholder="Actual"
                      type="number"
                      value={item.actualQuantity}
                      onChange={(e) => updateItem(index, "actualQuantity", parseInt(e.target.value) || 0)}
                    />
                    <Input
                      placeholder="Location"
                      value={item.location}
                      onChange={(e) => updateItem(index, "location", e.target.value)}
                    />
                    <Select
                      value={item.condition}
                      onValueChange={(value: any) => updateItem(index, "condition", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Serviceable">Serviceable</SelectItem>
                        <SelectItem value="For Repair">For Repair</SelectItem>
                        <SelectItem value="Unserviceable">Unserviceable</SelectItem>
                        <SelectItem value="Missing">Missing</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="text-center py-2">
                      <Badge variant={getVarianceColor(item.variance) as any}>
                        {item.variance > 0 ? '+' : ''}{item.variance}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      onClick={() => removeItem(index)}
                      size="sm"
                      variant="destructive"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="remarks">General Remarks</Label>
              <Textarea
                id="remarks"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCreateCount}>Create Count</Button>
              <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Counts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredCounts.map((count) => (
          <Card key={count.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{count.countNumber}</CardTitle>
                <Badge variant={getStatusColor(count.status) as any} className="flex items-center gap-1">
                  {getStatusIcon(count.status)}
                  {count.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><strong>Department:</strong> {count.department}</p>
                <p><strong>Type:</strong> {count.countType}</p>
                <p><strong>Date:</strong> {count.countDate}</p>
                <p><strong>Items:</strong> {count.items.length}</p>
                <div className="flex justify-between">
                  <span><strong>Expected:</strong> {count.totalExpected}</span>
                  <span><strong>Actual:</strong> {count.totalActual}</span>
                </div>
                <div className="flex items-center gap-2">
                  <strong>Variance:</strong>
                  <Badge variant={getVarianceColor(count.totalVariance) as any}>
                    {count.totalVariance > 0 ? '+' : ''}{count.totalVariance}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <Button
                  onClick={() => handlePrint(count)}
                  size="sm"
                  variant="outline"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Report
                </Button>

                {count.status !== "Completed" && (
                  <div className="flex gap-1">
                    {count.status === "Planned" && (
                      <Button
                        onClick={() => handleStatusUpdate(count.id, "In Progress")}
                        size="sm"
                        className="flex-1"
                      >
                        Start Count
                      </Button>
                    )}
                    {count.status === "In Progress" && (
                      <Button
                        onClick={() => handleStatusUpdate(count.id, "Under Review")}
                        size="sm"
                        className="flex-1"
                      >
                        Submit Review
                      </Button>
                    )}
                    {count.status === "Under Review" && (
                      <Button
                        onClick={() => handleStatusUpdate(count.id, "Completed")}
                        size="sm"
                        className="flex-1"
                      >
                        Complete
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Print Template via Portal */}
      {selectedCount && createPortal(
        <PrintDocumentLayout layout={PRINT_LAYOUT.A4_PORTRAIT} className="print-portal-root">
          <div ref={printRef} className="print-page-a4 flex flex-col justify-between text-black font-serif">
            <div className="text-center border-b-2 border-black pb-4 mb-6">
              <h1 className="text-2xl font-bold">REPORT ON THE PHYSICAL COUNT OF SEMI-EXPENDABLE PROPERTY</h1>
              <p className="text-lg font-bold">Count No: {selectedCount.countNumber}</p>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-6">
              <div>
                <h3 className="font-bold border-b border-black mb-2">COUNT DETAILS</h3>
                <div className="space-y-1">
                  <p><strong>Department:</strong> {selectedCount.department}</p>
                  <p><strong>Count Type:</strong> {selectedCount.countType}</p>
                  <p><strong>Date:</strong> {selectedCount.countDate}</p>
                  <p><strong>Status:</strong> {selectedCount.status}</p>
                </div>
              </div>
              <div>
                <h3 className="font-bold border-b border-black mb-2">SUMMARY</h3>
                <div className="space-y-1">
                  <p><strong>Total Expected:</strong> {selectedCount.totalExpected}</p>
                  <p><strong>Total Actual:</strong> {selectedCount.totalActual}</p>
                  <p><strong>Total Variance:</strong> {selectedCount.totalVariance > 0 ? '+' : ''}{selectedCount.totalVariance}</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-bold border-b border-black mb-2">CONDUCTED BY</h3>
              <div className="space-y-1">
                {selectedCount.conductedBy.map((person, index) => (
                  <p key={index}>• {person}</p>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <h3 className="font-bold border-b border-black mb-2">ITEMS COUNTED</h3>
              <table className="w-full border-collapse border border-black text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black p-1.5 text-left">Property Number</th>
                    <th className="border border-black p-1.5 text-left">Description</th>
                    <th className="border border-black p-1.5 text-center">Expected</th>
                    <th className="border border-black p-1.5 text-center">Actual</th>
                    <th className="border border-black p-1.5 text-center">Variance</th>
                    <th className="border border-black p-1.5 text-left">Condition</th>
                    <th className="border border-black p-1.5 text-left">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCount.items.map((item, index) => (
                    <tr key={index} className="h-9">
                      <td className="border border-black p-1.5">{item.propertyNumber}</td>
                      <td className="border border-black p-1.5">{item.description}</td>
                      <td className="border border-black p-1.5 text-center">{item.expectedQuantity}</td>
                      <td className="border border-black p-1.5 text-center">{item.actualQuantity}</td>
                      <td className="border border-black p-1.5 text-center">
                        {item.variance > 0 ? '+' : ''}{item.variance}
                      </td>
                      <td className="border border-black p-1.5">{item.condition}</td>
                      <td className="border border-black p-1.5">{item.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedCount.remarks && (
              <div className="mb-8">
                <h3 className="font-bold border-b border-black mb-2">REMARKS</h3>
                <p className="italic">{selectedCount.remarks}</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-8 text-center mt-12">
              <div>
                <div className="border-t border-black pt-2">
                  <p className="text-sm font-bold">Count Team Leader</p>
                  <p className="mt-8 font-medium">{selectedCount.conductedBy[0]}</p>
                </div>
              </div>
              <div>
                <div className="border-t border-black pt-2">
                  <p className="text-sm font-bold">Witnessed By</p>
                  <p className="mt-8 font-medium">{selectedCount.witnessedBy}</p>
                </div>
              </div>
              <div>
                <div className="border-t border-black pt-2">
                  <p className="text-sm font-bold">Approved By</p>
                  <p className="mt-8 font-medium">{selectedCount.approvedBy}</p>
                </div>
              </div>
            </div>
          </div>
        </PrintDocumentLayout>,
        document.body
      )}

      <Dialog open={showPrintPreview} onOpenChange={setShowPrintPreview}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Physical Count Report Preview</DialogTitle>
            <DialogDescription>
              Verify the physical count details before printing.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-center bg-muted/30 p-4 rounded-lg overflow-auto">
            {selectedCount && (
              <div className="w-[210mm] bg-white p-8 shadow-sm text-black">
                {/* Simplified preview for the dialog */}
                <div className="text-center border-b-2 border-black pb-4 mb-6">
                  <h1 className="text-xl font-bold">REPORT ON THE PHYSICAL COUNT OF SEMI-EXPENDABLE PROPERTY</h1>
                  <p className="text-lg">Count No: {selectedCount.countNumber}</p>
                </div>
                {/* ... rest of the layout ... */}
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <p><strong>Department:</strong> {selectedCount.department}</p>
                  <p><strong>Date:</strong> {selectedCount.countDate}</p>
                </div>
                <table className="w-full border-collapse border border-black text-[10px]">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-black p-1">Property #</th>
                      <th className="border border-black p-1">Description</th>
                      <th className="border border-black p-1">Expected</th>
                      <th className="border border-black p-1">Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCount.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="border border-black p-1">{item.propertyNumber}</td>
                        <td className="border border-black p-1">{item.description}</td>
                        <td className="border border-black p-1 text-center">{item.expectedQuantity}</td>
                        <td className="border border-black p-1 text-center">{item.actualQuantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPrintPreview(false)}>
              Close
            </Button>
            <Button onClick={() => printDocument(PRINT_LAYOUT.A4_PORTRAIT)}>
              <Printer className="h-4 w-4 mr-2" />
              Print / Save as PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @media print {
          body > *:not(.print-portal-root) {
            display: none !important;
          }
          html, body {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
          .print-portal-root {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
};