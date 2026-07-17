import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Loader2, AlertCircle, Printer, Eye, Trash2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabase";
import { getNewestRecordId, isWithinRecentThreshold } from "@/lib/utils";
import { annexService } from "@/services/annexService";
import { simpleInventoryService } from "@/services/simpleInventoryService";
import { propertyCardService } from "@/services/propertyCardService";
import { useDataMode } from "@/offline/dataModeContext";
import { SemiExpendablePropertyCard } from "@/components/reports/SemiExpendablePropertyCard";
import { BulkPropertyCardWizard } from "@/components/property-cards/BulkPropertyCardWizard";
import {
  AnnexPropertyCard,
  AnnexSPCPrintData,
  CreatePropertyCardFromInventoryRequest,
  AnnexInventoryItem
} from "@/types/annex";

export const PropertyCardsAnnex = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isOfflineMode } = useDataMode();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedCard, setSelectedCard] = useState<AnnexPropertyCard | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [selectedInventoryItems, setSelectedInventoryItems] = useState<string[]>([]);
  const [newCardForm, setNewCardForm] = useState({
    entityName: "PROVINCIAL GOVERNMENT OF APAYAO",
    fundCluster: "",
    inventoryItemId: ""
  });
  const [lockEntityName, setLockEntityName] = useState(false);
  const [lockFundCluster, setLockFundCluster] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<AnnexPropertyCard | null>(null);
  const [showBulkWizard, setShowBulkWizard] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<AnnexPropertyCard | null>(null);
  const [editCardForm, setEditCardForm] = useState({
    propertyNumber: "",
    fundCluster: "",
    description: "",
    serialNumber: "",
    dateAcquired: "",
    remarks: ""
  });

  // Helper function to get fund source name by ID
  const getFundSourceName = async (fundSourceId: string): Promise<string | null> => {
    try {
      const { data: fundSource } = await supabase
        .from('fund_sources')
        .select('name')
        .eq('id', fundSourceId)
        .single();
      return fundSource?.name || null;
    } catch (error) {
      console.error('Error fetching fund source:', error);
      return null;
    }
  };
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const defaultEntityName = "PROVINCIAL GOVERNMENT OF APAYAO";

  useEffect(() => {
    if (isCreating) {
      if (defaultEntityName) {
        setNewCardForm(prev => ({ ...prev, entityName: defaultEntityName }));
        setLockEntityName(true);
      } else {
        setLockEntityName(false);
      }
    }
  }, [isCreating, defaultEntityName]);

  // Sync URL search parameter with local state
  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch !== null && urlSearch !== searchTerm) {
      setSearchTerm(urlSearch);
    }
  }, [searchParams, searchTerm]);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch property cards using Annex service - fetch with inventory item data to determine value category
  const { data: cards = [], isLoading: loading, error } = useQuery({
    queryKey: ['annex-property-cards'],
    queryFn: async () => {
      console.log('[PropertyCardsAnnex] Fetching property cards...');

      // Fetch all property cards first
      const { data: cardsData, error: cardsError } = await supabase
        .from('property_cards')
        .select('*')
        .order('created_at', { ascending: false });

      if (cardsError) {
        console.error('[PropertyCardsAnnex] Error fetching property cards:', cardsError);
        throw cardsError;
      }

      // Then fetch inventory items for cards that have inventory_item_id
      const inventoryItemIds = (cardsData || [])
        .map(card => card.inventory_item_id)
        .filter(Boolean) as string[];

      let inventoryItemsMap: Record<string, any> = {};

      if (inventoryItemIds.length > 0) {
        const { data: inventoryData, error: inventoryError } = await supabase
          .from('inventory_items')
          .select('id, assignment_status, custodian, ics_number, property_number, sub_category, unit_cost, semi_expandable_category, serial_number')
          .in('id', inventoryItemIds);

        if (!inventoryError && inventoryData) {
          inventoryItemsMap = inventoryData.reduce((acc, item) => {
            acc[item.id] = item;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      const data = cardsData || [];

      if (error) {
        console.error('[PropertyCardsAnnex] Error fetching property cards:', error);
        throw error;
      }

      console.log('[PropertyCardsAnnex] Fetched property cards:', data?.length || 0);

      // Sort by created_at (descending) first, then by property number (descending)
      const sortedData = (data || []).sort((a, b) => {
        // First sort by creation date (most recent first)
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        if (dateA !== dateB) {
          return dateB - dateA;
        }
        // If same date, sort by property number (descending to get highest numbers first)
        return (b.property_number || '').localeCompare(a.property_number || '');
      });

      const mappedCards = sortedData.map(card => {
        // Get inventory item from the map we created
        const inventoryItem = card.inventory_item_id
          ? inventoryItemsMap[card.inventory_item_id]
          : null;

        // Determine value category based on sub_category or unit_cost
        const subCategory = inventoryItem?.sub_category;
        const unitCost = inventoryItem?.unit_cost || 0;
        const isHighValue = subCategory === 'High Value Expendable' ||
          (!subCategory && unitCost > 5000);

        return {
          id: card.id,
          entityName: card.entity_name,
          fundCluster: card.fund_cluster,
          semiExpendableProperty: card.semi_expendable_property,
          propertyNumber: card.property_number,
          description: card.description,
          dateAcquired: card.date_acquired,
          remarks: card.remarks,
          inventoryItemId: card.inventory_item_id,
          entries: [], // Will be loaded separately when needed
          createdAt: card.created_at,
          updatedAt: card.updated_at,
          // Add assignment status info for UI display
          assignmentStatus: inventoryItem?.assignment_status,
          custodian: inventoryItem?.custodian,
          icsNumber: inventoryItem?.ics_number,
          serialNumber: inventoryItem?.serial_number || '',
          // Add value category for filtering
          subCategory: subCategory || (isHighValue ? 'High Value Expendable' : 'Small Value Expendable'),
          unitCost: unitCost,
          isHighValue: isHighValue,
          semiExpandableCategory: inventoryItem?.semi_expandable_category || ''
        };
      }) as (AnnexPropertyCard & { subCategory?: string; unitCost?: number; isHighValue?: boolean })[];

      console.log('[PropertyCardsAnnex] Mapped property cards:', mappedCards.length);
      return mappedCards;
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      if (!navigator.onLine) return false;
      return failureCount < 2;
    },
  });

  // Fetch available inventory items for creating property cards
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['available-inventory-for-cards', cards.length], // Include cards.length to refetch when cards change
    queryFn: async () => {
      console.log('[PropertyCardsAnnex] Fetching available inventory items for property card creation...');
      console.log('[PropertyCardsAnnex] Current property cards count:', cards.length);

      // Get all inventory items (including those without property cards) for property card creation
      // Note: We don't filter by category since all items in this system are semi-expendable (below 50k PHP)
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('status', 'Active')
        .eq('condition', 'Serviceable')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[PropertyCardsAnnex] Error fetching available inventory:', error);
        // Fallback to manual filtering if view doesn't exist yet
        const response = await simpleInventoryService.getAll();
        if (response.success) {
          const existingCardItems = cards.map(card => card.inventoryItemId).filter(Boolean);
          console.log('[PropertyCardsAnnex] Existing card items (fallback):', existingCardItems);
          const filtered = response.data.filter(item =>
            // Must be serviceable
            item.condition === 'Serviceable' &&
            // Must not already have a property card
            !existingCardItems.includes(item.id) &&
            // Must be available status
            item.status === 'Active' &&
            // Additional safety check for assignment status if it exists
            (!(item as any).assignmentStatus || (item as any).assignmentStatus === 'Available')
          );
          console.log('[PropertyCardsAnnex] Filtered inventory items (fallback):', filtered.length);
          return filtered;
        }
        return [];
      }

      console.log('[PropertyCardsAnnex] Raw inventory items fetched:', data?.length || 0);

      // Filter out items that already have property cards
      const existingCardItems = cards.map(card => card.inventoryItemId).filter(Boolean);
      console.log('[PropertyCardsAnnex] Existing card items:', existingCardItems);

      const filtered = data
        .filter(item => {
          const hasCard = existingCardItems.includes(item.id);
          if (hasCard) {
            console.log(`[PropertyCardsAnnex] Filtering out item ${item.property_number} - already has property card`);
          }
          return !hasCard;
        })
        .map(item => {
          const mapped: AnnexInventoryItem & { entityName?: string } = {
            id: item.id,
            propertyNumber: item.property_number,
            description: item.description || '',
            brand: item.brand || '',
            model: item.model || '',
            serialNumber: item.serial_number || '',
            entityName: item.entity_name || '', // Add as extra field for form usage
            unitOfMeasure: item.unit_of_measure || 'piece',
            quantity: item.quantity || 1,
            unitCost: item.unit_cost || 0,
            totalCost: item.total_cost || 0,
            dateAcquired: item.date_acquired || new Date().toISOString().split('T')[0],
            supplier: item.supplier_id || '',
            condition: (item.condition || 'Serviceable') as 'Serviceable' | 'Unserviceable' | 'For Repair' | 'Lost' | 'Stolen' | 'Damaged' | 'Destroyed',
            location: item.location || '',
            custodian: item.custodian || '',
            custodianPosition: item.custodian_position || '',
            accountableOfficer: item.custodian || '', // Use custodian as accountable officer
            fundSource: item.fund_source_id || '',
            remarks: item.remarks || '',
            lastInventoryDate: item.last_inventory_date || undefined,
            category: (item.category || 'Semi-Expendable') as 'Semi-Expendable' | 'Equipment' | 'Furniture',
            status: (item.status || 'Active') as 'Active' | 'Transferred' | 'Disposed' | 'Missing',
            assignmentStatus: (item.assignment_status || 'Available') as 'Available' | 'Assigned' | 'In-Transit' | 'Disposed',
            assignedDate: item.assigned_date || undefined,
            createdAt: item.created_at || new Date().toISOString(),
            updatedAt: item.updated_at || new Date().toISOString()
          };
          return mapped;
        });

      console.log('[PropertyCardsAnnex] Available inventory items after filtering:', filtered.length);
      if (filtered.length > 0) {
        console.log('[PropertyCardsAnnex] Sample items:', filtered.slice(0, 3).map(i => ({
          propertyNumber: i.propertyNumber,
          description: i.description,
          condition: i.condition,
          status: i.status,
          assignmentStatus: i.assignmentStatus
        })));
      }

      return filtered;
    },
    enabled: isCreating && !loading, // Wait for cards to load first
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
  });

  // Handle prefill data from navigation state
  useEffect(() => {
    const prefillItem = location.state?.prefillItem;
    console.log('Checking for prefill item:', prefillItem);
    if (prefillItem) {
      console.log('Prefill item found, opening creation dialog');
      // Auto-open the creation dialog and prefill the form
      setIsCreating(true);

      // Find the inventory item by property number
      if (inventoryItems.length > 0) {
        const matchingItem = inventoryItems.find(item =>
          item.propertyNumber === prefillItem.propertyNumber
        );
        console.log('Matching inventory item:', matchingItem);
        if (matchingItem) {
          setNewCardForm(prev => ({
            ...prev,
            inventoryItemId: matchingItem.id
          }));
          setSelectedInventoryItems([matchingItem.id]);
        }
      } else {
        console.log('No inventory items available yet, will retry when loaded');
      }
    }
  }, [location.state, inventoryItems]);

  // Create property card mutation
  const createCardMutation = useMutation({
    mutationFn: async (request: CreatePropertyCardFromInventoryRequest) => {
      return await annexService.createPropertyCardFromInventory(request);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Property card created successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['annex-property-cards'] });
      queryClient.invalidateQueries({ queryKey: ['available-inventory-for-cards'] });
      setIsCreating(false);
      setNewCardForm({ entityName: "", fundCluster: "", inventoryItemId: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Edit property card mutation
  const editCardMutation = useMutation({
    mutationFn: async ({ card, updates }: { card: AnnexPropertyCard, updates: { propertyNumber: string, fundCluster: string, description: string, serialNumber: string, dateAcquired: string, remarks: string } }) => {
      // 1. Card-only fields
      const result = await propertyCardService.update(card.id, {
        fundCluster: updates.fundCluster,
        dateAcquired: updates.dateAcquired,
        remarks: updates.remarks,
        // For cards without a linked inventory item, write these directly too
        ...(card.inventoryItemId ? {} : {
          propertyNumber: updates.propertyNumber,
          description: updates.description
        })
      });
      if (!result.success) {
        throw new Error(result.error || 'Failed to update property card');
      }

      // 2. If linked to inventory, route property number + description + serial number
      // through the inventory service — it dup-checks the number and cascades the change
      // to the inventory item, this card, custodian slips and transfers so all show the
      // same. The SN lives on inventory_items only; the sync re-embeds it as "SN: ..."
      // in the card description (replacing any old SN fragment).
      if (card.inventoryItemId) {
        const invUpdates: any = {};
        if (updates.propertyNumber !== card.propertyNumber) invUpdates.propertyNumber = updates.propertyNumber;
        if (updates.description !== card.description) invUpdates.description = updates.description;
        if (updates.serialNumber !== (card.serialNumber || '')) invUpdates.serialNumber = updates.serialNumber.trim();
        if (Object.keys(invUpdates).length > 0) {
          const invResult = await simpleInventoryService.update(card.inventoryItemId, invUpdates);
          if (!invResult.success) {
            throw new Error(invResult.error || 'Failed to update linked inventory item');
          }
        }
      }
      return result.data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Property card updated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['annex-property-cards'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setCardToEdit(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const handleEditCard = (card: AnnexPropertyCard) => {
    setCardToEdit(card);
    // For linked cards the SN gets its own field, so strip the embedded "SN: ..."
    // fragment from the editable description — the inventory sync re-appends it on save.
    const description = card.inventoryItemId
      ? (card.description || '')
          .replace(/,?\s*SN:\s*[^,]*/gi, '')
          .replace(/\s{2,}/g, ' ')
          .replace(/^[,\s]+|[,\s]+$/g, '')
          .trim()
      : (card.description || "");
    setEditCardForm({
      propertyNumber: card.propertyNumber || "",
      fundCluster: card.fundCluster || "",
      description,
      serialNumber: card.serialNumber || "",
      dateAcquired: card.dateAcquired ? card.dateAcquired.split('T')[0] : "",
      remarks: card.remarks || ""
    });
  };

  const handleSaveEditCard = () => {
    if (!cardToEdit) return;
    if (!editCardForm.propertyNumber.trim()) {
      toast({
        title: "Error",
        description: "Property number cannot be empty",
        variant: "destructive"
      });
      return;
    }
    editCardMutation.mutate({ card: cardToEdit, updates: editCardForm });
  };

  // Delete property card mutation
  const deleteCardMutation = useMutation({    mutationFn: async (cardId: string) => {
      // First check if the card can be deleted
      const canDeleteResult = await propertyCardService.canDelete(cardId);
      if (!canDeleteResult.success || !canDeleteResult.data) {
        throw new Error('This property card cannot be deleted because it has custodian slip references.');
      }

      // If it can be deleted, proceed with safe deletion
      const deleteResult = await propertyCardService.safeDelete(cardId);
      if (!deleteResult.success) {
        throw new Error(deleteResult.error || 'Failed to delete property card');
      }

      return deleteResult.data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Property card deleted successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['annex-property-cards'] });
      setCardToDelete(null);
      setShowDeleteDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Get property card with entries for viewing/printing
  const getCardWithEntries = async (cardId: string): Promise<AnnexPropertyCard | null> => {
    const card = await annexService.fetchPropertyCardWithEntries(cardId);
    if (!card) return null;

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
        } as any;
      }
    } catch (error) {
      console.error('Error fetching inventory details:', error);
    }

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

        enrichedCard = {
          ...enrichedCard,
          entries: [initialEntry, ...icsEntries, ...itrEntries].sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) return dateA - dateB;

            // Prioritize Initial Receipt
            if (a.reference === 'Initial Receipt') return -1;
            if (b.reference === 'Initial Receipt') return 1;

            // Prioritize Receipts over Issues
            if ((a.receiptQty > 0) && (b.issueQty > 0)) return -1;
            if ((b.receiptQty > 0) && (a.issueQty > 0)) return 1;

            // Fallback to creation time
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          })
        } as any;
      } catch (e) {
        console.error('Fallback building property card entries failed:', e);
      }
    }

    return enrichedCard;
  };

  const handleCreateCard = async () => {
    // Prevent multiple submissions
    if (createCardMutation.isPending) {
      console.log('Property card creation already in progress, ignoring duplicate click');
      return;
    }

    if (!newCardForm.entityName || !newCardForm.fundCluster || !newCardForm.inventoryItemId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const selectedItem = inventoryItems.find(item => item.id === newCardForm.inventoryItemId);
    if (!selectedItem) {
      toast({
        title: "Error",
        description: "Selected inventory item not found",
        variant: "destructive"
      });
      return;
    }

    console.log('Creating property card for item:', selectedItem.propertyNumber);
    // Create property card with initial receipt entry (Annex A.1)
    createCardMutation.mutate({
      inventoryItemId: newCardForm.inventoryItemId,
      entityName: newCardForm.entityName,
      fundCluster: newCardForm.fundCluster,
      initialEntry: {
        date: selectedItem.dateAcquired || new Date().toISOString().split('T')[0],
        reference: 'Initial Receipt',
        receiptQty: selectedItem.quantity || 1,
        unitCost: selectedItem.unitCost || 0,
        totalCost: selectedItem.totalCost || ((selectedItem.quantity || 1) * (selectedItem.unitCost || 0))
      }
    });
  };

  const handleViewCard = async (card: AnnexPropertyCard) => {
    try {
      const cardWithEntries = await getCardWithEntries(card.id);
      if (cardWithEntries) {
        setSelectedCard(cardWithEntries);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load property card details",
        variant: "destructive"
      });
    }
  };

  const handlePrintCard = async (card: AnnexPropertyCard) => {
    try {
      const cardWithEntries = await getCardWithEntries(card.id);
      if (cardWithEntries) {
        setSelectedCard(cardWithEntries);
        setShowPrintDialog(true);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load property card for printing",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCard = (card: AnnexPropertyCard) => {
    // Log the assignment status for debugging, but don't block deletion 
    // since we want to handle "ghost" assignments where slips were deleted but status remained.
    if ((card as any).assignmentStatus === 'Assigned') {
       console.log(`[PropertyCard Delete] Proceeding with deletion of assigned item ${card.propertyNumber} (Custodian: ${(card as any).custodian})`);
    }
    setCardToDelete(card);
    setShowDeleteDialog(true);
  };

  const confirmDeleteCard = () => {
    if (cardToDelete) {
      deleteCardMutation.mutate(cardToDelete.id);
    }
  };

  const getPrintData = (card: AnnexPropertyCard): AnnexSPCPrintData => {
    // Prefer inventory item's semi_expandable_category over the card's stored value
    // because the card's value may be the generic sub-category (e.g., "High Value Expendable")
    const enrichedCategory = (card as any).semiExpandableCategory;
    const semiExpProp = enrichedCategory || card.semiExpendableProperty || '';
    
    return {
      entityName: card.entityName,
      fundCluster: card.fundCluster,
      semiExpendableProperty: semiExpProp,
      description: card.description,
      propertyNumber: card.propertyNumber,
      serialNumber: (card as any).serialNumber || card.serialNumber,
      entries: card.entries || [],
      remarks: card.remarks || ""
    };
  };

  // Filter cards by search term
  const filteredCards = cards.filter(card =>
    card.propertyNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.entityName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Separate cards into high value and low value
  const highValueCards = filteredCards.filter(card => (card as any).isHighValue === true);
  const lowValueCards = filteredCards.filter(card => (card as any).isHighValue !== true);

  const newestCardId = useMemo(() => getNewestRecordId(cards), [cards]);
  const isRecentlyAddedCard = (card: AnnexPropertyCard) =>
    newestCardId === card.id && isWithinRecentThreshold(card.createdAt);

  if (loading && cards.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading property cards...</span>
      </div>
    );
  }

  if (error && navigator.onLine) {
    return (
      <div className="text-center py-8">
        <Alert className="max-w-md mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error: {error.message}
          </AlertDescription>
        </Alert>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['annex-property-cards'] })} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (error && !navigator.onLine) {
    return (
      <div className="text-center py-8">
        <Alert className="max-w-md mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You're offline. Some features may not work until your connection is restored.
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <p className="text-muted-foreground">Previously loaded property cards will appear when available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-foreground">Semi-Expendable Property Cards (Annex A.1)</h1>
          {isOfflineMode && (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
              Read-only while offline
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowBulkWizard(true)} variant="outline" className="flex items-center gap-2" disabled={isOfflineMode}>
            <Plus className="h-4 w-4" />
            Bulk Create
          </Button>
          <Button onClick={() => setIsCreating(true)} className="flex items-center gap-2" disabled={isOfflineMode}>
            <Plus className="h-4 w-4" />
            Create from Inventory
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search property cards..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Property Cards Tables with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Semi-Expendable Property Cards</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="high-value" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="high-value" className="flex items-center gap-2">
                <span className="font-semibold">High Value</span>
                <Badge variant="secondary" className="ml-auto">
                  {loading ? '...' : highValueCards.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="low-value" className="flex items-center gap-2">
                <span className="font-semibold">Low Value</span>
                <Badge variant="secondary" className="ml-auto">
                  {loading ? '...' : lowValueCards.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Helper function to render table */}
            {(() => {
              const renderTable = (cardsToRender: typeof filteredCards, isLoading: boolean) => (
                <div className="rounded-md border mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-semibold">Property Number</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Entity Name</TableHead>
                        <TableHead>Fund Cluster</TableHead>
                        <TableHead>Date Acquired</TableHead>
                        <TableHead>Assignment Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : cardsToRender.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No property cards found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        cardsToRender.map((card) => (
                          <TableRow key={card.id}>
                            <TableCell className="font-medium font-mono">
                              <div className="flex items-center gap-2">
                                <span>{card.propertyNumber}</span>
                                {isRecentlyAddedCard(card) && (
                                  <Badge variant="default" className="bg-emerald-600 text-white">
                                    Recently Added
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <div className="truncate" title={card.description}>
                                {card.description}
                              </div>
                            </TableCell>
                            <TableCell>{card.entityName}</TableCell>
                            <TableCell>{card.fundCluster}</TableCell>
                            <TableCell>{card.dateAcquired}</TableCell>
                            <TableCell>
                              {(card as any).assignmentStatus === 'Assigned' && (card as any).custodian ? (
                                <Badge 
                                  variant="secondary" 
                                  className={`text-xs ${(card as any).icsNumber ? 'cursor-pointer hover:bg-secondary/80' : ''}`}
                                  onClick={() => {
                                    if ((card as any).icsNumber) {
                                      navigate(`/custodian-slips?search=${(card as any).icsNumber}`);
                                    }
                                  }}
                                  title={(card as any).icsNumber ? `Click to view ICS ${(card as any).icsNumber}` : undefined}
                                >
                                  Assigned to: {(card as any).custodian}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  Available
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewCard(card)}
                                  title="View Details"
                                  disabled={deleteCardMutation.isPending}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditCard(card)}
                                  title="Edit property card"
                                  disabled={deleteCardMutation.isPending || isOfflineMode}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePrintCard(card)}
                                  title="Print"
                                  disabled={deleteCardMutation.isPending}
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteCard(card)}
                                  title={(card as any).assignmentStatus === 'Assigned'
                                    ? `Cannot delete - item is assigned to ${(card as any).custodian}`
                                    : "Delete property card"}
                                  className="text-destructive hover:text-destructive"
                                  disabled={deleteCardMutation.isPending || isOfflineMode}
                                >
                                  {deleteCardMutation.isPending && cardToDelete?.id === card.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              );

              return (
                <>
                  <TabsContent value="high-value" className="mt-4">
                    <div className="mb-4 text-sm text-muted-foreground">
                      Items above ₱5,000 - High Value Expendable (SPHV)
                    </div>
                    {renderTable(highValueCards, loading)}
                  </TabsContent>
                  <TabsContent value="low-value" className="mt-4">
                    <div className="mb-4 text-sm text-muted-foreground">
                      Items ₱5,000 or less - Small Value Expendable (SPLV)
                    </div>
                    {renderTable(lowValueCards, loading)}
                  </TabsContent>
                </>
              );
            })()}
          </Tabs>
        </CardContent>
      </Card>

      {/* Create Property Card Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Property Card from Inventory</DialogTitle>
            <DialogDescription>
              Select an inventory item to create a Semi-Expendable Property Card (Annex A.1)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="entityName">Entity Name *</Label>
                  <Input
                    id="entityName"
                    value={newCardForm.entityName}
                    readOnly
                    className="bg-muted"
                  />
                </div>
              <div>
                <Label htmlFor="fundCluster">Fund Cluster *</Label>
                <Input
                  id="fundCluster"
                  value={newCardForm.fundCluster}
                  onChange={(e) => setNewCardForm(prev => ({ ...prev, fundCluster: e.target.value }))}
                  placeholder="Enter fund cluster"
                  disabled={lockFundCluster}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="inventoryItem">Select Inventory Item *</Label>
              <Select
                value={newCardForm.inventoryItemId}
                onValueChange={async (value) => {
                  const item = inventoryItems.find(i => i.id === value);
                  setNewCardForm(prev => ({
                    ...prev,
                    inventoryItemId: value,
                    // Use entity name from inventory item if available (entityName is in the mapped data)
                    entityName: (item as AnnexInventoryItem & { entityName?: string })?.entityName || prev.entityName,
                  }));
                  setLockEntityName(!!(item as AnnexInventoryItem & { entityName?: string })?.entityName);

                  // Fetch fund source name if fund source ID exists
                  if (item?.fundSource) {
                    const fundSourceName = await getFundSourceName(item.fundSource);
                    if (fundSourceName) {
                      setNewCardForm(prev => ({
                        ...prev,
                        fundCluster: fundSourceName
                      }));
                      setLockFundCluster(true);
                    } else {
                      setLockFundCluster(false);
                    }
                  } else {
                    setLockFundCluster(false);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an inventory item" />
                </SelectTrigger>
                <SelectContent>
                  {inventoryItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.propertyNumber} - {item.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateCard}
                disabled={createCardMutation.isPending}
              >
                {createCardMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Property Card
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Property Card Dialog */}
      <Dialog open={!!cardToEdit} onOpenChange={(open) => { if (!open) setCardToEdit(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Property Card</DialogTitle>
            <DialogDescription>
              Update details for property number {cardToEdit?.propertyNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editPropertyNumber">Property Number</Label>
              <Input
                id="editPropertyNumber"
                value={editCardForm.propertyNumber}
                onChange={(e) => setEditCardForm(prev => ({ ...prev, propertyNumber: e.target.value }))}
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Changing this also updates the linked inventory item, custodian slips and transfers.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editFundCluster">Fund Cluster</Label>
              <Input
                id="editFundCluster"
                value={editCardForm.fundCluster}
                onChange={(e) => setEditCardForm(prev => ({ ...prev, fundCluster: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDescription">Description</Label>
              <Textarea
                id="editDescription"
                value={editCardForm.description}
                onChange={(e) => setEditCardForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter item description..."
                className="min-h-[40px] resize-none"
                onInput={(e) => {
                  const target = e.currentTarget;
                  target.style.height = 'auto';
                  target.style.height = target.scrollHeight + 'px';
                }}
                onFocus={(e) => {
                  e.currentTarget.style.height = 'auto';
                  e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editSerialNumber">Serial Number</Label>
              <Input
                id="editSerialNumber"
                value={editCardForm.serialNumber}
                onChange={(e) => setEditCardForm(prev => ({ ...prev, serialNumber: e.target.value }))}
                placeholder="Enter serial number..."
                className="font-mono"
                disabled={!cardToEdit?.inventoryItemId}
              />
              <p className="text-[10px] text-muted-foreground">
                {cardToEdit?.inventoryItemId
                  ? 'Saved on the linked inventory item and shown as "SN: ..." on the card, custodian slips and transfers.'
                  : 'Unavailable — this card has no linked inventory item. Add the SN in the description instead.'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDateAcquired">Date Acquired</Label>
              <Input
                id="editDateAcquired"
                type="date"
                value={editCardForm.dateAcquired}
                onChange={(e) => setEditCardForm(prev => ({ ...prev, dateAcquired: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editRemarks">Remarks</Label>
              <Input
                id="editRemarks"
                value={editCardForm.remarks}
                onChange={(e) => setEditCardForm(prev => ({ ...prev, remarks: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCardToEdit(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveEditCard}
                disabled={editCardMutation.isPending}
              >
                {editCardMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>Print Property Card</DialogTitle>
            <DialogDescription>
              Preview and print the selected Semi-Expendable Property Card.
            </DialogDescription>
          </DialogHeader>

          <div ref={printRef}>
            {selectedCard && (
              <SemiExpendablePropertyCard data={getPrintData(selectedCard)} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Card Dialog */}
      <Dialog open={!!selectedCard && !showPrintDialog} onOpenChange={() => setSelectedCard(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Property Card Details</DialogTitle>
            <DialogDescription>
              View complete information and history for property number {selectedCard?.propertyNumber}
            </DialogDescription>
          </DialogHeader>

          {selectedCard && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Entity Name</Label>
                  <p className="text-sm">{selectedCard.entityName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Fund Cluster</Label>
                  <p className="text-sm">{selectedCard.fundCluster}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Property Number</Label>
                  <p className="font-mono font-semibold">{selectedCard.propertyNumber}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Date Acquired</Label>
                  <p className="text-sm">{selectedCard.dateAcquired}</p>
                </div>
              </div>

              {/* Item Details - Show if inventory data is available */}
              {(selectedCard as any).brand || (selectedCard as any).model || (selectedCard as any).serialNumber ? (
                <div>
                  <Label className="text-sm font-semibold">Item Details</Label>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    {(selectedCard as any).brand && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Brand</Label>
                        <p className="text-sm">{(selectedCard as any).brand}</p>
                      </div>
                    )}
                    {(selectedCard as any).model && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Model</Label>
                        <p className="text-sm">{(selectedCard as any).model}</p>
                      </div>
                    )}
                    {(selectedCard as any).serialNumber && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Serial Number</Label>
                        <p className="font-mono text-sm">{(selectedCard as any).serialNumber}</p>
                      </div>
                    )}
                    {(selectedCard as any).quantity && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Quantity</Label>
                        <p className="text-sm">{(selectedCard as any).quantity} {(selectedCard as any).unitOfMeasure}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Financial Information - Show if inventory data is available */}
              {(selectedCard as any).unitCost !== undefined ? (
                <div>
                  <Label className="text-sm font-semibold">Financial Information</Label>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Unit Cost</Label>
                      <p className="font-semibold text-sm">₱{((selectedCard as any).unitCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Total Cost</Label>
                      <p className="font-semibold text-sm">₱{((selectedCard as any).totalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Entries */}
              {selectedCard.entries && selectedCard.entries.length > 0 && (
                <div>
                  <Label className="text-sm font-semibold">Property Card Entries</Label>
                  <div className="mt-2 rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Receipt Qty</TableHead>
                          <TableHead>Issue Qty</TableHead>
                          <TableHead>Office/Officer</TableHead>
                          <TableHead>Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCard.entries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>{entry.date}</TableCell>
                            <TableCell>{entry.reference}</TableCell>
                            <TableCell>{entry.receiptQty || '-'}</TableCell>
                            <TableCell>{entry.issueQty || '-'}</TableCell>
                            <TableCell>{entry.officeOfficer || '-'}</TableCell>
                            <TableCell>{entry.balanceQty}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedCard(null)}>
                  Close
                </Button>
                <Button onClick={() => setShowPrintDialog(true)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Property Card</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this property card? This action cannot be undone.
              {cardToDelete && (
                <div className="mt-2 p-2 bg-muted rounded">
                  <strong>Property Card:</strong> {cardToDelete.propertyNumber}
                  <br />
                  <strong>Description:</strong> {cardToDelete.description}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setCardToDelete(null);
              }}
              disabled={deleteCardMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteCard}
              disabled={deleteCardMutation.isPending}
            >
              {deleteCardMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Property Card Creation Wizard */}
      <BulkPropertyCardWizard
        isOpen={showBulkWizard}
        onClose={() => setShowBulkWizard(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['annex-property-cards'] });
          queryClient.invalidateQueries({ queryKey: ['available-inventory-for-cards'] });
          queryClient.invalidateQueries({ queryKey: ['available-inventory-for-slips'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
          toast({
            title: "Success",
            description: "Property cards created successfully!"
          });
        }}
        inventoryItems={inventoryItems as any}
      />
    </div>
  );
};
