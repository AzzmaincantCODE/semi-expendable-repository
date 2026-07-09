// Annex-compliant service for managing data flow between inventory, property cards, and custodian slips
import { supabase } from '@/lib/supabase';
import {
  AnnexInventoryItem,
  AnnexPropertyCard,
  AnnexSPCEntry,
  AnnexCustodianSlip,
  AnnexCustodianSlipItem,
  CreateCustodianSlipRequest,
  CreatePropertyCardFromInventoryRequest
} from '@/types/annex';

export class AnnexService {
  private normalizeEstimatedUsefulLife(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private buildSafeDescription(inventoryItem: any): string {
    let safeDescription: string = (inventoryItem.description
      || (inventoryItem.model ? `${inventoryItem.brand ? inventoryItem.brand + ' ' : ''}${inventoryItem.model}` : inventoryItem.brand)
      || '').trim();

    if (inventoryItem.serial_number && !safeDescription.includes(inventoryItem.serial_number)) {
      if (safeDescription) {
        safeDescription += `, SN: ${inventoryItem.serial_number}`;
      } else {
        safeDescription = `SN: ${inventoryItem.serial_number}`;
      }
    }

    return safeDescription;
  }

  private buildPropertyCardPayload(inventoryItem: any, fundCluster: string, entityName = 'PROVINCIAL GOVERNMENT OF APAYAO') {
    return {
      entity_name: entityName,
      fund_cluster: fundCluster,
      semi_expendable_property: inventoryItem.semi_expandable_category || inventoryItem.category || 'Semi-Expendable Property',
      property_number: inventoryItem.property_number,
      description: this.buildSafeDescription(inventoryItem),
      date_acquired: inventoryItem.date_acquired,
      remarks: inventoryItem.remarks,
      inventory_item_id: inventoryItem.id
    };
  }

  private comparePropertyCardEntryRows(a: any, b: any): number {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (dateA !== dateB) return dateA - dateB;

    if (a.reference === 'Initial Receipt') return -1;
    if (b.reference === 'Initial Receipt') return 1;

    if ((a.receipt_qty > 0) && (b.issue_qty > 0)) return -1;
    if ((b.receipt_qty > 0) && (a.issue_qty > 0)) return 1;

    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  }

  private getPropertyCardEntryState(entries: any[]) {
    const sortedEntries = [...(entries || [])].sort((a, b) => this.comparePropertyCardEntryRows(a, b));
    const lastEntry = sortedEntries[sortedEntries.length - 1];
    const lastBalance = typeof lastEntry?.balance_qty === 'number' ? lastEntry.balance_qty : 0;

    return {
      hasEntries: sortedEntries.length > 0,
      lastBalance
    };
  }

  async createPropertyCardsFromInventory(
    requests: Array<{
      inventoryItem: any;
      fundCluster: string;
      entityName?: string;
      initialEntry?: {
        date: string;
        reference: string;
        receiptQty: number;
        unitCost: number;
        totalCost: number;
        remarks?: string;
      };
    }>
  ): Promise<AnnexPropertyCard[]> {
    const normalizedRequests = (requests || []).filter((request) => request?.inventoryItem?.id && request?.fundCluster);
    if (normalizedRequests.length === 0) {
      return [];
    }

    const inventoryItemIds = normalizedRequests.map((request) => request.inventoryItem.id);
    const { data: existingCards, error: existingError } = await supabase
      .from('property_cards')
      .select('inventory_item_id')
      .in('inventory_item_id', inventoryItemIds);

    if (existingError) {
      throw new Error(`Failed to check existing property cards: ${existingError.message}`);
    }

    const existingCardIds = new Set((existingCards || []).map((card) => card.inventory_item_id).filter(Boolean));
    const requestsToCreate = normalizedRequests.filter((request) => !existingCardIds.has(request.inventoryItem.id));

    if (requestsToCreate.length === 0) {
      return [];
    }

    const propertyCardPayloads = requestsToCreate.map((request) =>
      this.buildPropertyCardPayload(
        request.inventoryItem,
        request.fundCluster,
        request.entityName || 'PROVINCIAL GOVERNMENT OF APAYAO'
      )
    );

    const { data: insertedCards, error: cardError } = await supabase
      .from('property_cards')
      .insert(propertyCardPayloads)
      .select('*');

    if (cardError) {
      throw new Error(`Failed to create property cards: ${cardError.message}`);
    }

    const insertedCardsByInventoryId = new Map<string, any>();
    (insertedCards || []).forEach((card) => {
      if (card.inventory_item_id) {
        insertedCardsByInventoryId.set(card.inventory_item_id, card);
      }
    });

    const entryPayloads = requestsToCreate
      .map((request) => {
        const propertyCard = insertedCardsByInventoryId.get(request.inventoryItem.id);
        if (!propertyCard || !request.initialEntry) {
          return null;
        }

        const receiptQty = request.initialEntry.receiptQty ?? Number(request.inventoryItem.quantity || 1);
        const unitCost = request.initialEntry.unitCost ?? Number(request.inventoryItem.unit_cost || 0);
        const totalCost = request.initialEntry.totalCost ?? Number(request.inventoryItem.total_cost || receiptQty * unitCost);

        return {
          property_card_id: propertyCard.id,
          date: request.initialEntry.date,
          reference: request.initialEntry.reference?.trim() || '',
          receipt_qty: receiptQty,
          unit_cost: unitCost,
          total_cost: totalCost,
          issue_item_no: '',
          issue_qty: 0,
          office_officer: '',
          balance_qty: receiptQty,
          amount: totalCost,
          remarks: request.initialEntry.remarks ?? '',
          inventory_item_id: request.inventoryItem.id
        };
      })
      .filter(Boolean);

    if (entryPayloads.length > 0) {
      const { error: entryError } = await supabase
        .from('property_card_entries')
        .insert(entryPayloads as any[]);

      if (entryError) {
        const insertedCardIds = (insertedCards || [])
          .map((card) => card.id)
          .filter(Boolean);

        if (insertedCardIds.length > 0) {
          await supabase
            .from('property_cards')
            .delete()
            .in('id', insertedCardIds);
        }

        throw new Error(`Failed to create property card entries: ${entryError.message}`);
      }
    }

    return (insertedCards || []).map((card) => this.mapToAnnexPropertyCard(card));
  }

  async createPropertyCardFromInventory(request: CreatePropertyCardFromInventoryRequest): Promise<AnnexPropertyCard> {
    const { data: inventoryItem, error: inventoryError } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', request.inventoryItemId)
      .single();

    if (inventoryError || !inventoryItem) {
      throw new Error(`Inventory item not found: ${inventoryError?.message}`);
    }

    const createdCards = await this.createPropertyCardsFromInventory([
      {
        inventoryItem,
        fundCluster: request.fundCluster,
        entityName: request.entityName,
        initialEntry: request.initialEntry
          ? {
            ...request.initialEntry,
            remarks: request.initialEntry.remarks ?? ''
          }
          : undefined
      }
    ]);

    if (createdCards.length > 0) {
      return createdCards[0];
    }

    const { data: existingCard, error: existingCardError } = await supabase
      .from('property_cards')
      .select('*')
      .eq('inventory_item_id', request.inventoryItemId)
      .single();

    if (existingCardError || !existingCard) {
      throw new Error('Failed to create property card.');
    }

    return this.mapToAnnexPropertyCard(existingCard);
  }

  async createCustodianSlip(request: CreateCustodianSlipRequest): Promise<AnnexCustodianSlip | AnnexCustodianSlip[]> {
    if (!request.inventoryItemIds || request.inventoryItemIds.length === 0) {
      throw new Error('No inventory items provided for the custodian slip');
    }

    const { data: fetchedInventoryItems, error: inventoryFetchError } = await supabase
      .from('inventory_items')
      .select('*')
      .in('id', request.inventoryItemIds);

    if (inventoryFetchError) {
      throw new Error(`Failed to fetch inventory items: ${inventoryFetchError.message}`);
    }

    const inventoryById = new Map((fetchedInventoryItems || []).map((item) => [item.id, item]));
    const inventoryItems: any[] = [];

    for (const inventoryItemId of request.inventoryItemIds) {
      const inventoryItem = inventoryById.get(inventoryItemId);
      if (!inventoryItem) throw new Error(`Inventory item ${inventoryItemId} not found`);
      if (inventoryItem.assignment_status === 'Assigned' || inventoryItem.custodian) {
        throw new Error(`Inventory item ${inventoryItem.property_number} is already assigned to ${inventoryItem.custodian}`);
      }
      if (inventoryItem.condition !== 'Serviceable') {
        throw new Error(`Inventory item ${inventoryItem.property_number} is not serviceable (${inventoryItem.condition})`);
      }
      inventoryItems.push(inventoryItem);
    }

    const inventoryIds = inventoryItems.map((item) => item.id);
    const canonicalEulByInventoryId = new Map<string, string | null>();

    if (inventoryIds.length > 0) {
      const { data: poItems, error: poItemsError } = await supabase
        .from('purchase_order_items')
        .select('estimated_useful_life, inventory_item_ids')
        .overlaps('inventory_item_ids', inventoryIds);

      if (!poItemsError) {
        (poItems || []).forEach((poItem) => {
          const normalizedPoEul = this.normalizeEstimatedUsefulLife(poItem.estimated_useful_life);
          (poItem.inventory_item_ids || []).forEach((inventoryItemId: string) => {
            if (inventoryById.has(inventoryItemId)) canonicalEulByInventoryId.set(inventoryItemId, normalizedPoEul);
          });
        });
      }

      for (const inventoryItem of inventoryItems) {
        const canonicalEul = canonicalEulByInventoryId.has(inventoryItem.id)
          ? canonicalEulByInventoryId.get(inventoryItem.id) ?? null
          : this.normalizeEstimatedUsefulLife(inventoryItem.estimated_useful_life);
        
        canonicalEulByInventoryId.set(inventoryItem.id, canonicalEul);
        if (this.normalizeEstimatedUsefulLife(inventoryItem.estimated_useful_life) !== canonicalEul) {
          await supabase.from('inventory_items').update({ estimated_useful_life: canonicalEul }).eq('id', inventoryItem.id);
          inventoryItem.estimated_useful_life = canonicalEul;
        }
      }
    }

    const itemsByGroup: { [key: string]: { subCategory: string; category: string; items: any[] } } = {};
    for (const item of inventoryItems) {
      const subCategory = item.sub_category || 'Unknown';
      const category = item.semi_expandable_category || item.category || 'Unknown Category';
      const groupKey = `${subCategory}:::${category}`;
      if (!itemsByGroup[groupKey]) itemsByGroup[groupKey] = { subCategory, category, items: [] };
      itemsByGroup[groupKey].items.push(item);
    }

    const createdSlips: AnnexCustodianSlip[] = [];
    const successfulSlipMetadata: any[] = [];

    try {
      for (const groupKey of Object.keys(itemsByGroup)) {
        const { subCategory, category, items: itemsForGroup } = itemsByGroup[groupKey];
        const subCategoryPrefix = subCategory === 'Small Value Expendable' ? 'SPLV' : 'SPHV';

        const { data: generatedNumber } = await supabase.rpc('generate_ics_number', { sub_category_prefix: subCategoryPrefix });
        
        const slipData = {
          slip_number: generatedNumber || null,
          custodian_name: request.custodianName,
          designation: request.designation,
          office: request.office,
          date_issued: request.dateIssued,
          issued_by: request.issuedBy,
          issued_by_position: request.issuedByPosition || null,
          received_by: request.receivedBy,
          slip_status: 'Draft'
        };

        const { data: slip, error: slipError } = await supabase.from('custodian_slips').insert(slipData).select().single();
        if (slipError) throw new Error(`Failed to create custodian slip: ${slipError.message}`);

        const createdSlipItemIds: string[] = [];
        const updatedInventoryIds: string[] = [];
        const createdPropertyCardEntryIds: string[] = [];

        try {
          const slipItemPayloads = itemsForGroup.map((inventoryItem) => {
            const itemTotalCost = (inventoryItem.quantity || 1) * (inventoryItem.unit_cost || 0);
            return {
              slip_id: slip.id,
              inventory_item_id: inventoryItem.id,
              property_number: inventoryItem.property_number,
              description: this.buildSafeDescription(inventoryItem),
              quantity: inventoryItem.quantity || 1,
              unit: inventoryItem.unit_of_measure,
              unit_cost: inventoryItem.unit_cost || 0,
              total_cost: itemTotalCost,
              amount: itemTotalCost,
              estimated_useful_life: canonicalEulByInventoryId.get(inventoryItem.id),
              date_issued: request.dateIssued
            };
          });

          const { data: insertedSlipItems, error: slipItemsError } = await supabase.from('custodian_slip_items').insert(slipItemPayloads).select('*');
          if (slipItemsError) throw new Error(`Failed to add items to slip: ${slipItemsError.message}`);
          createdSlipItemIds.push(...(insertedSlipItems || []).map(i => i.id));

          const { data: propertyCards } = await supabase.from('property_cards').select('*').in('inventory_item_id', itemsForGroup.map(i => i.id));
          const pcByInvId = new Map((propertyCards || []).map(pc => [pc.inventory_item_id, pc]));

          const issueEntryPayloads = itemsForGroup.map(item => {
            const pc = pcByInvId.get(item.id);
            if (!pc) throw new Error(`Property card not found for ${item.property_number}`);
            return {
              property_card_id: pc.id,
              date: request.dateIssued,
              reference: `ICS ${slip.slip_number || 'PENDING'}`,
              issue_item_no: item.property_number || '',
              issue_qty: item.quantity || 1,
              office_officer: `${request.office}-${request.custodianName}`,
              balance_qty: 0,
              remarks: `Issued via ICS ${slip.slip_number || 'PENDING'}`,
              related_slip_id: slip.id,
              inventory_item_id: item.id
            };
          });

          const { data: insertedEntries, error: entriesError } = await supabase.from('property_card_entries').insert(issueEntryPayloads).select('*');
          if (entriesError) throw new Error(`Failed to create entries: ${entriesError.message}`);
          createdPropertyCardEntryIds.push(...(insertedEntries || []).map(e => e.id));

          await supabase.from('inventory_items').update({
            custodian: request.custodianName,
            custodian_position: request.designation,
            assignment_status: 'Assigned',
            assigned_date: request.dateIssued,
            ics_number: slip.slip_number,
            ics_date: request.dateIssued
          }).in('id', itemsForGroup.map(i => i.id));
          updatedInventoryIds.push(...itemsForGroup.map(i => i.id));

          createdSlips.push({
            ...this.mapToAnnexCustodianSlip(slip),
            items: (insertedSlipItems || []).map(i => this.mapToAnnexCustodianSlipItem(i))
          });
          successfulSlipMetadata.push({ slipId: slip.id, slipItemIds: createdSlipItemIds, entryIds: createdPropertyCardEntryIds, invIds: updatedInventoryIds });
        } catch (err) {
          await this.rollbackCustodianSlipCreation(slip.id, createdSlipItemIds, createdPropertyCardEntryIds, updatedInventoryIds);
          throw err;
        }
      }
      return createdSlips.length === 1 ? createdSlips[0] : createdSlips;
    } catch (err) {
      for (const meta of successfulSlipMetadata.reverse()) await this.rollbackCustodianSlipCreation(meta.slipId, meta.slipItemIds, meta.entryIds, meta.invIds);
      throw err;
    }
  }

  private async rollbackCustodianSlipCreation(slipId: string, slipItemIds: string[], entryIds: string[], invIds: string[]) {
    if (entryIds.length) await supabase.from('property_card_entries').delete().in('id', entryIds);
    if (slipItemIds.length) await supabase.from('custodian_slip_items').delete().in('id', slipItemIds);
    if (invIds.length) await supabase.from('inventory_items').update({ custodian: null, assignment_status: 'Available', ics_number: null }).in('id', invIds);
    await supabase.from('custodian_slips').delete().eq('id', slipId);
  }

  async deleteCustodianSlip(slipId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: slipItems } = await supabase.from('custodian_slip_items').select('inventory_item_id').eq('slip_id', slipId);
      if (slipItems?.length) {
        const invIds = slipItems.map(i => i.inventory_item_id).filter(Boolean);
        await supabase.from('inventory_items').update({
          custodian: null, custodian_position: null, assignment_status: 'Available',
          assigned_date: null, ics_number: null, ics_date: null, updated_at: new Date().toISOString()
        }).in('id', invIds);
      }
      await supabase.from('transfer_items').update({ ics_slip_id: null, custodian_slip_item_id: null }).eq('ics_slip_id', slipId);
      await supabase.from('property_card_entries').delete().eq('related_slip_id', slipId);
      await supabase.from('custodian_slip_items').delete().eq('slip_id', slipId);
      const { error } = await supabase.from('custodian_slips').delete().eq('id', slipId);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getCustodianSlipWithItems(id: string): Promise<AnnexCustodianSlip | null> {
    const { data: slip } = await supabase
      .from('custodian_slips')
      .select('*, custodian_slip_items(*, inventory_items(date_acquired, serial_number, estimated_useful_life))')
      .eq('id', id)
      .single();
    if (!slip) return null;
    return { ...this.mapToAnnexCustodianSlip(slip), items: (slip.custodian_slip_items || []).map((i: any) => this.mapToAnnexCustodianSlipItem(i)) };
  }

  async fetchPropertyCardWithEntries(cardId: string): Promise<AnnexPropertyCard | null> {
    const { data: card, error } = await supabase
      .from('property_cards')
      .select('*, property_card_entries(*)')
      .eq('id', cardId)
      .single();

    if (error || !card) return null;

    const result = this.mapToAnnexPropertyCard(card);
    result.entries = (card.property_card_entries || []).map((entry: any) => this.mapToAnnexSPCEntry(entry));
    return result;
  }

  private mapToAnnexInventoryItem(item: any): AnnexInventoryItem {
    return {
      id: item.id,
      propertyNumber: item.property_number,
      description: item.description,
      brand: item.brand,
      model: item.model,
      serialNumber: item.serial_number,
      unitOfMeasure: item.unit_of_measure,
      quantity: item.quantity,
      unitCost: item.unit_cost,
      totalCost: item.total_cost,
      dateAcquired: item.date_acquired,
      supplier: item.supplier,
      condition: item.condition,
      location: item.location,
      fundSource: item.fund_source_id,
      remarks: item.remarks,
      status: item.status,
      assignmentStatus: item.assignment_status,
      custodian: item.custodian,
      custodianPosition: item.custodian_position || '',
      accountableOfficer: item.accountable_officer || '',
      category: item.category || 'Semi-Expendable',
      createdAt: item.created_at,
      updatedAt: item.updated_at
    };
  }

  private mapToAnnexPropertyCard(data: any): AnnexPropertyCard {
    return {
      id: data.id,
      entityName: data.entity_name,
      fundCluster: data.fund_cluster,
      semiExpendableProperty: data.semi_expendable_property,
      propertyNumber: data.property_number,
      description: data.description,
      dateAcquired: data.date_acquired,
      remarks: data.remarks,
      inventoryItemId: data.inventory_item_id,
      serialNumber: data.inventory_items?.serial_number || data.serial_number,
      entries: [],
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  private mapToAnnexSPCEntry(data: any): AnnexSPCEntry {
    return {
      id: data.id, propertyCardId: data.property_card_id, date: data.date, reference: data.reference,
      receiptQty: data.receipt_qty || 0, unitCost: data.unit_cost || 0, totalCost: data.total_cost || 0,
      issueItemNo: data.issue_item_no || '', issueQty: data.issue_qty || 0, officeOfficer: data.office_officer || '',
      balanceQty: data.balance_qty || 0, amount: data.amount || 0, remarks: data.remarks,
      relatedSlipId: data.related_slip_id, relatedTransferId: data.related_transfer_id,
      createdAt: data.created_at, updatedAt: data.updated_at
    };
  }

  private mapToAnnexCustodianSlip(data: any): AnnexCustodianSlip {
    return {
      id: data.id, slipNumber: data.slip_number, custodianName: data.custodian_name,
      designation: data.designation, office: data.office, dateIssued: data.date_issued,
      issuedBy: data.issued_by, issuedByPosition: data.issued_by_position || '',
      receivedBy: data.received_by, slipStatus: data.slip_status || 'Draft',
      items: [], createdAt: data.created_at, updatedAt: data.updated_at
    };
  }

  private mapToAnnexCustodianSlipItem(data: any): AnnexCustodianSlipItem {
    return {
      id: data.id,
      slipId: data.slip_id,
      inventoryItemId: data.inventory_item_id,
      propertyNumber: data.property_number,
      description: data.description,
      quantity: data.quantity,
      unit: data.unit,
      unitCost: data.unit_cost || 0,
      totalCost: data.total_cost || 0,
      amount: data.amount || 0,
      itemNumber: data.item_number || '',
      estimatedUsefulLife: data.estimated_useful_life || '',
      dateIssued: data.date_issued,
      dateAcquired: data.inventory_items?.date_acquired || '',
      propertyCardEntryId: data.property_card_entry_id,
      serialNumber: data.inventory_items?.serial_number || data.serial_number,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    } as any;
  }
}

export const annexService = new AnnexService();
