import { supabase } from '@/lib/supabase';

/**
 * TallyEntry Service
 * Handles all Supabase operations for the TallyEntry component (Audit Data)
 */

// ==================== INTERFACES ====================

export interface TallyEntryRecord {
    id: number;
    timestamp: string;
    liftNumber: string;
    indentNumber: string;
    poNumber: string;
    materialInDate: string;
    productName: string;
    billStatus: string;
    qty: number;
    partyName: string;
    billAmt: number;
    billImage: string;
    billNo: string;
    location: string;
    typeOfBills: string;
    productImage: string;
    area: string;
    indentedFor: string;
    approvedPartyName: string;
    rate: number;
    indentQty: number;
    totalRate: number;
    billReceivedLater: string;
    planned1: string;
    actual1: string;
    delay1: string;
    status1: string;
    remarks1: string;
    planned2: string;
    actual2: string;
    delay2: string;
    status2: string;
    remarks2: string;
    planned3: string;
    actual3: string;
    delay3: string;
    status3: string;
    remarks3: string;
    planned4: string;
    actual4: string;
    delay4: string;
    status4: string;
    remarks4: string;
    planned5: string;
    actual5: string;
    delay5: string;
    status5: string;
    remarks5: string;
    firmNameMatch: string;
    damageOrder?: string;
    quantityAsPerBill?: string;
    priceAsPerPoCheck?: string;
    hodStatus?: string;
    hodRemark?: string;
    receivingStatus?: string;
    receivedQuantity?: number;
}

// ==================== FETCH FUNCTIONS ====================

/**
 * Fetch all tally entry records from Supabase
 */
export async function fetchTallyEntryRecords(): Promise<TallyEntryRecord[]> {
    try {
        const { data: tallyData, error: tallyError } = await supabase
            .from('tally_entry')
            .select('*')
            .order('lift_number', { ascending: false });

        if (tallyError) throw tallyError;

        // Fetch additional details from store_in table
        const { data: storeData, error: storeError } = await supabase
            .from('store_in')
            .select('lift_number, indent_no, hod_status, hod_remark, damage_order, quantity_as_per_bill, bill_received2, receiving_status, received_quantity');

        if (storeError) {
            console.warn('⚠️ Error fetching supplementary store_in data:', storeError);
        }

        // Map store_in data with trimmed keys for better matching
        const storeMap = new Map();
        (storeData || []).forEach(item => {
            const key = `${String(item.lift_number || '').trim()}-${String(item.indent_no || '').trim()}`;
            storeMap.set(key, item);
        });

        console.log(`📊 Fetched ${tallyData?.length || 0} tally entries and ${storeData?.length || 0} store_in records for join.`);

        return (tallyData || []).map((r: any) => {
            const liftKey = String(r.lift_number || '').trim();
            const indentKey = String(r.indent_number || '').trim();
            const storeInfo = storeMap.get(`${liftKey}-${indentKey}`);

            return {
                id: r.id,
                timestamp: r.timestamp || '',
                liftNumber: r.lift_number || '',
                indentNumber: r.indent_number || '',
                poNumber: r.po_number || '',
                materialInDate: r.material_in_date || '',
                productName: r.product_name || '',
                billStatus: r.bill_status || '',
                qty: Number(r.qty) || 0,
                partyName: r.party_name || '',
                billAmt: Number(r.bill_amt) || 0,
                billImage: r.bill_image || '',
                billNo: r.bill_no || '',
                location: r.location || '',
                typeOfBills: r.type_of_bills || '',
                productImage: r.product_image || '',
                area: r.area || '',
                indentedFor: r.indented_for || '',
                approvedPartyName: r.approved_party_name || '',
                rate: Number(r.rate) || 0,
                indentQty: Number(r.indent_qty) || 0,
                totalRate: Number(r.total_rate) || 0,
                billReceivedLater: r.bill_recieved_later || '',
                planned1: r.planned1 || '',
                actual1: r.actual1 || '',
                delay1: r.delay1 || '',
                status1: r.status1 || '',
                remarks1: r.remarks1 || '',
                planned2: r.planned2 || '',
                actual2: r.actual2 || '',
                delay2: r.delay2 || '',
                status2: r.status2 || '',
                remarks2: r.remarks2 || '',
                planned3: r.planned3 || '',
                actual3: r.actual3 || '',
                delay3: r.delay3 || '',
                status3: r.status3 || '',
                remarks3: r.remarks3 || '',
                planned4: r.planned4 || '',
                actual4: r.actual4 || '',
                delay4: r.delay4 || '',
                status4: r.status4 || '',
                remarks4: r.remarks4 || '',
                planned5: r.planned5 || '',
                actual5: r.actual5 || '',
                delay5: r.delay5 || '',
                status5: r.status5 || '',
                remarks5: r.remarks5 || '',
                firmNameMatch: r.firm_name_match || '',
                // Use Store In supplementary data if available
                damageOrder: storeInfo?.damage_order || '',
                quantityAsPerBill: storeInfo?.quantity_as_per_bill || '',
                priceAsPerPoCheck: storeInfo?.bill_received2 || '',
                hodStatus: storeInfo?.hod_status || r.hod_status || 'Pending',
                hodRemark: storeInfo?.hod_remark || r.hod_remark || '',
                receivingStatus: storeInfo?.receiving_status || r.receiving_status || '',
                receivedQuantity: Number(storeInfo?.received_quantity) || 0,
            };
        });
    } catch (error) {
        console.error('Error fetching tally entry records:', error);
        throw error;
    }
}

// ==================== UPDATE FUNCTIONS ====================

/**
 * Update a tally entry record with provided fields by its unique ID
 * @param id - Record ID to identify the record
 * @param updates - Object containing the fields to update
 */
export async function updateTallyEntryRecord(
    id: number,
    updates: Record<string, any>
) {
    try {
        const { error } = await supabase
            .from('tally_entry')
            .update(updates)
            .eq('id', id);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error(`Error updating tally entry for ID ${id}:`, error);
        throw error;
    }
}

/**
 * Create a new tally entry record, or update the existing one if lift_number already exists.
 * @param record - Data to insert/upsert into tally_entry
 */
export async function createTallyEntryRecord(record: Partial<TallyEntryRecord>) {
    try {
        const { error } = await supabase
            .from('tally_entry')
            .upsert([record], { onConflict: 'lift_number', ignoreDuplicates: false });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error creating tally entry record:', error);
        throw error;
    }
}
