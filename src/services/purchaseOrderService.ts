import { supabase } from '../lib/supabase';
import { PurchaseOrder, PurchaseOrderItem, IARReport, IARItem } from '../types/purchaseOrder';
import { simpleInventoryService, syncInventoryRelatedRecords } from './simpleInventoryService';
import { generateBulkPropertyNumbers } from './propertyNumberService';
import { annexService } from './annexService';

const normalizeEstimatedUsefulLife = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

export const purchaseOrderService = {
    // --- Purchase Orders ---
    async getAllPOs() {
        const { data, error } = await supabase
            .from('purchase_orders')
            .select('*, suppliers(name)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async getPOById(id: string) {
        const { data: poData, error } = await supabase
            .from('purchase_orders')
            .select('*, purchase_order_items(*), suppliers(*)')
            .eq('id', id)
            .single();

        if (error) throw error;

        // Map column names to interface properties
        const transformed: PurchaseOrder = {
            ...poData,
            poNumber: poData.po_number,
            poDate: poData.po_date,
            supplierId: poData.supplier_id,
            modeOfProcurement: poData.mode_of_procurement,
            placeOfDelivery: poData.place_of_delivery,
            deliveryTerm: poData.delivery_term,
            paymentTerm: poData.payment_term,
            fundCluster: poData.fund_cluster,
            fundSourceId: poData.fund_source_id,
            orsBursNumber: poData.ors_burs_number,
            orsBursDate: poData.ors_burs_date,
            prNumber: poData.pr_number,
            purchase_order_items: (poData.purchase_order_items || []).map((item: any) => {
                const uCost = Number(item.unit_cost || item.unitCost || 0);
                return {
                    ...item,
                    unitCost: uCost,
                    unit_cost: uCost, // Add both for compatibility
                    totalCost: uCost * (item.quantity || 0),
                    quantityStocked: item.quantity_stocked || 0,
                    inventoryItemIds: item.inventory_item_ids || [],
                    category: item.semi_expandable_category || '',
                    estimatedUsefulLife: normalizeEstimatedUsefulLife(item.estimated_useful_life) ?? '',
                    serialNumber: item.serial_number || ''
                };
            })
        };

        return transformed;
    },

    async createPO(po: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt' | 'purchase_order_items' | 'suppliers'>, items: Omit<PurchaseOrderItem, 'id' | 'poId' | 'createdAt' | 'updatedAt' | 'totalCost'>[]) {
        // Threshold check removed to allow for PPE tracking

        const { data: newPo, error: poError } = await supabase
            .from('purchase_orders')
            .insert({
                po_number: po.poNumber,
                po_date: po.poDate,
                supplier_id: po.supplierId || null,
                mode_of_procurement: po.modeOfProcurement,
                place_of_delivery: po.placeOfDelivery,
                delivery_term: po.deliveryTerm,
                payment_term: po.paymentTerm,
                fund_cluster: po.fundCluster || '01',
                fund_source_id: po.fundSourceId || null,
                ors_burs_number: po.orsBursNumber,
                ors_burs_date: (po.orsBursDate && po.orsBursDate.trim() !== "") ? po.orsBursDate : null,
                office: po.office,
                purpose: po.purpose,
                abc: po.abc,
                pr_number: po.prNumber,
                status: po.status || 'Pending',
                remarks: po.remarks || ''
            })
            .select()
            .single();

        if (poError) throw poError;
        if (!newPo) throw new Error("Failed to create Purchase Order record.");

        try {
            const itemsToInsert = items.map(item => {
                const uCost = Number(item.unitCost || (item as any).unit_cost || 0);
                const qty = Number(item.quantity || 0);
                return {
                    po_id: newPo.id,
                    description: String(item.description || '').trim(),
                    quantity: qty,
                    unit: String(item.unit || 'piece').trim(),
                    unit_cost: uCost,
                    remarks: String(item.remarks || '').trim(),
                    semi_expandable_category: String((item as any).category || (item as any).semi_expandable_category || '').trim(),
                    estimated_useful_life: normalizeEstimatedUsefulLife((item as any).estimatedUsefulLife),
                    serial_number: String((item as any).serialNumber || (item as any).serial_number || '').trim()
                };
            });

            const { error: itemsError } = await supabase
                .from('purchase_order_items')
                .insert(itemsToInsert);

            if (itemsError) throw itemsError;

            return newPo;
        } catch (error) {
            // ROLLBACK: If items fail, delete the partial PO header to prevent 409 conflicts later
            console.error("[PO Create] Items failed, rolling back PO header...", error);
            await supabase.from('purchase_orders').delete().eq('id', newPo.id);
            throw error;
        }
    },

    async updatePO(poId: string, po: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt' | 'purchase_order_items' | 'suppliers'>, items: PurchaseOrderItem[]) {
        // Fetch current PO to check if PO Number changed
        const { data: currentPo } = await supabase
            .from('purchase_orders')
            .select('po_number')
            .eq('id', poId)
            .single();
        
        const oldPoNumber = currentPo?.po_number;
        const newPoNumber = po.poNumber;

            // Threshold check removed to allow for PPE tracking

        const { error: poError } = await supabase
            .from('purchase_orders')
            .update({
                po_number: po.poNumber,
                po_date: po.poDate,
                supplier_id: po.supplierId || null,
                mode_of_procurement: po.modeOfProcurement,
                place_of_delivery: po.placeOfDelivery,
                delivery_term: po.deliveryTerm,
                payment_term: po.paymentTerm,
                fund_cluster: po.fundCluster || '01',
                fund_source_id: po.fundSourceId || null,
                pr_number: po.prNumber,
                office: po.office,
                purpose: po.purpose,
                abc: po.abc,
                status: po.status || 'Pending',
                remarks: po.remarks
            })
            .eq('id', poId);

        if (poError) throw poError;

        // Fetch existing items to manage updates/deletes securely
        const { data: existingItems, error: existingError } = await supabase
            .from('purchase_order_items')
            .select('id, quantity_stocked')
            .eq('po_id', poId);

        if (existingError) throw existingError;

        const existingItemIds = existingItems.map(i => i.id);
        const incomingIds = items.map(i => i.id).filter(Boolean);

        // Delete items that were removed in the edit form
        const itemsToDelete = existingItemIds.filter(id => !incomingIds.includes(id as string));
        if (itemsToDelete.length > 0) {
            const { error: deleteError } = await supabase
                .from('purchase_order_items')
                .delete()
                .in('id', itemsToDelete);
            if (deleteError) throw deleteError;
        }

        // 1. Bulk fetch all IAR links for this PO to avoid repeated queries in the loop
        const { data: allIarLinks } = await supabase
            .from('iar_items')
            .select('po_item_id, inventory_item_id')
            .in('po_item_id', existingItemIds);

        const linksByPoItemId = new Map<string, string[]>();
        (allIarLinks || []).forEach(link => {
            if (link.po_item_id && link.inventory_item_id) {
                const existing = linksByPoItemId.get(link.po_item_id) || [];
                linksByPoItemId.set(link.po_item_id, [...existing, link.inventory_item_id]);
            }
        });

        // 2. Insert or Update items
        for (const item of items) {
            const uCost = Number(item.unitCost || (item as any).unit_cost || 0);
            const qty = Number(item.quantity || 1);
            const category = (item as any).category || (item as any).semi_expandable_category || '';

            const payload = {
                po_id: poId,
                description: String(item.description || '').trim(),
                quantity: qty,
                unit: String(item.unit || 'piece').trim(),
                unit_cost: uCost,
                remarks: String(item.remarks || '').trim(),
                semi_expandable_category: String(category || '').trim(),
                estimated_useful_life: normalizeEstimatedUsefulLife((item as any).estimatedUsefulLife ?? (item as any).estimated_useful_life),
                serial_number: String((item as any).serialNumber || (item as any).serial_number || '').trim()
            };

            if (item.id && existingItemIds.includes(item.id)) {
                // Fetch the item state BEFORE updating it
                const { data: oldItemData } = await supabase
                    .from('purchase_order_items')
                    .select('description, serial_number, unit_cost, inventory_item_ids')
                    .eq('id', item.id)
                    .single();

                // Only update if something meaningful changed
                const hasChanged = 
                    oldItemData?.description !== payload.description || 
                    oldItemData?.serial_number !== payload.serial_number || 
                    Number(oldItemData?.unit_cost) !== payload.unit_cost;

                // Update existing item
                const { error: updateError } = await supabase
                    .from('purchase_order_items')
                    .update(payload)
                    .eq('id', item.id);
                if (updateError) throw updateError;

                if (!hasChanged) continue; // Skip sync if no changes

                // --- Sync to already-stocked inventory items ---
                let linkedInventoryIds = oldItemData?.inventory_item_ids || linksByPoItemId.get(item.id) || [];
                
                if (linkedInventoryIds.length > 0) {
                    // Update inventory_items in bulk
                    const invUpdate: any = {
                        description: payload.description,
                        unit_cost: payload.unit_cost,
                        total_cost: payload.unit_cost,
                        estimated_useful_life: payload.estimated_useful_life,
                        serial_number: payload.serial_number,
                        semi_expandable_category: category
                    };
                    
                    await supabase
                        .from('inventory_items')
                        .update(invUpdate)
                        .in('id', linkedInventoryIds);

                    // Cascade changes to all related forms (Property Cards, ICS, etc.)
                    // We call this sparingly only when something changed
                    await syncInventoryRelatedRecords(linkedInventoryIds, { 
                        oldPoNumber, 
                        newPoNumber 
                    });

                    // One-time repair: If we found IDs via fallback/IAR links that weren't in the array
                    // Also repair the 'quantity_stocked' if it was incorrectly 0
                    if (!oldItemData?.inventory_item_ids || oldItemData.inventory_item_ids.length === 0) {
                        await supabase
                            .from('purchase_order_items')
                            .update({ 
                                inventory_item_ids: linkedInventoryIds,
                                quantity_stocked: linkedInventoryIds.length 
                            })
                            .eq('id', item.id);
                    }
                } else if (oldPoNumber) {
                    // FINAL FUZZY FALLBACK: If still no link, search by keywords as a last resort
                    // This specifically fixes the "Opthalmoscope" issue where it's labeled as unstocked
                    const { data: invMatches } = await supabase
                        .from('inventory_items')
                        .select('id, description')
                        .ilike('remarks', `%PO ${oldPoNumber}%`);

                    if (invMatches && invMatches.length > 0) {
                        const keywords = payload.description.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(t => t.length > 3);
                        const matchedIds = invMatches
                            .filter(inv => keywords.some(k => (inv.description || '').toLowerCase().includes(k)))
                            .map(inv => inv.id);

                        if (matchedIds.length > 0) {
                            console.log(`[Sync Repair] Found ${matchedIds.length} lost items for ${item.description}. Healing link and status...`);
                            
                            // Repair the link AND the stocked status
                            await supabase
                                .from('purchase_order_items')
                                .update({ 
                                    inventory_item_ids: matchedIds,
                                    quantity_stocked: matchedIds.length 
                                })
                                .eq('id', item.id);
                            
                            // Now sync the data to these newly found items
                            await supabase
                                .from('inventory_items')
                                .update({
                                    description: payload.description,
                                    serial_number: payload.serial_number,
                                    unit_cost: payload.unit_cost
                                })
                                .in('id', matchedIds);

                            await syncInventoryRelatedRecords(matchedIds, { oldPoNumber, newPoNumber });
                        }
                    }
                }
            } else {
                // Insert new item
                const { error: insertError } = await supabase
                    .from('purchase_order_items')
                    .insert(payload);
                if (insertError) throw insertError;
            }
        }

        return true;
    },

    // --- IAR Reports ---
    async getAllIARs() {
        const { data, error } = await supabase
            .from('iar_reports')
            .select('*, purchase_orders(po_number)')
            .order('iar_date', { ascending: false });

        if (error) throw error;
        return data;
    },

    async getIARById(id: string) {
        const { data, error } = await supabase
            .from('iar_reports')
            .select('*, iar_items(*), purchase_orders(*)')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    async createIAR(iar: Omit<IARReport, 'id' | 'createdAt' | 'updatedAt' | 'iar_items' | 'purchase_orders'>, items: Omit<IARItem, 'id' | 'iarId' | 'createdAt'>[]) {
        const { data: newIar, error: iarError } = await supabase
            .from('iar_reports')
            .insert({
                iar_number: iar.iarNumber,
                iar_date: iar.iarDate,
                po_id: iar.poId || null,
                invoice_no: iar.invoiceNo,
                invoice_date: iar.invoiceDate || null,
                delivery_receipt_no: iar.deliveryReceiptNo,
                delivery_receipt_date: iar.deliveryReceiptDate || null,
                inspection_date: iar.inspectionDate || null,
                acceptance_date: iar.acceptanceDate || null,
                inspection_officer: iar.inspectionOfficer,
                acceptance_officer: iar.acceptanceOfficer,
                status: iar.status,
                inspection_remarks: iar.inspectionRemarks,
                acceptance_remarks: iar.acceptanceRemarks
            })
            .select()
            .single();

        if (iarError) throw iarError;

        const itemsToInsert = items.map(item => ({
            iar_id: newIar.id,
            po_item_id: item.poItemId,
            description: item.description,
            quantity_received: item.quantityReceived,
            unit: item.unit,
            unit_cost: item.unitCost,
            is_accepted: item.isAccepted,
            iar_remarks: item.iarRemarks
        }));

        const { error: itemsError } = await supabase
            .from('iar_items')
            .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        return newIar;
    },

    // --- Inventory Ingestion ---
    async acceptIarAndGenerateInventory(iarId: string) {
        // 1. Get IAR and its items
        const { data: iar, error: iarError } = await supabase
            .from('iar_reports')
            .select('*, iar_items(*), purchase_orders(*)')
            .eq('id', iarId)
            .single();

        if (iarError) throw iarError;
        if (iar.status === 'Accepted') {
            throw new Error('This IAR has already been accepted and processed.');
        }

        // 2. Filter accepted items that haven't been ingested yet
        const itemsToIngest = iar.iar_items.filter((item: any) => item.is_accepted && !item.inventory_item_id);

        if (itemsToIngest.length === 0) {
            throw new Error('No new accepted items found to ingest into inventory.');
        }

        const results = [];
        const errors = [];

        // 3. For each item, create an inventory entry
        for (let i = 0; i < itemsToIngest.length; i++) {
            const item = itemsToIngest[i];
            // Determine subCategory based on unitCost (GSO semi-expandable rules)
            const subCategory = item.unit_cost >= 5000 ? 'High Value Expendable' : 'Small Value Expendable';

            const inventoryItem = {
                propertyNumber: `IAR-${iar.iar_number}-${i + 1}`, // Generate temporary property number
                description: item.description,
                brand: item.brand || '',
                model: item.model || '',
                serialNumber: item.serial_number || '',
                unitOfMeasure: item.unit,
                quantity: item.quantity_received,
                unitCost: item.unit_cost,
                totalCost: item.quantity_received * item.unit_cost,
                dateAcquired: iar.iar_date,
                supplier: iar.purchase_orders?.supplier_id || null, // Handle potential missing join
                condition: 'Serviceable',
                subCategory: subCategory,
                status: 'Active',
                remarks: `Ingested from IAR ${iar.iar_number}`
            };

            const response = await simpleInventoryService.create(inventoryItem as any);

            if (response.success && response.data) {
                // Link the IAR item to the created inventory item
                await supabase
                    .from('iar_items')
                    .update({ inventory_item_id: response.data.id })
                    .eq('id', item.id);

                results.push(response.data);
            } else {
                errors.push(`${item.description}: ${response.error}`);
                console.error(`Failed to ingest item ${item.description}:`, response.error);
            }
        }

        // 4. Report errors if any happened
        if (results.length === 0 && itemsToIngest.length > 0) {
            throw new Error(`Failed to ingest any items: ${errors.join(', ')}`);
        }

        // 5. Update IAR status only if we at least added one item (or if it was already partially handled)
        if (results.length > 0) {
            await supabase
                .from('iar_reports')
                .update({
                    status: 'Accepted',
                    acceptance_date: new Date().toISOString()
                })
                .eq('id', iarId);

            // 6. Update PO status if all items are received
            await supabase
                .from('purchase_orders')
                .update({ status: 'Received' })
                .eq('id', iar.po_id);
        }

        return results;
    },

    async deletePO(id: string) {
        // 1. Fetch line items and their inventory_item_ids
        const { data: poItems, error: fetchError } = await supabase
            .from('purchase_order_items')
            .select('inventory_item_ids')
            .eq('po_id', id);
        
        if (fetchError) throw fetchError;

        // 2. Identify all related inventory items
        const inventoryItemIds = Array.from(new Set((poItems || []).flatMap(item => item.inventory_item_ids || [])));
        
        // 3. Identify all custodian slips and transfers that will be affected
        let affectedSlipIds: string[] = [];
        let affectedTransferIds: string[] = [];
        
        if (inventoryItemIds.length > 0) {
            const [slipItemsResult, transferItemsResult] = await Promise.all([
                supabase.from('custodian_slip_items').select('slip_id').in('inventory_item_id', inventoryItemIds),
                supabase.from('transfer_items').select('transfer_id').in('inventory_item_id', inventoryItemIds)
            ]);
            
            affectedSlipIds = Array.from(new Set((slipItemsResult.data || []).map(si => si.slip_id)));
            affectedTransferIds = Array.from(new Set((transferItemsResult.data || []).map(ti => ti.transfer_id)));
        }

        // 4. Identify IARs linked to this PO
        const { data: iarReports } = await supabase
            .from('iar_reports')
            .select('id')
            .eq('po_id', id);
        const iarIds = (iarReports || []).map(r => r.id);

        if (inventoryItemIds.length > 0) {
            console.log(`[PO Deletion] Performing bulk cleanup for ${inventoryItemIds.length} inventory items linked to PO ${id}`);
            
            // Delete child records first to satisfy FK constraints
            await Promise.allSettled([
                supabase.from('custodian_slip_items').delete().in('inventory_item_id', inventoryItemIds),
                supabase.from('property_card_entries').delete().in('inventory_item_id', inventoryItemIds),
                supabase.from('transfer_items').delete().in('inventory_item_id', inventoryItemIds),
                supabase.from('property_cards').delete().in('inventory_item_id', inventoryItemIds),
                supabase.from('iar_items').delete().in('inventory_item_id', inventoryItemIds)
            ]);

            // Bulk Delete the inventory items
            await supabase.from('inventory_items').delete().in('id', inventoryItemIds);
        }

        // 5. Cleanup IARs (Documents generated from this PO)
        if (iarIds.length > 0) {
            // Delete IAR items first
            await supabase.from('iar_items').delete().in('iar_id', iarIds);
            // Delete IAR reports
            await supabase.from('iar_reports').delete().in('id', iarIds);
        }

        // 6. Cleanup empty parent forms (ICS and ITR)
        // If a slip or transfer is now empty after removing the PO items, remove the form itself
        if (affectedSlipIds.length > 0) {
            for (const slipId of affectedSlipIds) {
                const { count } = await supabase
                    .from('custodian_slip_items')
                    .select('*', { count: 'exact', head: true })
                    .eq('slip_id', slipId);
                
                if (count === 0) {
                    await supabase.from('custodian_slips').delete().eq('id', slipId);
                }
            }
        }

        if (affectedTransferIds.length > 0) {
            for (const transferId of affectedTransferIds) {
                const { count } = await supabase
                    .from('transfer_items')
                    .select('*', { count: 'exact', head: true })
                    .eq('transfer_id', transferId);
                
                if (count === 0) {
                    await supabase.from('property_transfers').delete().eq('id', transferId);
                }
            }
        }

        // 7. Finally delete the PO record (this cascades to purchase_order_items)
        const { error: poDeleteError } = await supabase
            .from('purchase_orders')
            .delete()
            .eq('id', id);

        if (poDeleteError) throw poDeleteError;
    },

    async deleteIAR(id: string) {
        const { error } = await supabase
            .from('iar_reports')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async stockInItems(poId: string, itemsToStock: { poItemId: string, quantityToStock: number, description: string, unit: string, unitCost: number, manualPropertyNumbers?: string[] }[]) {
        if (itemsToStock.length === 0) throw new Error('No items selected for stock in.');

        console.log(`[Stock-In] Starting optimized bulk stock-in for PO ${poId}...`);
        const startTime = Date.now();

        const results = [];
        const errors = [];
        const propertyCardRequests: any[] = [];
        const poItemUpdates: any[] = [];

        // 1. Fetch current PO data and resolve fund source in parallel
        const [po, fundSourceResult] = await Promise.all([
            this.getPOById(poId),
            (async () => {
                // We'll resolve fund source after we have the PO, so just return null here
                return null;
            })()
        ]);
        if (!po) throw new Error('Purchase Order not found.');

        // 1b. Resolve fund source name
        let fundSourceName = po.fundCluster || '01';
        if (po.fundSourceId) {
            const { data: fsData } = await supabase.from('fund_sources').select('name, code').eq('id', po.fundSourceId).single();
            if (fsData) fundSourceName = fsData.name || fsData.code || fundSourceName;
        }

        const stockEntries = itemsToStock
            .map((entry) => ({
                ...entry,
                quantityToStock: Number(entry.quantityToStock || 0),
                unitCost: Number(entry.unitCost || 0),
            }))
            .filter((entry) => entry.quantityToStock > 0);

        // 2. Pre-generate all required property numbers (ONLY for Semi-Expendable < 50k)
        const countsBySubCategory = new Map<'Small Value Expendable' | 'High Value Expendable', number>();
        for (const entry of stockEntries) {
            if (entry.unitCost >= 50000) {
                console.log(`[Stock-In] Item "${entry.description}" is PPE (>= 50k). Marking as Stocked for tracking only.`);
                continue; // Skip property number generation for PPE
            }
            if (entry.manualPropertyNumbers?.length) {
                continue; // Legacy: property numbers supplied by user, skip generation
            }
            const subCategory = entry.unitCost >= 5000 ? 'High Value Expendable' : 'Small Value Expendable';
            countsBySubCategory.set(subCategory, (countsBySubCategory.get(subCategory) || 0) + entry.quantityToStock);
        }

        // 2b. Validate manually supplied (legacy) property numbers BEFORE any writes
        const manualNumbers = stockEntries.flatMap(e => (e.manualPropertyNumbers ?? []).map(n => (n || '').trim()));
        if (manualNumbers.length > 0) {
            for (const entry of stockEntries) {
                if (entry.manualPropertyNumbers?.length && entry.manualPropertyNumbers.length !== entry.quantityToStock) {
                    throw new Error(`${entry.description}: ${entry.manualPropertyNumbers.length} property number(s) provided for ${entry.quantityToStock} unit(s).`);
                }
            }
            if (manualNumbers.some(n => !n)) {
                throw new Error('Blank property numbers are not allowed.');
            }
            if (new Set(manualNumbers).size !== manualNumbers.length) {
                const seen = new Set<string>();
                const dupes = manualNumbers.filter(n => (seen.has(n) ? true : (seen.add(n), false)));
                throw new Error(`Duplicate property numbers within this stock-in batch: ${[...new Set(dupes)].join(', ')}`);
            }
            const { data: existing, error: dupError } = await supabase
                .from('inventory_items')
                .select('property_number')
                .in('property_number', manualNumbers);
            if (dupError) throw new Error(`Failed to verify property number uniqueness: ${dupError.message}`);
            if (existing && existing.length > 0) {
                throw new Error(`Property numbers already exist in inventory: ${existing.map(e => e.property_number).join(', ')}`);
            }
        }

        // Generate property numbers for all sub-categories in parallel
        const generatedNumbersBySubCategory = new Map<'Small Value Expendable' | 'High Value Expendable', string[]>();
        const genPromises = Array.from(countsBySubCategory.entries()).map(async ([subCategory, count]) => {
            const numbers = await generateBulkPropertyNumbers(subCategory, count);
            generatedNumbersBySubCategory.set(subCategory, numbers);
        });
        await Promise.all(genPromises);

        const numberOffsets = new Map<'Small Value Expendable' | 'High Value Expendable', number>();
        const today = new Date().toISOString().split('T')[0];

        // 3. Prepare ONE massive bulk insert for all inventory items
        const allInventoryPayloads: any[] = [];
        const poItemToPropNumbers = new Map<string, string[]>();
        const poItemToDate = new Map<string, string>();

        for (const entry of stockEntries) {
            const isPPE = entry.unitCost >= 50000;
            const acquisitionDate = (entry as any).dateAcquired || today;
            poItemToDate.set(entry.poItemId, acquisitionDate);
            
            if (isPPE) {
                // Prepare PO Item Update immediately for PPE (Tracking only)
                const poItem = po.purchase_order_items.find(i => i.id === entry.poItemId);
                poItemUpdates.push({
                    id: entry.poItemId,
                    quantity_stocked: (poItem?.quantityStocked || 0) + entry.quantityToStock,
                    inventory_item_ids: poItem?.inventoryItemIds || []
                });
                continue;
            }

            const subCategory = entry.unitCost >= 5000 ? 'High Value Expendable' : 'Small Value Expendable';
            const isLegacy = !!entry.manualPropertyNumbers?.length;
            let propertyNumbers: string[];
            if (isLegacy) {
                // Legacy: use the user-supplied existing property numbers as-is (validated in step 2b)
                propertyNumbers = entry.manualPropertyNumbers!.map(n => n.trim());
            } else {
                const generatedNumbers = generatedNumbersBySubCategory.get(subCategory) || [];
                const startIndex = numberOffsets.get(subCategory) || 0;
                propertyNumbers = generatedNumbers.slice(startIndex, startIndex + entry.quantityToStock);
                numberOffsets.set(subCategory, startIndex + entry.quantityToStock);
            }

            if (propertyNumbers.length !== entry.quantityToStock) {
                errors.push(`${entry.description}: insufficient property numbers.`);
                continue;
            }

            poItemToPropNumbers.set(entry.poItemId, propertyNumbers);

            const estimatedUsefulLife = normalizeEstimatedUsefulLife((entry as any).estimatedUsefulLife ?? (entry as any).estimated_useful_life);
            const semiExpandableCategory = (entry as any).category || (entry as any).semi_expandable_category || '';

            allInventoryPayloads.push(...propertyNumbers.map(propNum => ({
                property_number: propNum,
                description: entry.description,
                unit_of_measure: entry.unit,
                quantity: 1,
                unit_cost: entry.unitCost,
                total_cost: entry.unitCost,
                date_acquired: acquisitionDate, // Use the provided date
                supplier_id: po.supplier_id || null,
                condition: 'Serviceable',
                category: 'Semi-Expendable',
                sub_category: subCategory,
                semi_expandable_category: semiExpandableCategory || subCategory,
                status: 'Active',
                fund_source_id: po.fundSourceId || null,
                entity_name: "PROVINCIAL GOVERNMENT OF APAYAO",
                remarks: `Stocked in from PO ${po.po_number}${isLegacy ? ' (legacy)' : ''}`,
                estimated_useful_life: estimatedUsefulLife,
                serial_number: (entry as any).serialNumber || (entry as any).serial_number || null
            })));
        }

        if (allInventoryPayloads.length === 0 && stockEntries.some(e => e.unitCost < 50000)) {
            throw new Error(`Failed to prepare any items for stock-in: ${errors.join(', ')}`);
        }

        // 4. EXECUTE BULK INSERT (If any semi-expandable items)
        let insertedItems: any[] = [];
        if (allInventoryPayloads.length > 0) {
            console.log(`[Stock-In] Inserting ${allInventoryPayloads.length} inventory items in bulk...`);
            const { data, error: insertError } = await supabase
                .from('inventory_items')
                .insert(allInventoryPayloads)
                .select('id, property_number, description, brand, model, serial_number, date_acquired, remarks, quantity, unit_cost, total_cost, semi_expandable_category, category, estimated_useful_life');

            if (insertError) throw new Error(`Bulk insert failed: ${insertError.message}`);
            insertedItems = data || [];
            results.push(...insertedItems);
        }

        // 5. Link inserted items back to PO items and prepare property card requests
        const insertedByPropNum = new Map(insertedItems.map(item => [item.property_number, item]));

        for (const entry of stockEntries) {
            const propNums = poItemToPropNumbers.get(entry.poItemId) || [];
            const linkedItems = propNums.map(num => insertedByPropNum.get(num)).filter(Boolean);
            
            if (linkedItems.length > 0) {
                // Prepare PO Item Update for Semi-Expendable
                const poItem = po.purchase_order_items.find(i => i.id === entry.poItemId);
                const currentIds = poItem?.inventoryItemIds || [];
                const currentQty = poItem?.quantityStocked || 0;

                poItemUpdates.push({
                    id: entry.poItemId,
                    quantity_stocked: currentQty + linkedItems.length,
                    inventory_item_ids: [...currentIds, ...linkedItems.map(i => i!.id)]
                });

                // Prepare Property Card Requests
                const entryDate = poItemToDate.get(entry.poItemId) || today;
                propertyCardRequests.push(...linkedItems.map(invItem => ({
                    inventoryItem: invItem,
                    fundCluster: fundSourceName,
                    initialEntry: {
                        date: entryDate,
                        reference: `PO ${po.po_number}`,
                        receiptQty: 1,
                        unitCost: invItem!.unit_cost,
                        totalCost: invItem!.total_cost,
                        remarks: `Stocked in from PO ${po.po_number}`
                    }
                })));
            }
        }

        // 6. Execute Updates for PO Items (parallel updates)
        if (poItemUpdates.length > 0) {
            console.log(`[Stock-In] Updating ${poItemUpdates.length} purchase order item records in parallel...`);
            await Promise.all(poItemUpdates.map(update => {
                const { id, ...fields } = update;
                return supabase
                    .from('purchase_order_items')
                    .update(fields)
                    .eq('id', id)
                    .then(({ error }) => {
                        if (error) console.error(`PO Item ${id} update failed:`, error);
                    });
            }));
        }

        // 7. Compute final PO status
        const finalItemStates = po.purchase_order_items.map(item => {
            const update = poItemUpdates.find(u => u.id === item.id);
            return {
                quantity: item.quantity,
                quantity_stocked: update ? update.quantity_stocked : item.quantityStocked
            };
        });

        const allReceived = finalItemStates.every(item => item.quantity_stocked >= item.quantity);
        const anyReceived = finalItemStates.some(item => item.quantity_stocked > 0);
        let newStatus: PurchaseOrder['status'] = allReceived ? 'Received' : (anyReceived ? 'Partial' : 'Pending');

        // 8. Fire property card creation and PO status update in parallel (both are independent)
        await Promise.all([
            propertyCardRequests.length > 0
                ? annexService.createPropertyCardsFromInventory(propertyCardRequests).catch(err => {
                    console.error("Bulk property card creation failed:", err);
                })
                : Promise.resolve(),
            supabase.from('purchase_orders').update({ status: newStatus }).eq('id', poId)
        ]);

        console.log(`[Stock-In] Completed in ${Date.now() - startTime}ms`);
        return results;
    }
};
