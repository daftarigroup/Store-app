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
}

// ==================== FETCH FUNCTIONS ====================

/**
 * Fetch all tally entry records from Supabase
 */
export async function fetchTallyEntryRecords(): Promise<TallyEntryRecord[]> {
    try {
        const { data, error } = await supabase
            .from('tally_entry')
            .select('*')
            .order('lift_number', { ascending: false });

        if (error) throw error;

        return (data || []).map((r: any) => ({
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
        }));
    } catch (error) {
        console.error('Error fetching tally entry records:', error);
        throw error;
    }
}

// ==================== UPDATE FUNCTIONS ====================

/**
 * Update a tally entry record with provided fields
 * @param indentNumber - Indent number to identify the record
 * @param updates - Object containing the fields to update
 */
export async function updateTallyEntryRecord(
    indentNumber: string,
    updates: Record<string, any>
) {
    try {
        const { error } = await supabase
            .from('tally_entry')
            .update(updates)
            .eq('indent_number', indentNumber);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error(`Error updating tally entry for ${indentNumber}:`, error);
        throw error;
    }
}
