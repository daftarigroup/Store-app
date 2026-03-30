import { supabase } from '@/lib/supabase';

/**
 * StoreIn Service
 * Handles all Supabase operations for the StoreIn component
 * Manages receiving items and storing them in inventory
 */

// ==================== INTERFACES ====================

export interface StoreInRecord {
    liftNumber: string;
    indentNo: string;
    billNo: string;
    vendorName: string;
    productName: string;
    qty: number;
    typeOfBill: string;
    billAmount: number;
    paymentType: string;
    advanceAmountIfAny: number;
    photoOfBill: string;
    transportationInclude: string;
    transporterName: string;
    amount: number;
    planned6: string;
    actual6: string;
    receivingStatus: string;
    receivedQuantity: number;
    photoOfProduct: string;
    damageOrder: string;
    quantityAsPerBill: string;
    remark: string;
    location: string;
    poDate: string;
    poNumber: string;
    vendor: string;
    indentNumber: string;
    product: string;
    uom: string;
    poCopy: string;
    billStatus: string;
    leadTimeToLiftMaterial: number;
    discountAmount: number;
    firmNameMatch: string;
    timestamp: string;
    billNumber: string;
    unitOfMeasurement: string;
    priceAsPerPo: number;
    priceAsPerPoCheck: string;
    // Stage 7 fields
    planned7: string;
    actual7: string;
    status: string;
    billCopyAttached: string;
    reason: string;
    sendDebitNote: string;
    // Stage 9 fields
    planned9: string;
    actual9: string;
    debitNoteCopy: string;
    debitNoteNumber: string;
    statusPurchaser: string;
    billCopy: string;
    returnCopy: string;
    // Stage 10 fields
    planned10: string;
    actual10: string;
    // Stage 11 fields
    planned11: string;
    actual11: string;
    billStatusNew: string;
    billImageStatus: string;
    vehicleNo: string;
    driverName: string;
    driverMobileNo: string;
    billRemark: string;
}

export interface LocationOption {
    location: string;
}

// ==================== FETCH FUNCTIONS ====================

/**
 * Fetch all store-in records from Supabase
 * Used for displaying pending and completed store-in items
 */
export async function fetchStoreInRecords() {
    try {
        const { data, error } = await supabase
            .from('store_in')
            .select('*')
            .order('indent_no', { ascending: false })
            .order('timestamp', { ascending: false });

        if (error) throw error;

        return (data || []).map((r: any) => ({
            liftNumber: r.lift_number || '',
            indentNo: r.indent_no || '',
            billNo: r.bill_no || '',
            vendorName: r.vendor_name || '',
            productName: r.product_name || '',
            qty: Number(r.qty) || 0,
            typeOfBill: r.type_of_bill || '',
            billAmount: Number(r.bill_amount) || 0,
            paymentType: r.payment_type || '',
            advanceAmountIfAny: Number(r.advance_amount_if_any) || 0,
            photoOfBill: r.photo_of_bill || '',
            transportationInclude: r.transportation_include || '',
            transporterName: r.transporter_name || '',
            amount: Number(r.amount) || 0,
            planned6: r.planned6 || '',
            actual6: r.actual6 || '',
            receivingStatus: r.receiving_status || '',
            receivedQuantity: Number(r.received_quantity) || 0,
            photoOfProduct: r.photo_of_product || '',
            damageOrder: r.damage_order || '',
            quantityAsPerBill: r.quantity_as_per_bill || '',
            remark: r.remark || '',
            location: r.location || '',
            poDate: r.po_date || '',
            poNumber: r.po_number || '',
            vendor: r.vendor || '',
            indentNumber: r.indent_number || '',
            product: r.product || '',
            uom: r.uom || '',
            poCopy: r.po_copy || '',
            billStatus: r.bill_status || '',
            leadTimeToLiftMaterial: Number(r.lead_time_to_lift_material) || 0,
            discountAmount: Number(r.discount_amount) || 0,
            firmNameMatch: r.firm_name_match || '',
            timestamp: r.timestamp || '',
            billNumber: r.bill_number || '',
            unitOfMeasurement: r.unit_of_measurement || '',
            priceAsPerPo: Number(r.rate) || 0,
            priceAsPerPoCheck: r.bill_received2 || '',
            vehicleNo: r.vehicle_no || '',
            driverName: r.driver_name || '',
            driverMobileNo: r.driver_mobile_no || '',
            billRemark: r.bill_remark || '',
            // Stage 7 fields
            planned7: r.planned7 || '',
            actual7: r.actual7 || '',
            status: r.status || '',
            billCopyAttached: r.bill_copy_attached || '',
            reason: r.reason || '',
            sendDebitNote: r.send_debit_note || '',
            // Stage 8 fields (Return Material To Party)
            planned8: r.planned8 || '',
            actual8: r.actual8 || '',
            // Stage 9 fields
            planned9: r.planned9 || '',
            actual9: r.actual9 || '',
            debitNoteCopy: r.debit_note_copy || '',
            debitNoteNumber: r.debit_note_number || '',
            statusPurchaser: r.status_purchaser || '',
            billCopy: r.bill_copy || '',
            returnCopy: r.return_copy || '',
            // Stage 10 fields (Exchange)
            planned10: r.planned10 || '',
            actual10: r.actual10 || '',
            // Stage 11 fields
            planned11: r.planned11 || '',
            actual11: r.actual11 || '',
            billStatusNew: r.bill_status_new || '',
            billImageStatus: r.bill_image_status || '',
        }));
    } catch (error) {
        console.error('Error fetching store-in records:', error);
        throw error;
    }
}

/**
 * Fetch location options from master table
 * Used for populating location dropdown
 */
/**
 * Fetch location options from master table
 * Used for populating location dropdown
 */
export async function fetchLocationOptions(): Promise<string[]> {
    try {
        const { data, error } = await supabase
            .from('master')
            .select('where');

        if (error) throw error;

        // Extract unique, non-null 'where' values
        const locations = Array.from(new Set(
            (data || [])
                .map((r: any) => r.where)
                .filter(Boolean)
        )).sort();

        return locations;
    } catch (error) {
        console.error('Error fetching location options:', error);
        return [];
    }
}

// ==================== UPDATE FUNCTIONS ====================

/**
 * Update store-in record with receiving details
 * @param liftNumber - Lift number to identify the record
 * @param updateData - Data to update
 */
export async function updateStoreInReceiving(
    liftNumber: string,
    updateData: {
        actual6: string;
        receivingStatus: string;
        receivedQuantity: number;
        photoOfProduct: string;
        damageOrder: string;
        quantityAsPerBill: string;
        remark: string;
        location: string;
        priceAsPerPoCheck: string;
    }
) {
    try {
        const { error } = await supabase
            .from('store_in')
            .update({
                actual6: updateData.actual6,
                receiving_status: updateData.receivingStatus,
                received_quantity: updateData.receivedQuantity,
                photo_of_product: updateData.photoOfProduct,
                damage_order: updateData.damageOrder,
                quantity_as_per_bill: updateData.quantityAsPerBill,
                remark: updateData.remark,
                location: updateData.location,
                bill_received2: updateData.priceAsPerPoCheck, // ✅ Using existing spare column
            })
            .eq('lift_number', liftNumber);

        if (error) throw error;

        // ✅ TRIGGER GRN (Planned 7) ONLY IF ANY CHECK FAILS (Rejection Workflow)
        const anyCheckFailed =
            updateData.damageOrder === 'No' || // Not OK
            updateData.quantityAsPerBill === 'No' ||
            updateData.priceAsPerPoCheck === 'No';

        if (anyCheckFailed) {
            console.log('⚠️ Some checks failed. Triggering Reject for GRN (Stage 7)...');
            const { error: planned7Error } = await supabase
                .from('store_in')
                .update({
                    planned7: updateData.actual6,
                })
                .eq('lift_number', liftNumber);

            if (planned7Error) console.error('Error triggering Stage 7:', planned7Error);
        } else {
            console.log('✅ All checks passed. Skipping Stage 7.');
        }

        return true;
    } catch (error) {
        console.error('Error updating store-in record:', error);
        throw error;
    }
}

/**
 * Update store-in record for Stage 7: Quantity Check In
 * @param liftNumber - Lift number to identify the record
 * @param updateData - Data to update
 */
export async function updateStoreInQuantityCheck(
    liftNumber: string,
    updateData: {
        actual7: string;
        status: string;
        billCopyAttached: string;
        sendDebitNote: string;
        reason: string;
    }
) {
    try {
        const { error } = await supabase
            .from('store_in')
            .update({
                actual7: updateData.actual7,
                status: updateData.status,
                bill_copy_attached: updateData.billCopyAttached,
                send_debit_note: updateData.sendDebitNote,
                reason: updateData.reason,
            })
            .eq('lift_number', liftNumber);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('Error updating store-in quantity check:', error);
        throw error;
    }
}

/**
 * Update store-in record for Stage 9: Send Debit Note
 * @param liftNumber - Lift number to identify the record
 * @param updateData - Data to update
 */
export async function updateStoreInDebitNote(
    liftNumber: string,
    updateData: {
        actual9: string;
        debitNoteCopy: string;
        debitNoteNumber: string;
    }
) {
    try {
        const { error } = await supabase
            .from('store_in')
            .update({
                actual9: updateData.actual9,
                debit_note_copy: updateData.debitNoteCopy,
                debit_note_number: updateData.debitNoteNumber,
            })
            .eq('lift_number', liftNumber);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('Error updating store-in debit note:', error);
        throw error;
    }
}


/**
 * Update store-in record for Stage 10: Exchange Materials
 * @param liftNumber - Lift number to identify the record
 * @param updateData - Data to update
 */
export async function updateStoreInExchange(
    liftNumber: string,
    updateData: {
        actual10: string;
        status: string;
    }
) {
    try {
        const { error } = await supabase
            .from('store_in')
            .update({
                actual10: updateData.actual10,
                status: updateData.status,
            })
            .eq('lift_number', liftNumber);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('Error updating store-in exchange:', error);
        throw error;
    }
}

/**
 * Update store-in record for Stage 11: Bill Status
 * @param liftNumber - Lift number to identify the record
 * @param updateData - Data to update
 */
export async function updateStoreInBillStatus(
    liftNumber: string,
    updateData: {
        actual11: string;
        billStatusNew: string;
        billImageStatus: string;
    }
) {
    try {
        const { error } = await supabase
            .from('store_in')
            .update({
                actual11: updateData.actual11,
                bill_status: 'Bill Received',
                bill_status_new: updateData.billStatusNew,
                bill_image_status: updateData.billImageStatus,
            })
            .eq('lift_number', liftNumber);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('Error updating store-in bill status:', error);
        throw error;
    }
}

// ==================== FILE UPLOAD ====================

/**
 * Create payment entry when transportation is not included
 * Automatically generates a payment record for HOD approval
 */
export async function createPaymentEntry(storeInData: {
    indent_number: string;
    vendor_name: string;
    po_number: string;
    bill_amount: number;
    photo_of_bill?: string;
    product_name: string;
    firm_name_match: string;
    payment_form?: string;
    prefix?: string;
    remark?: string;
}, billPhotoUrl: string = '') {
    try {
        const nowIso = new Date().toISOString();
        // Generate unique_no with PAY- prefix as requested
        const uniqueNo = `PAY-${Date.now()}`;

        const paymentEntry = {
            timestamp: nowIso,
            unique_no: uniqueNo,
            party_name: storeInData.vendor_name,
            po_number: storeInData.po_number,
            total_po_amount: String(storeInData.bill_amount),
            internal_code: storeInData.indent_number,
            product: storeInData.product_name,
            delivery_date: '',
            payment_terms: '',
            number_of_days: 0,
            pdf: billPhotoUrl || storeInData.photo_of_bill || '',
            pay_amount: String(storeInData.bill_amount),
            file: billPhotoUrl || storeInData.photo_of_bill || '',
            remark: storeInData.remark || `Payment for Store In - Indent ${storeInData.indent_number}`,
            total_paid_amount: '0',
            outstanding_amount: String(storeInData.bill_amount),
            status: 'Pending',
            planned: null,
            actual: null,
            status1: 'hod_approval_pending',
            payment_form: storeInData.payment_form || 'store_in',
            firm_name: storeInData.firm_name_match,
        };

        const { data, error } = await supabase
            .from('payments')
            .insert([paymentEntry])
            .select('*')
            .maybeSingle();

        if (error) {
            console.warn('⚠️ Failed to create payment entry:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error creating payment entry:', error);
        throw error;
    }
}

/**
 * Upload product photo to Supabase Storage
 * @param file - File to upload
 * @param indentNumber - Indent number for file naming
 */
export async function uploadProductPhoto(file: File, indentNumber: string): Promise<string> {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${indentNumber}_product_${Date.now()}.${fileExt}`;
        const filePath = `product-photos/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('photo_of_product')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('photo_of_product')
            .getPublicUrl(filePath);

        return publicUrl;
    } catch (error) {
        console.error('Product photo upload error:', error);
        throw error;
    }
}

/**
 * Upload bill copy to Supabase Storage
 * @param file - File to upload
 * @param liftNumber - Lift number for file naming
 */
export async function uploadBillCopy(file: File, liftNumber: string): Promise<string> {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${liftNumber.replace(/\//g, '-')}_bill_${Date.now()}.${fileExt}`;
        const filePath = `bill-copies/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('photo_of_bill')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('photo_of_bill')
            .getPublicUrl(filePath);

        return publicUrl;
    } catch (error) {
        console.error('Bill copy upload error:', error);
        throw error;
    }
}

/**
 * Update store-in record for Stage 8: Return Material To Party
 * @param liftNumber - Lift number to identify the record
 * @param updateData - Data to update
 */
export async function updateStoreInReturnToParty(
    liftNumber: string,
    updateData: {
        actual8: string;
        statusPurchaser: string;
    }
) {
    try {
        const { error } = await supabase
            .from('store_in')
            .update({
                actual8: updateData.actual8,
                status_purchaser: updateData.statusPurchaser,
            })
            .eq('lift_number', liftNumber);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('Error updating store-in return to party:', error);
        throw error;
    }
}

/**
 * Upload debit note copy to Supabase Storage
 * @param file - File to upload
 * @param liftNumber - Lift number for file naming
 */
export async function uploadDebitNoteCopy(file: File, liftNumber: string): Promise<string> {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${liftNumber.replace(/\//g, '-')}_debit_note_${Date.now()}.${fileExt}`;
        const filePath = `debit-notes/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('debit_note_copy')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('debit_note_copy')
            .getPublicUrl(filePath);

        return publicUrl;
    } catch (error) {
        console.error('Debit note copy upload error:', error);
        throw error;
    }
}

