import { supabase } from '@/lib/supabase';

/**
 * Inventory Service
 * Handles all Supabase operations for the Inventory component
 */

export interface InventoryRecord {
    itemName: string;
    groupHead: string;
    uom: string;
    opening: number;
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
    current: number;
    totalPrice: number;
    status: string;
}

export interface InventoryItemInput {
    itemName: string;
    groupHead: string;
    uom?: string;
    quantity: number;
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
 */
export async function fetchInventoryRecords(): Promise<InventoryRecord[]> {
    try {
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .order('item_name', { ascending: true });

        if (error) throw error;

        return (data || []).map((r: any) => {
            const purQty = Number(r.purchase_quantity) || 0;
            const liftQty = Number(r.received_quantity) || 0;
            
            return {
                itemName: r.item_name || '',
                groupHead: r.group_head || '',
                uom: r.uom || '',
                opening: Number(r.opening) || 0,
                rate: Number(r.individual_rate) || 0,
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
                current: Number(r.current) || 0,
                totalPrice: Number(r.total_price) || 0,
                status: r.color_code || '',
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

        const { data: existingRecord, error: fetchError } = await supabase
            .from('inventory')
            .select('*')
            .eq('item_name', input.itemName)
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
                })
                .eq('item_name', input.itemName);

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
