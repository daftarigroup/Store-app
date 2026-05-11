import { supabase } from '@/lib/supabase';
import { hasNoFirmAccess, normalizeFirmAccess, applyFirmAccessFilter } from '@/lib/firmAccess';

/**
 * GetLift Service
 * Handles all Supabase operations for the GetLift component
 * Manages purchase lifting, bill status updates, and store-in records
 */

// ==================== INTERFACES ====================

export interface GetLiftIndentRecord {
    indentNumber: string;
    firmNameMatch: string;
    firm_id?: number;
    approvedVendorName: string;
    poNumber: string;
    actual4: string;
    deliveryDate: string;
    planned5: string;
    actual5: string;
    productName: string;
    totalQty: number;
    quantity: number;
    pendingQty: number;
    liftingStatus: string;
    cancelQty: number;
    approvedRate: string;
    taxValue: number;
    withTax: string;
    timestamp: string;
    expectedDate: string;
    // department?: string;
    areaOfUse?: string;
    approvedQuantity: number;
    receivedQuantity: number;
    uom: string;
}

export interface GetLiftStoreInRecord {
    liftNumber: string;
    indentNo: string;
    firmNameMatch: string;
    firm_id?: number;
    vendorName: string;
    productName: string;
    poNumber: string;
    receivedQuantity: number;
    qty: number;
    photoOfBill: string;
    timestamp: string;
}

export interface VendorOption {
    vendorName: string;
}

export interface StoreInInsertData {
    timestamp: string;
    liftNumber?: string;
    indentNo: string;
    billNo: string;
    vendorName: string;
    productName: string;
    qty: number;
    leadTimeToLiftMaterial?: number;
    discountAmount: number;
    typeOfBill: string;
    billAmount: number;
    paymentType: string;
    advanceAmountIfAny: number;
    photoOfBill: string;
    transportationInclude: string;
    transporterName: string;
    amount: number;
    billStatus: string;
    quantityAsPerBill: number;
    poDate: string;
    poNumber: string;
    vendor: string;
    indentNumber: string;
    product: string;
    quantity: number;
    vehicleNo: string;
    driverName: string;
    driverMobileNo: string;
    billRemark: string;
    receivedQuantity?: number;
    firmNameMatch: string;
    firm_id?: number | null;
    rate: string;
    // department?: string;
    areaOfUse?: string;
    approvedVendorName?: string;
    liftingStatus?: string;
    notBillReceivedNo?: string;
    challanNo?: string;
    challanImage?: string;
    uom?: string;
}

// ==================== FETCH FUNCTIONS ====================

/**
 * Fetch all indent records from Supabase
 * Used for displaying pending and completed lift records
 */
export async function fetchIndentRecords(permittedFirms?: string[]) {
    try {
        if (hasNoFirmAccess(permittedFirms)) return [];

        let query = supabase
            .from('indent')
            .select('*')
            .order('indent_number', { ascending: false });

        const filteredQuery = applyFirmAccessFilter(query, permittedFirms);
        if (!filteredQuery) return [];

        const { data, error } = await filteredQuery;

        if (error) throw error;
        console.log("fetchIndentRecords", data);
        return (data || []).map((r: any) => ({
            indentNumber: r.indent_number || '',
            firmNameMatch: r.firm_name,
            firm_id: r.firm_id,
            approvedVendorName: r.approved_vendor_name || '',
            poNumber: r.po_number || '',
            actual4: r.actual4 || '',
            deliveryDate: r.delivery_date || '',
            planned5: r.planned5 || '',
            actual5: r.actual5 || '',
            productName: r.product_name || '',
            totalQty: Number(r.total_qty) || 0,
            quantity: Number(r.quantity) || 0,
            pendingQty: Number(r.pending_qty) || 0,
            liftingStatus: r.lifting_status || '',
            cancelQty: Number(r.cancel_qty) || 0,
            approvedRate: r.approved_rate || '',
            taxValue: Number(r.tax_value4) || 0,
            withTax: r.with_tax_or_not4 || 'No',
            // department: r.department || '',
            areaOfUse: r.area_of_use || '',
            timestamp: r.timestamp || '',
            expectedDate: r.expected_req_date || '',
            approvedQuantity: Number(r.approved_quantity) || 0,
            receivedQuantity: Number(r.received_quantity) || 0,
            uom: r.uom || '',
        }));
    } catch (error) {
        console.error('Error fetching indent records:', error);
        throw error;
    }
}

/**
 * Fetch all store-in records from Supabase
 * Used for calculating received quantities and history
 */
export async function fetchStoreInRecords(permittedFirms?: string[]) {
    try {
        if (hasNoFirmAccess(permittedFirms)) return [];

        let query = supabase
            .from('store_in')
            .select('*')
            .order('timestamp', { ascending: false });

        const filteredQuery = applyFirmAccessFilter(query, permittedFirms);
        if (!filteredQuery) return [];

        const { data, error } = await filteredQuery;

        if (error) throw error;

        return (data || []).map((r: any) => ({
            liftNumber: r.lift_number || '',
            indentNo: r.indent_no || '',
            firmNameMatch: r.firm_name,
            firm_id: r.firm_id ?? null,
            vendorName: r.vendor_name || '',
            productName: r.product_name || '',
            poNumber: r.po_number || '',
            qty: Number(r.qty) || 0,
            receivedQuantity: Number(r.received_quantity) || 0,
            photoOfBill: r.photo_of_bill || '',
            timestamp: r.timestamp || '',
        }));
    } catch (error) {
        console.error('Error fetching store-in records:', error);
        throw error;
    }
}

/**
 * Fetch vendor options from master table
 * Used for populating vendor dropdown
 */
// Update the service function (in getLiftService or create a new one)
export const fetchVendorOptions = async (): Promise<string[]> => {
    try {
        const { data, error } = await supabase
            .from('vendors')
            .select('vendor_name')
            .not('vendor_name', 'is', null)
            .order('vendor_name');

        if (error) throw error;

        // Filter out null/undefined/empty values and remove duplicates
        const vendorNames = data
            .map(item => item.vendor_name?.trim())
            .filter((name): name is string => !!name && name.length > 0);

        return [...new Set(vendorNames)]; // Remove duplicates
    } catch (error) {
        console.error('Error fetching vendors:', error);
        throw error;
    }
};

// ==================== INSERT/UPDATE FUNCTIONS ====================

/**
 * Insert a new store-in record
 * @param storeInData - Store-in record data
 */
export async function insertStoreInRecord(storeInData: StoreInInsertData) {
    try {
        // 1. Fetch latest lift_number by timestamp to reliably continue sequence (using LN- prefix)
        const { data: latestLifts, error: fetchError } = await supabase
            .from('store_in')
            .select('lift_number')
            .like('lift_number', 'LN-%');

        let liftNumber = 'LN-1';
        if (latestLifts && latestLifts.length > 0) {
            let maxNum = 0;
            latestLifts.forEach(record => {
                if (record.lift_number) {
                    const matches = record.lift_number.match(/LN-(\d+)/);
                    if (matches && matches[1]) {
                        const num = parseInt(matches[1], 10);
                        if (num > maxNum) maxNum = num;
                    }
                }
            });
            liftNumber = `LN-${maxNum + 1}`;
        }

        const now = new Date().toISOString();

        // ✅ EXACT SCHEMA MAPPING BASED ON PROVIDED SQL
        const mappedData = {
            timestamp: storeInData.timestamp || now,
            lift_number: liftNumber,
            indent_no: storeInData.indentNo || null,
            po_number: storeInData.poNumber || null,
            vendor_name: storeInData.vendorName || null,
            product_name: storeInData.productName || null,
            bill_status: storeInData.billStatus || null,
            bill_no: storeInData.billNo || null,
            qty: String(storeInData.qty || '0'),
            lead_time_to_lift_material: null, // As seen in SQL
            type_of_bill: storeInData.typeOfBill || null,
            bill_amount: String(storeInData.billAmount || '0'),
            discount_amount: String(storeInData.discountAmount || '0'),
            payment_type: storeInData.paymentType || null,
            advance_amount_if_any: String(storeInData.advanceAmountIfAny || '0'),
            photo_of_bill: storeInData.photoOfBill || null,
            transportation_include: storeInData.transportationInclude || null,
            transporter_name: storeInData.transporterName || null,
            amount: String(storeInData.amount || '0'),
            vehicle_no: storeInData.vehicleNo || null,
            driver_name: storeInData.driverName || null,
            driver_mobile_no: storeInData.driverMobileNo || null,
            bill_remark: storeInData.billRemark || null,
            planned6: storeInData.timestamp || now,
            actual6: null,
            time_delay6: null,
            receiving_status: null,
            received_quantity: String(storeInData.receivedQuantity || '0'),
            photo_of_product: null,
            damage_order: null,
            quantity_as_per_bill: null,
            remark: null,
            planned7: null,
            actual7: null,
            time_delay7: null,
            status: null,
            bill_copy_attached: null,
            reason: null,
            send_debit_note: null,
            planned9: null,
            actual9: null,
            time_delay9: null,
            debit_note_copy: null,
            debit_note_number: null,
            firm_name: storeInData.firmNameMatch || null,
            firm_id: storeInData.firm_id ?? null,
            lifting_status: storeInData.liftingStatus || 'Pending',
            planned11: null,
            actual11: null,
            time_delay: null,
            bill_status_new: null,
            bill_image_status: null,
            indent_date: storeInData.indentNo ? now : null,
            indent_qty: String(storeInData.qty || '0'),
            purchase_date: now,
            material_date: null,
            party_name: storeInData.vendorName || null,
            location: null,
            area: storeInData.areaOfUse || null,
            not_bill_received_no: storeInData.notBillReceivedNo || null,
            indented_for: null,
            approved_party_name: storeInData.approvedVendorName || storeInData.vendorName || null,
            rate: String(storeInData.rate || '0'),
            total_rate: String(Number(storeInData.rate || 0) * Number(storeInData.qty || 0)),
            bill_received2: null,
            price_as_per_po_check: null,
            hod_status: 'Pending',
            hod_remark: null,
            hod_planned: null,
            hod_actual: null,
            challan_no: storeInData.challanNo || null,
            challan_image: storeInData.challanImage || null,
            receiver_name: null,
        };

        console.log('📤 Inserting store-in record (Full Schema):', mappedData);

        const { data, error } = await supabase
            .from('store_in')
            .insert([mappedData])
            .select();

        if (error) {
            console.error('insert error', {
                code: error?.code, message: error?.message,
                details: error?.details,
                hint: error?.hint,
            });
            console.error('❌ Supabase insert error:', error);
            throw error;
        }

        console.log('✅ Store-in record inserted:', data);
        return data;
    } catch (error) {
        console.error('Error inserting store-in record:', error);
        throw error;
    }
}

/**
 * Update actual5 timestamp for an indent (Material Receipt Date)
 * Called when purchase details form is updated
 * @param indentNumber - Indent number to update
 */
export async function updateActual5Timestamp(indentNumber: string) {
    try {
        const currentDateTime = new Date().toISOString();

        const { error } = await supabase
            .from('indent')
            .update({ actual5: currentDateTime })
            .eq('indent_number', indentNumber);

        if (error) throw error;

        console.log(`✅ Updated actual5 for indent ${indentNumber}: ${currentDateTime}`);
        return true;
    } catch (error) {
        console.error('Error updating actual5 timestamp:', error);
        throw error;
    }
}

/**
 * Update cancel quantity for an indent
 * @param indentNumber - Indent number to update
 * @param cancelQty - Quantity to cancel
 */
export async function updateCancelQuantity(indentNumber: string, cancelQty: number) {
    try {
        const { error } = await supabase
            .from('indent')
            .update({ cancel_qty: cancelQty })
            .eq('indent_number', indentNumber);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('Error updating cancel quantity:', error);
        throw error;
    }
}

export async function updateLiftingStatus(indentNumber: string, status: string) {
    try {
        const { error } = await supabase
            .from('indent')
            .update({ lifting_status: status })
            .eq('indent_number', indentNumber);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('Error updating lifting status:', error);
        throw error;
    }
}

/**
 * Update pending lift quantity for an indent
 * @param indentNumber - Indent number to update
 * @param liftQty - Quantity currently being lifted
 */
export async function updatePendingLiftQty(indentNumber: string, liftQty: number) {
    try {
        const { error } = await supabase
            .from('indent')
            .update({ pending_lift_qty: liftQty.toString() })
            .eq('indent_number', indentNumber);

        if (error) throw error;

        console.log(`✅ Updated pending_lift_qty for indent ${indentNumber}: ${liftQty}`);
        return true;
    } catch (error) {
        console.error('Error updating pending lift qty:', error);
        throw error;
    }
}

// ==================== FILE UPLOAD ====================

/**
 * Upload bill photo/document to Supabase Storage
 * @param file - File to upload
 * @param indentNumber - Indent number for file naming
 */
export async function uploadBillPhoto(file: File, indentNumber: string): Promise<string> {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${indentNumber}_bill_${Date.now()}.${fileExt}`;
        const filePath = `Payment Images/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('bill_image_status')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('bill_image_status')
            .getPublicUrl(filePath);

        return publicUrl;
    } catch (error) {
        console.error('Bill photo upload error:', error);
        throw error;
    }
}
