import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SemiExpendablePropertyCard } from './SemiExpendablePropertyCard';
import { PropertyLedgerCard } from './PropertyLedgerCard';
import { InventoryCustodianSlipReport } from './InventoryCustodianSlipReport';
import { TransferReport } from './TransferReport';
import { PhysicalCountReport } from './PhysicalCountReport';
import { LossReport } from './LossReport';
import { UnserviceableReport } from './UnserviceableReport';
import { CustodianReport } from './CustodianReport';
import { supabaseService } from '@/services/supabaseService';
import { Loader2 } from 'lucide-react';

interface ReportGeneratorProps {
  reportType: string;
  reportName: string;
  trigger?: React.ReactNode;
}

export const ReportGenerator: React.FC<ReportGeneratorProps> = ({ reportType, reportName, trigger }) => {
  const [selectedData, setSelectedData] = useState<string>('live');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);

    try {
      switch (reportType) {
        case "Inventory Summary":
        case "Property Card":
          // Fetch property cards from database
          const propertyCardsResponse = await supabaseService.propertyCards.getAll({ limit: 1 });
          if (propertyCardsResponse.success && propertyCardsResponse.data.length > 0) {
            const card = propertyCardsResponse.data[0];
            const entriesResponse = await supabaseService.propertyCards.getEntries(card.id);
            setReportData({
              ...card,
              entries: entriesResponse.data || []
            });
          }
          break;

        case "Property Ledger":
          // Fetch inventory items for ledger
          const inventoryResponse = await supabaseService.inventory.getAll({ limit: 1 });
          if (inventoryResponse.success && inventoryResponse.data.length > 0) {
            const item = inventoryResponse.data[0];
            setReportData({
              propertyNumber: item.propertyNumber,
              description: item.description,
              unit: item.unitOfMeasure,
              entries: [
                {
                  date: item.dateAcquired,
                  referenceNumber: "INITIAL",
                  received: item.quantity,
                  issued: 0,
                  balance: item.quantity,
                  recipient: "Stock Inventory"
                }
              ]
            });
          }
          break;

        case "Custodian Report":
          setError("Custodian reports not available");
          break;

        case "Transfer Report":
          // Fetch transfer reports
          const transferResponse = await supabaseService.transfers.getAll({ limit: 1 });
          if (transferResponse.success && transferResponse.data.length > 0) {
            const transfer = transferResponse.data[0];
            const transferItemsResponse = await supabaseService.transfers.getById(transfer.id);
            if (transferItemsResponse.success && transferItemsResponse.data) {
              setReportData(transferItemsResponse.data);
            }
          }
          break;

        case "Physical Count Summary":
          // Fetch physical count reports
          const physicalCountResponse = await supabaseService.physicalCounts.getAll({ limit: 1 });
          if (physicalCountResponse.success && physicalCountResponse.data.length > 0) {
            const count = physicalCountResponse.data[0];
            const countItemsResponse = await supabaseService.physicalCounts.getById(count.id);
            if (countItemsResponse.success && countItemsResponse.data) {
              setReportData(countItemsResponse.data);
            }
          }
          break;

        case "Loss Report Summary":
          setError("Loss reports not available");
          break;

        case "Unserviceable Report":
          // Fetch unserviceable reports
          const unserviceableResponse = await supabaseService.unserviceableReports.getAll({ limit: 1 });
          if (unserviceableResponse.success && unserviceableResponse.data.length > 0) {
            const report = unserviceableResponse.data[0];
            const reportItemsResponse = await supabaseService.unserviceableReports.getById(report.id);
            if (reportItemsResponse.success && reportItemsResponse.data) {
              setReportData(reportItemsResponse.data);
            }
          }
          break;

        case "Custodian Report":
          // Custodian report doesn't need data fetching - it handles its own data
          setReportData({});
          break;

        default:
          setError("Report type not implemented yet");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedData === 'live') {
      fetchReportData();
    }
  }, [selectedData, reportType]);

  const renderReport = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading report data...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-8 text-center">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <Button onClick={fetchReportData}>Retry</Button>
        </div>
      );
    }

    if (!reportData) {
      return (
        <div className="p-8 text-center">
          <p className="text-muted-foreground">No data available for this report.</p>
        </div>
      );
    }

    switch (reportType) {
      case "Inventory Summary":
      case "Property Card":
        return <SemiExpendablePropertyCard data={reportData} />;
      case "Property Ledger":
        return <PropertyLedgerCard data={reportData} />;
      case "Custodian Report":
        return <CustodianReport data={reportData} />;
      case "Transfer Report":
        return <TransferReport data={reportData} />;
      case "Physical Count Summary":
        return <PhysicalCountReport data={reportData} />;
      case "Loss Report Summary":
        return <LossReport data={reportData} />;
      case "Unserviceable Report":
        return <UnserviceableReport data={reportData} />;
      default:
        return <div className="p-8 text-center">Report type not implemented yet.</div>;
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            {reportName}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{reportName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium">Data Source:</label>
            <Select value={selectedData} onValueChange={setSelectedData}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="live">Live Data</SelectItem>
              </SelectContent>
            </Select>
            {selectedData === 'live' && (
              <Button onClick={fetchReportData} variant="outline" size="sm">
                Refresh
              </Button>
            )}
          </div>

          {renderReport()}
        </div>
      </DialogContent>
    </Dialog>
  );
};