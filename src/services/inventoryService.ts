import { supabase } from '@/lib/supabase';
import { hasNoFirmAccess, normalizeFirmAccess } from '@/lib/firmAccess';

/**
 * Inventory Service
 * Handles all Supabase operations for the Inventory component
 */

export interface InventoryRecord {
    itemName: string;
    groupHead: string;
    uom: string;
    opening: number;
    individualRate: number;
    individual_rate?: number;
    rate: number;
    indented: number;
    approved: number;
    purchaseQuantity: number;
    purchaseReturn: number;
    liftingQty: number;
    inTransit: number;
    outQuantity: number;
    issueReturn: number;
    stockTransfer: number;
    stockTransferGiven: number;
    stockTransferReceiving: number;
    fromProject: string;
    toProject: string;
    firmName: string;
    firm_id?: number;
    current: number;
    totalPrice: number;
    status: string;
}

export interface InventoryItemInput {
    itemName: string;
    groupHead: string;
    uom?: string;
    quantity: number;
    firmName?: string;
    firmId?: number;
}

function toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function getInventoryStatus(current: number): string {
    if (current <= 0) return 'red';
    if (current < 5) return 'red';
    return 'green';
}

function toTextNumber(value: number): string {
    return String(value);
}

/**
 * Fetch all inventory records from Supabase
 * @param permittedFirms Optional array of firm IDs to filter by
 */
export async function fetchInventoryRecords(permittedFirms?: string[]): Promise<InventoryRecord[]> {
    try {
        if (hasNoFirmAccess(permittedFirms)) return [];
        const firms = normalizeFirmAccess(permittedFirms);

        let query = supabase
            .from('inventory')
            .select('*, firm:firm_id(firm_name)')
            .order('item_name', { ascending: true });

        if (firms) {
            const ids = firms.filter(f => /^\d+$/.test(f)).map(Number);
            if (ids.length === 0) return [];
            query = query.in('firm_id', ids);
        }

        const { data, error } = await query;

        if (error) throw error;

        return (data || []).map((r: any) => {
            const purQty = Number(r.purchase_quantity) || 0;
            const liftQty = Number(r.received_quantity) || 0;
            const firmName = r.firm?.firm_name || r.firm_name || '';
            
            return {
                itemName: r.item_name || '',
                groupHead: r.group_head || '',
                uom: r.uom || '',
                opening: Number(r.opening) || 0,
                individualRate: Number(r.individual_rate) || 0,
                rate: Number(r.individual_rate) || 0,
                individual_rate: Number(r.individual_rate) || 0,
                indented: Number(r.indented) || 0,
                approved: Number(r.approved) || 0,
                purchaseQuantity: purQty,
                purchaseReturn: Number(r.return_quantity) || 0,
                liftingQty: liftQty,
                inTransit: Math.max(0, purQty - liftQty),
                outQuantity: Number(r.out_quantity) || 0,
                issueReturn: Number(r.issue_return) || 0,
                stockTransfer: Number(r.stock_transfer) || 0,
                stockTransferGiven: 0,
                stockTransferReceiving: Number(r.stock_transfer) || 0,
                fromProject: '',
                toProject: '',
                firmName: firmName,
                firmNameMatch: firmName,
                firm_id: r.firm_id,
                current: Number(r.current) || 0,
                totalPrice: Number(r.total_price) || 0,
                status: r.color_code || '',
                colorCode: r.color_code || '',
            };
        });
    } catch (error) {
        console.error('Error fetching inventory records:', error);
        throw error;
    }
}

export async function addItemToInventory(input: InventoryItemInput): Promise<{ success: boolean; error?: any }> {
    try {
        const quantityToAdd = toNumber(input.quantity);

        if (quantityToAdd <= 0) {
            return { success: false, error: new Error('Quantity must be greater than 0') };
        }

        if (!input.firmId) {
            return { success: false, error: new Error('Project ID is required for inventory') };
        }

        const { data: existingRecord, error: fetchError } = await supabase
            .from('inventory')
            .select('*')
            .eq('item_name', input.itemName)
            .eq('firm_id', input.firmId)
            .maybeSingle();

        if (fetchError) throw fetchError;

        if (existingRecord) {
            const nextOpening = toNumber(existingRecord.opening) + quantityToAdd;
            const nextCurrent = toNumber(existingRecord.current) + quantityToAdd;
            const rate = toNumber(existingRecord.individual_rate);

            const { error: updateError } = await supabase
                .from('inventory')
                .update({
                    group_head: existingRecord.group_head || input.groupHead,
                    uom: existingRecord.uom || input.uom || '',
                    opening: toTextNumber(nextOpening),
                    current: toTextNumber(nextCurrent),
                    total_price: toTextNumber(nextCurrent * rate),
                    color_code: getInventoryStatus(nextCurrent),
                    firm_name: existingRecord.firm_name || input.firmName || '',
                    firm_id: existingRecord.firm_id || input.firmId || null,
                })
                .eq('item_name', input.itemName)
                .eq('firm_id', input.firmId);

            if (updateError) throw updateError;
        } else {
            const payload = {
                item_name: input.itemName,
                group_head: input.groupHead,
                uom: input.uom || '',
                max_level: null,
                opening: toTextNumber(quantityToAdd),
                individual_rate: '0',
                indented: '0',
                approved: '0',
                purchase_quantity: '0',
                out_quantity: '0',
                current: toTextNumber(quantityToAdd),
                total_price: '0',
                color_code: getInventoryStatus(quantityToAdd),
                received_quantity: toTextNumber(quantityToAdd),
                return_quantity: '0',
                request_quantity: '0',
                firm_name: input.firmName || '',
                firm_id: input.firmId || null,
            };

            const { error: insertError } = await supabase
                .from('inventory')
                .insert(payload);

            if (insertError) throw insertError;
        }

        return { success: true };
    } catch (error) {
        console.error('Error adding item to inventory:', error);
        return { success: false, error };
    }
}
