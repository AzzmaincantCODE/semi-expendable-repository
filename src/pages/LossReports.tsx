import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Printer, Search, Plus, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PrintDocumentLayout } from "@/components/print/PrintDocumentLayout";
import { printDocument } from "@/lib/printDocument";
import { PRINT_LAYOUT } from "@/lib/printLayouts";

interface LossReportItem {
  propertyNumber: string;
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  dateAcquired: string;
  condition: "Lost" | "Stolen" | "Damaged" | "Destroyed";
  circumstances: string;
}

interface LossReport {
  id: string;
  reportNumber: string;
  department: string;
  reportDate: string;
  incidentDate: string;
  reportType: "Lost" | "Stolen" | "Damaged" | "Destroyed";
  status: "Draft" | "Submitted" | "Under Investigation" | "Approved" | "Rejected";
  reportedBy: string;
  investigatedBy: string;
  approvedBy: string;
  items: LossReportItem[];
  totalLossAmount: number;
  incidentDescription: string;
  actionsTaken: string;
  recommendations: string;
  attachments: string[];
}

export const LossReports = () => {
  const [reports, setReports] = useState<LossReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<LossReport | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState<Partial<LossReport>>({
    reportNumber: "",
    department: "",
    reportDate: "",
    incidentDate: "",
    reportType: "Lost",
    status: "Draft",
    reportedBy: "",
    investigatedBy: "",
    approvedBy: "",
    items: [{
      propertyNumber: "",
      description: "",
      quantity: 1,
      unitCost: 0,
      totalCost: 0,
      dateAcquired: "",
      condition: "Lost",
      circumstances: ""
    }],
    incidentDescription: "",
    actionsTaken: "",
    recommendations: "",
    attachments: []
  });

  const handleCreateReport = () => {
    if (!formData.reportNumber || !formData.department || !formData.reportType) {
      toast({
        title: "Error",
        description: "Please fill in required fields",
        variant: "destructive"
      });
      return;
    }

    const totalLossAmount = formData.items?.reduce((sum, item) => sum + item.totalCost, 0) || 0;

    const newReport: LossReport = {
      id: Date.now().toString(),
      ...formData as LossReport,
      totalLossAmount
    };

    setReports([...reports, newReport]);
    setFormData({
      reportNumber: "",
      department: "",
      reportDate: "",
      incidentDate: "",
      reportType: "Lost",
      status: "Draft",
      reportedBy: "",
      investigatedBy: "",
      approvedBy: "",
      items: [{
        propertyNumber: "",
        description: "",
        quantity: 1,
        unitCost: 0,
        totalCost: 0,
        dateAcquired: "",
        condition: "Lost",
        circumstances: ""
      }],
      incidentDescription: "",
      actionsTaken: "",
      recommendations: "",
      attachments: []
    });
    setIsCreating(false);
    toast({
      title: "Success",
      description: "Loss report created successfully"
    });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...(formData.items || []), {
        propertyNumber: "",
        description: "",
        quantity: 1,
        unitCost: 0,
        totalCost: 0,
        dateAcquired: "",
        condition: formData.reportType as any || "Lost",
        circumstances: ""
      }]
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...(formData.items || [])];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    if (field === "quantity" || field === "unitCost") {
      const quantity = field === "quantity" ? value : updatedItems[index].quantity;
      const unitCost = field === "unitCost" ? value : updatedItems[index].unitCost;
      updatedItems[index].totalCost = quantity * unitCost;
    }
    
    setFormData({ ...formData, items: updatedItems });
  };

  const removeItem = (index: number) => {
    const updatedItems = formData.items?.filter((_, i) => i !== index);
    setFormData({ ...formData, items: updatedItems });
  };

  const handleStatusUpdate = (reportId: string, newStatus: LossReport["status"]) => {
    setReports(reports.map(report => 
      report.id === reportId ? { ...report, status: newStatus } : report
    ));
    toast({
      title: "Success",
      description: `Report status updated to ${newStatus}`
    });
  };

  const handlePrint = (report: LossReport) => {
    setSelectedReport(report);
    setShowPrintPreview(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Draft": return <Clock className="h-4 w-4" />;
      case "Under Investigation": return <AlertTriangle className="h-4 w-4" />;
      case "Approved": return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Draft": return "secondary";
      case "Submitted": return "warning";
      case "Under Investigation": return "warning";
      case "Approved": return "success";
      case "Rejected": return "destructive";
      default: return "secondary";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Lost": return "warning";
      case "Stolen": return "destructive";
      case "Damaged": return "secondary";
      case "Destroyed": return "destructive";
      default: return "secondary";
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.reportNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All" || report.status === statusFilter;
    const matchesType = typeFilter === "All" || report.reportType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Loss/Damage Reports</h1>
        <Button onClick={() => setIsCreating(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create New Report
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search reports..."
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
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Submitted">Submitted</SelectItem>
            <SelectItem value="Under Investigation">Under Investigation</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Types</SelectItem>
            <SelectItem value="Lost">Lost</SelectItem>
            <SelectItem value="Stolen">Stolen</SelectItem>
            <SelectItem value="Damaged">Damaged</SelectItem>
            <SelectItem value="Destroyed">Destroyed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Create Form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>Create Loss/Damage Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reportNumber">Report Number *</Label>
                <Input
                  id="reportNumber"
                  value={formData.reportNumber}
                  onChange={(e) => setFormData({...formData, reportNumber: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="reportDate">Report Date</Label>
                <Input
                  id="reportDate"
                  type="date"
                  value={formData.reportDate}
                  onChange={(e) => setFormData({...formData, reportDate: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="department">Department *</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({...formData, department: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="incidentDate">Incident Date</Label>
                <Input
                  id="incidentDate"
                  type="date"
                  value={formData.incidentDate}
                  onChange={(e) => setFormData({...formData, incidentDate: e.target.value})}
                />
              </div>
              <div>
                <Label>Report Type *</Label>
                <Select
                  value={formData.reportType}
                  onValueChange={(value: any) => setFormData({...formData, reportType: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Lost">Lost</SelectItem>
                    <SelectItem value="Stolen">Stolen</SelectItem>
                    <SelectItem value="Damaged">Damaged</SelectItem>
                    <SelectItem value="Destroyed">Destroyed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="incidentDescription">Incident Description</Label>
              <Textarea
                id="incidentDescription"
                value={formData.incidentDescription}
                onChange={(e) => setFormData({...formData, incidentDescription: e.target.value})}
                placeholder="Describe what happened, when, where, and circumstances"
              />
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Affected Items</Label>
                <Button type="button" onClick={addItem} size="sm" variant="outline">
                  Add Item
                </Button>
              </div>
              
              <div className="space-y-2">
                {formData.items?.map((item, index) => (
                  <div key={index} className="grid grid-cols-7 gap-2 p-2 border rounded">
                    <Input
                      placeholder="Property Number"
                      value={item.propertyNumber}
                      onChange={(e) => updateItem(index, "propertyNumber", e.target.value)}
                    />
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                    />
                    <Input
                      placeholder="Qty"
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 0)}
                    />
                    <Input
                      placeholder="Unit Cost"
                      type="number"
                      step="0.01"
                      value={item.unitCost}
                      onChange={(e) => updateItem(index, "unitCost", parseFloat(e.target.value) || 0)}
                    />
                    <Input
                      placeholder="Total Cost"
                      type="number"
                      value={item.totalCost}
                      readOnly
                      className="bg-muted"
                    />
                    <Select
                      value={item.condition}
                      onValueChange={(value: any) => updateItem(index, "condition", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Lost">Lost</SelectItem>
                        <SelectItem value="Stolen">Stolen</SelectItem>
                        <SelectItem value="Damaged">Damaged</SelectItem>
                        <SelectItem value="Destroyed">Destroyed</SelectItem>
                      </SelectContent>
                    </Select>
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
              <Label htmlFor="actionsTaken">Actions Taken</Label>
              <Textarea
                id="actionsTaken"
                value={formData.actionsTaken}
                onChange={(e) => setFormData({...formData, actionsTaken: e.target.value})}
                placeholder="Describe immediate actions taken after the incident"
              />
            </div>

            <div>
              <Label htmlFor="recommendations">Recommendations</Label>
              <Textarea
                id="recommendations"
                value={formData.recommendations}
                onChange={(e) => setFormData({...formData, recommendations: e.target.value})}
                placeholder="Recommendations to prevent similar incidents"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="reportedBy">Reported By</Label>
                <Input
                  id="reportedBy"
                  value={formData.reportedBy}
                  onChange={(e) => setFormData({...formData, reportedBy: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="investigatedBy">Investigated By</Label>
                <Input
                  id="investigatedBy"
                  value={formData.investigatedBy}
                  onChange={(e) => setFormData({...formData, investigatedBy: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="approvedBy">Approved By</Label>
                <Input
                  id="approvedBy"
                  value={formData.approvedBy}
                  onChange={(e) => setFormData({...formData, approvedBy: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCreateReport}>Create Report</Button>
              <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reports List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredReports.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{report.reportNumber}</CardTitle>
                <div className="flex flex-col gap-1">
                  <Badge variant={getStatusColor(report.status) as any} className="flex items-center gap-1">
                    {getStatusIcon(report.status)}
                    {report.status}
                  </Badge>
                  <Badge variant={getTypeColor(report.reportType) as any}>
                    {report.reportType}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><strong>Department:</strong> {report.department}</p>
                <p><strong>Incident Date:</strong> {report.incidentDate}</p>
                <p><strong>Items Affected:</strong> {report.items.length}</p>
                <p><strong>Total Loss:</strong> ₱{report.totalLossAmount.toLocaleString()}</p>
                <p><strong>Reported By:</strong> {report.reportedBy}</p>
              </div>
              
              <div className="flex flex-col gap-2 mt-4">
                <Button
                  onClick={() => handlePrint(report)}
                  size="sm"
                  variant="outline"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Report
                </Button>
                
                {report.status !== "Approved" && report.status !== "Rejected" && (
                  <div className="flex gap-1">
                    {report.status === "Draft" && (
                      <Button
                        onClick={() => handleStatusUpdate(report.id, "Submitted")}
                        size="sm"
                        className="flex-1"
                      >
                        Submit
                      </Button>
                    )}
                    {report.status === "Submitted" && (
                      <Button
                        onClick={() => handleStatusUpdate(report.id, "Under Investigation")}
                        size="sm"
                        className="flex-1"
                      >
                        Investigate
                      </Button>
                    )}
                    {report.status === "Under Investigation" && (
                      <div className="flex gap-1">
                        <Button
                          onClick={() => handleStatusUpdate(report.id, "Approved")}
                          size="sm"
                          className="flex-1"
                        >
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleStatusUpdate(report.id, "Rejected")}
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Print Template via Portal */}
      {selectedReport && createPortal(
        <PrintDocumentLayout layout={PRINT_LAYOUT.A4_PORTRAIT} className="print-portal-root">
          <div ref={printRef} className="print-page-a4 flex flex-col justify-between text-black font-serif">
            <div className="text-center border-b-2 border-black pb-4 mb-6">
              <h1 className="text-2xl font-bold">REPORT OF {selectedReport.reportType.toUpperCase()}, STOLEN, DAMAGED OR DESTROYED PROPERTY</h1>
              <p className="text-lg font-bold">Report No: {selectedReport.reportNumber}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-8 mb-6">
              <div>
                <h3 className="font-bold border-b border-black mb-2">REPORT DETAILS</h3>
                <div className="space-y-1">
                  <p><strong>Department:</strong> {selectedReport.department}</p>
                  <p><strong>Report Type:</strong> {selectedReport.reportType}</p>
                  <p><strong>Report Date:</strong> {selectedReport.reportDate}</p>
                  <p><strong>Incident Date:</strong> {selectedReport.incidentDate}</p>
                </div>
              </div>
              <div>
                <h3 className="font-bold border-b border-black mb-2">PERSONNEL</h3>
                <div className="space-y-1">
                  <p><strong>Reported By:</strong> {selectedReport.reportedBy}</p>
                  <p><strong>Investigated By:</strong> {selectedReport.investigatedBy}</p>
                  <p><strong>Approved By:</strong> {selectedReport.approvedBy}</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-bold border-b border-black mb-2">INCIDENT DESCRIPTION</h3>
              <p className="text-justify italic">{selectedReport.incidentDescription}</p>
            </div>

            <div className="mb-8">
              <h3 className="font-bold border-b border-black mb-2">AFFECTED ITEMS</h3>
              <table className="w-full border-collapse border border-black text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black p-2 text-left">Property Number</th>
                    <th className="border border-black p-2 text-left">Description</th>
                    <th className="border border-black p-2 text-center">Qty</th>
                    <th className="border border-black p-2 text-right">Unit Cost</th>
                    <th className="border border-black p-2 text-right">Total Cost</th>
                    <th className="border border-black p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReport.items.map((item, index) => (
                    <tr key={index} className="h-9">
                      <td className="border border-black p-2">{item.propertyNumber}</td>
                      <td className="border border-black p-2">{item.description}</td>
                      <td className="border border-black p-2 text-center">{item.quantity}</td>
                      <td className="border border-black p-2 text-right">₱{item.unitCost.toLocaleString()}</td>
                      <td className="border border-black p-2 text-right">₱{item.totalCost.toLocaleString()}</td>
                      <td className="border border-black p-2 text-center">{item.condition}</td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-gray-100">
                    <td colSpan={4} className="border border-black p-2 text-right">TOTAL LOSS AMOUNT:</td>
                    <td className="border border-black p-2 text-right">₱{selectedReport.totalLossAmount.toLocaleString()}</td>
                    <td className="border border-black p-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mb-6">
              <h3 className="font-bold border-b border-black mb-2">ACTIONS TAKEN</h3>
              <p className="text-justify italic">{selectedReport.actionsTaken}</p>
            </div>

            <div className="mb-8">
              <h3 className="font-bold border-b border-black mb-2">RECOMMENDATIONS</h3>
              <p className="text-justify italic">{selectedReport.recommendations}</p>
            </div>
            
            <div className="grid grid-cols-3 gap-8 text-center mt-12">
              <div>
                <div className="border-t border-black pt-2">
                  <p className="text-sm font-bold">Reported By</p>
                  <p className="mt-8 font-medium">{selectedReport.reportedBy}</p>
                </div>
              </div>
              <div>
                <div className="border-t border-black pt-2">
                  <p className="text-sm font-bold">Investigated By</p>
                  <p className="mt-8 font-medium">{selectedReport.investigatedBy}</p>
                </div>
              </div>
              <div>
                <div className="border-t border-black pt-2">
                  <p className="text-sm font-bold">Approved By</p>
                  <p className="mt-8 font-medium">{selectedReport.approvedBy}</p>
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
            <DialogTitle>Loss Report Preview</DialogTitle>
            <DialogDescription>
              Verify the loss/damage details before printing.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-center bg-muted/30 p-4 rounded-lg overflow-auto">
            {selectedReport && (
              <div className="w-[210mm] bg-white p-8 shadow-sm text-black">
                <div className="text-center border-b-2 border-black pb-4 mb-6">
                  <h1 className="text-xl font-bold uppercase">REPORT OF {selectedReport.reportType}, STOLEN, DAMAGED OR DESTROYED PROPERTY</h1>
                  <p className="text-lg">Report No: {selectedReport.reportNumber}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <p><strong>Department:</strong> {selectedReport.department}</p>
                  <p><strong>Incident Date:</strong> {selectedReport.incidentDate}</p>
                </div>
                <table className="w-full border-collapse border border-black text-[10px]">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-black p-1 text-left">Property #</th>
                      <th className="border border-black p-1 text-left">Description</th>
                      <th className="border border-black p-1 text-center">Qty</th>
                      <th className="border border-black p-1 text-right">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReport.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="border border-black p-1">{item.propertyNumber}</td>
                        <td className="border border-black p-1">{item.description}</td>
                        <td className="border border-black p-1 text-center">{item.quantity}</td>
                        <td className="border border-black p-1 text-right">₱{item.totalCost.toLocaleString()}</td>
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