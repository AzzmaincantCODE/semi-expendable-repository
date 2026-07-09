import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Package, 
  DollarSign, 
  Calendar, 
  FileText,
  Download,
  Building2,
  User
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { custodianService, CustodianSummary, CustodianItemHistory } from "@/services/custodianService";
import { format } from "date-fns";

interface CustodianReportProps {
  data?: any;
}

export const CustodianReport = ({ data }: CustodianReportProps) => {
  const [selectedCustodian, setSelectedCustodian] = useState<string>("");
  const [includeReturned, setIncludeReturned] = useState(false);

  // Fetch all custodian summaries
  const { data: summaries = [], isLoading: summariesLoading } = useQuery({
    queryKey: ['custodian-summaries'],
    queryFn: () => custodianService.getAllSummaries(),
    enabled: true
  });

  // Fetch detailed item history for selected custodian
  const { data: itemHistory = [] } = useQuery({
    queryKey: ['custodian-item-history', selectedCustodian, includeReturned],
    queryFn: () => custodianService.getItemHistory(selectedCustodian, { includeReturned }),
    enabled: !!selectedCustodian
  });

  const selectedCustodianData = summaries.find(s => s.custodian.id === selectedCustodian);

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Exporting custodian report...');
  };

  if (summariesLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading custodian data...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Custodian Information Report
          </h1>
          <p className="text-muted-foreground">
            Comprehensive report showing all items and records for each custodian
          </p>
        </div>
        <Button onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Custodians</p>
                <p className="text-2xl font-bold">{summaries.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Items Assigned</p>
                <p className="text-2xl font-bold">
                  {summaries.reduce((sum, s) => sum + s.total_items_assigned, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Value Assigned</p>
                <p className="text-2xl font-bold">
                  ₱{summaries.reduce((sum, s) => sum + s.total_value_assigned, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Currently Assigned</p>
                <p className="text-2xl font-bold">
                  {summaries.reduce((sum, s) => sum + s.currently_assigned_items, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Custodian List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                All Custodians
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {summaries.map((summary) => (
                  <div
                    key={summary.custodian.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedCustodian === summary.custodian.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-secondary'
                    }`}
                    onClick={() => setSelectedCustodian(summary.custodian.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{summary.custodian.name}</p>
                        <p className="text-sm opacity-75">{summary.custodian.custodian_no}</p>
                      </div>
                      <Badge variant={summary.custodian.is_active ? "default" : "secondary"}>
                        {summary.currently_assigned_items}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs opacity-75">
                      <p>{summary.custodian.department_name || 'No Department'}</p>
                      <p>₱{summary.currently_assigned_value.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Custodian Details */}
        <div className="lg:col-span-2">
          {selectedCustodianData ? (
            <div className="space-y-6">
              {/* Custodian Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{selectedCustodianData.custodian.name}</span>
                    <Badge variant={selectedCustodianData.custodian.is_active ? "default" : "secondary"}>
                      {selectedCustodianData.custodian.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Custodian Number</label>
                      <p className="font-mono">{selectedCustodianData.custodian.custodian_no}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Position</label>
                      <p>{selectedCustodianData.custodian.position || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Department</label>
                      <p>{selectedCustodianData.custodian.department_name || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Last Activity</label>
                      <p>
                        {selectedCustodianData.last_activity_date 
                          ? format(new Date(selectedCustodianData.last_activity_date), 'MMM dd, yyyy')
                          : 'No activity'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-sm text-muted-foreground">Current Items</p>
                        <p className="text-2xl font-bold">{selectedCustodianData.currently_assigned_items}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm text-muted-foreground">Current Value</p>
                        <p className="text-2xl font-bold">₱{selectedCustodianData.currently_assigned_value.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-orange-600" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Items</p>
                        <p className="text-2xl font-bold">{selectedCustodianData.total_items_assigned}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-purple-600" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Value</p>
                        <p className="text-2xl font-bold">₱{selectedCustodianData.total_value_assigned.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Item History */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Item History</span>
                    <div className="flex items-center gap-2">
                      <Select value={includeReturned ? "all" : "current"} onValueChange={(value) => setIncludeReturned(value === "all")}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="current">Current Only</SelectItem>
                          <SelectItem value="all">All History</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {itemHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No item history found for this custodian.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Property Number</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Condition</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Slip Number</TableHead>
                          <TableHead>Date Issued</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itemHistory.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">{item.property_number}</TableCell>
                            <TableCell>{item.description}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.category}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.condition === 'Serviceable' ? 'default' : 'destructive'}>
                                {item.condition}
                              </Badge>
                            </TableCell>
                            <TableCell>₱{item.total_cost.toLocaleString()}</TableCell>
                            <TableCell className="font-mono">{item.custodian_slip_number}</TableCell>
                            <TableCell>
                              {item.date_issued ? format(new Date(item.date_issued), 'MMM dd, yyyy') : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.is_currently_assigned ? 'default' : 'secondary'}>
                                {item.is_currently_assigned ? 'Currently Assigned' : 'Returned'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  Select a custodian from the list to view detailed information
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
