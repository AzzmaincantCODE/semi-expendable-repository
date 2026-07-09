import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { annexService } from "@/services/annexService";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { SemiExpendablePropertyCard } from "@/components/reports/SemiExpendablePropertyCard";
import { PrintDocumentLayout, PrintLayoutHint } from "@/components/print/PrintDocumentLayout";
import { printDocument } from "@/lib/printDocument";
import { PRINT_LAYOUT } from "@/lib/printLayouts";
import { AnnexSPCPrintData, AnnexPropertyCard } from "@/types/annex";

export const PropertyCardsPrint = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: printData, isLoading, error } = useQuery({
    queryKey: ["property-card-print", id],
    queryFn: async (): Promise<AnnexSPCPrintData> => {
      const card = await annexService.fetchPropertyCardWithEntries(id!);
      if (!card) throw new Error("Property card not found");

      let enrichedCard: AnnexPropertyCard & any = { ...card };

      try {
        const { data: inventoryItem } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('id', card.inventoryItemId)
          .single();

        if (inventoryItem) {
          enrichedCard = {
            ...enrichedCard,
            brand: inventoryItem.brand,
            model: inventoryItem.model,
            serialNumber: inventoryItem.serial_number,
            quantity: inventoryItem.quantity,
            unitOfMeasure: inventoryItem.unit_of_measure,
            unitCost: inventoryItem.unit_cost,
            totalCost: inventoryItem.total_cost,
            semiExpandableCategory: inventoryItem.semi_expandable_category,
            subCategory: inventoryItem.sub_category,
            condition: inventoryItem.condition,
            status: inventoryItem.status,
            supplier: inventoryItem.supplier,
            fundSource: inventoryItem.fund_source
          };
        }
      } catch (error) {
        console.error('Error fetching inventory details:', error);
      }

      // Check if entries are empty and load initial receipt + slips if needed
      if (!enrichedCard.entries || enrichedCard.entries.length === 0) {
        try {
          const initialEntry = {
            id: `initial-${enrichedCard.id}`,
            propertyCardId: enrichedCard.id,
            date: enrichedCard.dateAcquired || enrichedCard.createdAt || new Date().toISOString(),
            reference: 'Initial Receipt',
            receiptQty: enrichedCard.quantity || 1,
            unitCost: Number(enrichedCard.unitCost || 0),
            totalCost: Number(enrichedCard.totalCost || 0),
            issueItemNo: '',
            issueQty: 0,
            officeOfficer: '',
            balanceQty: enrichedCard.quantity || 1,
            amount: Number(enrichedCard.totalCost || 0),
            remarks: 'Inventory Registry',
            relatedSlipId: null,
            relatedTransferId: null,
            createdAt: enrichedCard.createdAt || new Date().toISOString(),
            updatedAt: enrichedCard.createdAt || new Date().toISOString()
          };

          const { data: slipItems } = await supabase
            .from('custodian_slip_items')
            .select('*, custodian_slips(slip_number, date_issued)')
            .eq('inventory_item_id', enrichedCard.inventoryItemId);

          const icsEntries = (slipItems || []).map((it: any) => ({
            id: it.id,
            propertyCardId: enrichedCard.id,
            date: it.date_issued,
            reference: `ICS ${it.custodian_slips?.slip_number || ''}`.trim(),
            receiptQty: it.quantity || 0,
            unitCost: Number(it.unit_cost || 0),
            totalCost: Number(it.total_cost || 0),
            issueItemNo: '',
            issueQty: 0,
            officeOfficer: '',
            balanceQty: it.quantity || 0,
            amount: Number(it.total_cost || 0),
            remarks: `Issued via ICS ${it.custodian_slips?.slip_number || ''}`.trim(),
            relatedSlipId: it.slip_id,
            slipNumber: it.custodian_slips?.slip_number,
            relatedTransferId: null,
            createdAt: it.created_at,
            updatedAt: it.updated_at
          }));

          const { data: transferItems } = await supabase
            .from('transfer_items')
            .select('*, property_transfers(transfer_number, to_department)')
            .eq('property_number', enrichedCard.propertyNumber);

          const itrEntries = (transferItems || []).map((ti: any) => ({
            id: ti.id,
            propertyCardId: enrichedCard.id,
            date: enrichedCard.updatedAt || ti.created_at,
            reference: `ITR ${ti.property_transfers?.transfer_number || ''}`.trim(),
            receiptQty: 0,
            unitCost: 0,
            totalCost: 0,
            issueItemNo: ti.property_number || '',
            issueQty: ti.quantity || 1,
            officeOfficer: ti.to_custodian || ti.property_transfers?.to_department || '',
            balanceQty: 0,
            amount: 0,
            remarks: 'Transferred',
            relatedSlipId: null,
            relatedTransferId: ti.transfer_id,
            createdAt: ti.created_at,
            updatedAt: ti.updated_at
          }));

          enrichedCard.entries = [initialEntry, ...icsEntries, ...itrEntries].sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) return dateA - dateB;

            if (a.reference === 'Initial Receipt') return -1;
            if (b.reference === 'Initial Receipt') return 1;

            if ((a.receiptQty > 0) && (b.issueQty > 0)) return -1;
            if ((b.receiptQty > 0) && (a.issueQty > 0)) return 1;

            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          });
        } catch (e) {
          console.error('Fallback building property card entries failed:', e);
        }
      }

      const enrichedCategory = enrichedCard.semiExpandableCategory;
      const semiExpProp = enrichedCategory || enrichedCard.semiExpendableProperty || '';

      return {
        entityName: enrichedCard.entityName || "PROVINCIAL GOVERNMENT OF APAYAO",
        fundCluster: enrichedCard.fundCluster || "",
        semiExpendableProperty: semiExpProp,
        description: enrichedCard.description || "",
        propertyNumber: enrichedCard.propertyNumber || "",
        serialNumber: enrichedCard.serialNumber || "",
        entries: enrichedCard.entries || [],
        remarks: enrichedCard.remarks || ""
      };
    },
    enabled: !!id,
  });

  const handlePrint = () => printDocument(PRINT_LAYOUT.A4_LANDSCAPE);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 text-muted-foreground animate-pulse">
          Loading property card details...
        </div>
      </div>
    );
  }

  if (error || !printData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 text-red-600 bg-white shadow rounded-lg border">
          Property card not found.
        </div>
      </div>
    );
  }

  return (
    <PrintDocumentLayout
      layout={PRINT_LAYOUT.A4_LANDSCAPE}
      className="print-portal-root min-h-screen bg-gray-100 py-8 print:min-h-0 print:bg-white print:py-0 text-black"
    >
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2 pr-12">
        <PrintLayoutHint layout={PRINT_LAYOUT.A4_LANDSCAPE} />
        <Button onClick={handlePrint} className="gap-2 shadow-lg bg-orange-600 hover:bg-orange-700 text-white">
          <Printer className="h-4 w-4" /> Print Card
        </Button>
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2 shadow-lg bg-white">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      <div
        className="mx-auto flex justify-center overflow-x-auto py-4 print:py-0"
        style={{ fontFamily: "'Times New Roman', serif" }}
      >
        <SemiExpendablePropertyCard data={printData} embeddedPrint />
      </div>
    </PrintDocumentLayout>
  );
};
