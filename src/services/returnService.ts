import { supabase, handleSupabaseResponse } from '@/lib/supabase';
import { formatReturnItemDescription } from '@/lib/returnItemDescription';
import { 
  AnnexReturnSlip, 
  AnnexReturnSlipItem, 
  CreateReturnSlipRequest,
  AnnexRRSPPrintData
} from '@/types/annex';

export const returnService = {
  async getReturnSlips(): Promise<AnnexReturnSlip[]> {
    const { data, error } = await supabase
      .from('return_slips')
      .select(`
        *,
        return_slip_items(
          *,
          inventory_items (
            description,
            date_acquired,
            unit_cost,
            total_cost,
            quantity
          )
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map(slip => ({
      ...this.mapToAnnexReturnSlip(slip),
      items: (slip.return_slip_items || []).map((item: any) => this.mapToAnnexReturnSlipItem(item))
    }));
  },

  async getReturnSlipWithItems(id: string): Promise<AnnexReturnSlip> {
    const { data, error } = await supabase
      .from('return_slips')
      .select(`
        *,
        return_slip_items(
          *,
          inventory_items (
            description,
            date_acquired,
            unit_cost,
            total_cost,
            quantity
          )
        )
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    return {
      ...this.mapToAnnexReturnSlip(data),
      items: (data.return_slip_items || []).map((item: any) => this.mapToAnnexReturnSlipItem(item))
    };
  },

  async createReturnSlip(request: CreateReturnSlipRequest): Promise<AnnexReturnSlip> {
    if (!request.inventoryItemIds || request.inventoryItemIds.length === 0) {
      throw new Error('No inventory items selected for return');
    }

    // 1. Fetch inventory items to validate and get current state
    const { data: inventoryItems, error: invError } = await supabase
      .from('inventory_items')
      .select('*')
      .in('id', request.inventoryItemIds);

    if (invError) throw invError;
    if (!inventoryItems || inventoryItems.length === 0) throw new Error('Selected inventory items not found');

    // 2. Generate RRSP Number (RPC call - needs to be created in Supabase)
    const { data: rrspNumber, error: rpcError } = await supabase.rpc('generate_rrsp_number');
    if (rpcError) {
      console.warn('Failed to generate RRSP number via RPC, using fallback:', rpcError);
    }

    // 3. Create Return Slip header
    const { data: slip, error: slipError } = await supabase
      .from('return_slips')
      .insert({
        rrsp_number: rrspNumber || `RRSP-${Date.now()}`,
        entity_name: request.entityName,
        date: request.date,
        returned_by: request.returnedBy,
        returned_by_designation: request.returnedByDesignation,
        received_by: request.receivedBy,
        received_by_designation: request.receivedByDesignation,
        status: 'Completed'
      })
      .select()
      .single();

    if (slipError) throw slipError;

    // 4. Create Return Slip items
    const slipItemsPayload = inventoryItems.map(item => ({
      return_slip_id: slip.id,
      inventory_item_id: item.id,
      item_description: formatReturnItemDescription({
        description: item.description,
        date_acquired: item.date_acquired,
        unit_cost: item.unit_cost,
        total_cost: item.total_cost,
        quantity: item.quantity,
      }),
      quantity: item.quantity || 1,
      ics_number: item.ics_number || 'N/A',
      end_user: item.custodian || 'N/A',
      remarks: request.remarksByItemId?.[item.id] || ''
    }));

    const { data: slipItems, error: itemsError } = await supabase
      .from('return_slip_items')
      .insert(slipItemsPayload)
      .select();

    if (itemsError) throw itemsError;

    // 5. Update Inventory items status and condition individually
    for (const item of inventoryItems) {
      const targetCondition = request.conditionsByItemId?.[item.id] || 'Serviceable';
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({
          assignment_status: 'Available',
          condition: targetCondition,
          custodian: null,
          custodian_position: null,
          ics_number: null,
          ics_date: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (updateError) throw updateError;
    }

    // 6. Create Property Card Entries (Return is a receipt back to inventory)
    // First, find property cards for these items
    const { data: propertyCards } = await supabase
      .from('property_cards')
      .select('*')
      .in('inventory_item_id', request.inventoryItemIds);

    if (propertyCards && propertyCards.length > 0) {
      const pcByInvId = new Map(propertyCards.map(pc => [pc.inventory_item_id, pc]));
      
      const pcEntriesPayload = inventoryItems.map(item => {
        const pc = pcByInvId.get(item.id);
        if (!pc) return null;
        
        return {
          property_card_id: pc.id,
          date: request.date,
          reference: `RRSP ${slip.rrsp_number}`,
          receipt_qty: item.quantity || 1,
          unit_cost: item.unit_cost || 0,
          total_cost: (item.quantity || 1) * (item.unit_cost || 0),
          balance_qty: item.quantity || 1, // Simplified: assuming return resets balance to quantity
          amount: (item.quantity || 1) * (item.unit_cost || 0),
          office_officer: request.returnedBy,
          remarks: `Returned via RRSP ${slip.rrsp_number}`,
          inventory_item_id: item.id
        };
      }).filter(Boolean);

      if (pcEntriesPayload.length > 0) {
        await supabase.from('property_card_entries').insert(pcEntriesPayload);
      }
    }

    return {
      ...this.mapToAnnexReturnSlip(slip),
      items: (slipItems || []).map(i => this.mapToAnnexReturnSlipItem(i))
    };
  },

  mapToAnnexReturnSlip(dbRow: any): AnnexReturnSlip {
    return {
      id: dbRow.id,
      rrspNumber: dbRow.rrsp_number,
      entityName: dbRow.entity_name,
      date: dbRow.date,
      returnedBy: dbRow.returned_by,
      returnedByDesignation: dbRow.returned_by_designation,
      receivedBy: dbRow.received_by,
      receivedByDesignation: dbRow.received_by_designation,
      status: dbRow.status,
      items: [],
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at
    };
  },

  mapToAnnexReturnSlipItem(dbRow: any): AnnexReturnSlipItem {
    const inv = dbRow.inventory_items;
    const itemDescription = inv
      ? formatReturnItemDescription({
          description: inv.description ?? dbRow.item_description,
          date_acquired: inv.date_acquired,
          unit_cost: inv.unit_cost,
          total_cost: inv.total_cost,
          quantity: dbRow.quantity ?? inv.quantity,
        })
      : dbRow.item_description;

    return {
      id: dbRow.id,
      returnSlipId: dbRow.return_slip_id,
      inventoryItemId: dbRow.inventory_item_id,
      itemDescription,
      quantity: dbRow.quantity,
      icsNumber: dbRow.ics_number,
      endUser: dbRow.end_user,
      remarks: dbRow.remarks
    };
  }
};
