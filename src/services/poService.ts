import { supabase } from '@/lib/supabase';
import { hasNoFirmAccess, normalizeFirmAccess } from '@/lib/firmAccess';

/**
 * Fetch all indent data from Supabase
 * Used for populating PO creation form with indent details
 * @param permittedFirms Optional array of firm names to filter by
 */

export interface PoMasterRecord {
    timestamp: string;
    partyName: string;
    supplierAddress: string;
    supplierGstin: string; 
    poNumber: string;
    internalCode: string;
    product: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    gst: number;
    gstPercent: number;
    companyEmail: string;
    discount: number;
    discountPercent: number;
    amount: number;
    totalPoAmount: number;
    pdf: string;
    quotationNumber: string;
    quotationDate: string;
    enquiryNumber: string;
    enquiryDate: string;
    term1: string;
    term2: string;
    term3: string;
    term4: string;
    term5: string;
    term6: string;
    term7: string;
    term8: string;
    term9: string;
    term10: string;
    term11: string;
    term12: string;
    term13: string;
    term14: string;
    term15: string;
    term16: string;
    term17: string;
    term18: string;
    term19: string;
    term20: string;
    deliveryDate: string;
    paymentTerms: string;
    numberOfDays: number;
    deliveryDays: number;
    deliveryType: string;
    firmNameMatch: string;
    emailSendStatus: string;
    preparedBy: string;
}

export async function fetchIndents(permittedFirms?: string[]) {
    try {
        if (hasNoFirmAccess(permittedFirms)) return [];
        const firms = normalizeFirmAccess(permittedFirms);

        let query = supabase
            .from('indent')
            .select('*')
            .order('indent_number', { ascending: false });

        if (firms) {
            query = query.in('firm_name', firms);
        }

        const { data, error } = await query;

        if (error) throw error;

        return (data || []).map((r: any) => {
            const rawPending = Number(r.pending_po_qty) || 0;
            const rawApproved = Number(r.approved_quantity) || 0;
            const rawQuantity = Number(r.quantity) || 0;

            // Priority: approved_quantity > pending_po_qty > original_quantity
            const finalQty = rawApproved > 0 ? rawApproved : (rawPending > 0 ? rawPending : rawQuantity);

            return {
                id: r.id,
                planned4: r.planned4 || '',
                actual4: r.actual4 || '',
                approvedVendorName: r.approved_vendor_name || '',
                firmName: r.firm_name || '',
                firmNameMatch: r.firm_name || '',
                indentNumber: r.indent_number || '',
                productName: r.product_name || '',
                specifications: r.specifications || '',
                taxValue1: r.tax_value1 || 0,
                taxValue4: r.tax_value4 || 0,
                approvedQuantity: finalQty, // This will be shown in 'Qty' column
                indentQuantity: rawQuantity, // Original requested quantity
                pendingPoQty: rawPending,
                uom: r.uom || '',
                approvedRate: r.approved_rate || 0,
                quotationNumber: r.approved_quotation_no || '',
                quotationDate: r.approved_quotation_date || '',
                approvedPaymentTerm: r.approved_payment_term || '',
                approvedAdvancePercent: r.approved_advance_percent || '',
                vendorType: r.vendor_type || 'Regular',
            };
        });
    } catch (error) {
        console.error('Error fetching indents:', error);
        throw error;
    }
}

/**
 * Fetch all PO Master records from Supabase
 * Used for generating PO numbers and revising existing POs
 * @param permittedFirms Optional array of firm names to filter by
 */
export async function fetchPoMaster(permittedFirms?: string[]) {
    try {
        if (hasNoFirmAccess(permittedFirms)) return [];
        const firms = normalizeFirmAccess(permittedFirms);

        let query = supabase
            .from('po_master')
            .select('*')
            .order('timestamp', { ascending: false });

        if (firms) {
            query = query.in('firm_name', firms);
        }

        const { data, error } = await query;

        if (error) throw error;

        return (data || []).map((r: any) => ({
            timestamp: r.timestamp,
            partyName: r.party_name || '',
            supplierAddress: r.supplier_address || '',
            supplierGstin: r.supplier_gstin || '',
            poNumber: r.po_number || '',
            internalCode: r.internal_code || '',
            product: r.product || '',
            description: r.description || '',
            quantity: Number(r.quantity) || 0,
            unit: r.unit || '',
            rate: Number(r.rate) || 0,
            gst: Number(r.gst) || 0,
            gstPercent: Number(r.gst) || 0, // gst field is used for percentage
            companyEmail: r.company_email || '',
            discount: Number(r.discount) || 0,
            discountPercent: Number(r.discount) || 0, // discount field is used for percentage
            amount: Number(r.amount) || 0,
            totalPoAmount: Number(r.total_po_amount) || 0,
            pdf: r.pdf || '',
            quotationNumber: r.quotation_number || '',
            quotationDate: r.quotation_date || '',
            enquiryNumber: r.enquiry_number || '',
            enquiryDate: r.enquiry_date || '',
            term1: r.term1 || '',
            term2: r.term2 || '',
            term3: r.term3 || '',
            term4: r.term4 || '',
            term5: r.term5 || '',
            term6: r.term6 || '',
            term7: r.term7 || '',
            term8: r.term8 || '',
            term9: r.term9 || '',
            term10: r.term10 || '',
            term11: r.term11 || '',
            term12: r.term12 || '',
            term13: r.term13 || '',
            term14: r.term14 || '',
            term15: r.term15 || '',
            term16: r.term16 || '',
            term17: r.term17 || '',
            term18: r.term18 || '',
            term19: r.term19 || '',
            term20: r.term20 || '',
            deliveryDate: r.delivery_date || '',
            paymentTerms: r.payment_terms || '',
            numberOfDays: Number(r.number_of_days) || 0,
            deliveryDays: Number(r.delivery_days) || 0,
            deliveryType: r.delivery_type || '',
            firmNameMatch: r.firm_name || '',
            emailSendStatus: r.email_send_status || '',
            preparedBy: r.prepared_by || '',
            approvedBy: r.approved_by || '',
            terms: r.terms || null,
            destinationAddress: r.destination_address || '',
            siteEngineerName: r.site_engineer_name || '',
            siteEngineerEmail: r.site_engineer_email || '',
            siteEngineerPhoneNo: r.site_engineer_phoneNo || '',
        }));
    } catch (error) {
        console.error('Error fetching PO master:', error);
        throw error;
    }
}

/**
 * Fetch master data (vendors, company info, terms, etc.)
 * Used for populating vendor details and default terms
 */
/**
 * Fetch master data (vendors, company info, terms, etc.)
 * Used for populating vendor details and default terms
 */
export async function fetchMasterData() {
    try {
        const { data: records, error } = await supabase
            .from('master')
            .select('*');

        if (error) throw error;

        if (!records || records.length === 0) {
            return {
                destinationAddress: '',
                defaultTerms: [],
                vendors: [],
                firmCompanyMap: {},
                companyName: '',
                companyPhone: '',
                companyGstin: '',
                companyPan: '',
                companyAddress: '',
                billingAddress: '',
                paymentTerms: [],
                siteEngineers: [],
            };
        }

        // Fetch site engineers from the other table
        const { data: seData } = await supabase.from('site_engineer_details').select('*');
        const siteEngineers = seData || [];

        // Aggregate vendors
        const vendors = records
            .filter((r: any) => r.vendor_name)
            .map((r: any) => ({
                vendorName: r.vendor_name,
                gstin: r.vendor_gstin || '',
                address: r.vendor_address || '',
                vendorEmail: r.vendor_email || '',
            }));

        // Deduplicate vendors by name
        const uniqueVendors = Array.from(new Map(vendors.map((v: any) => [v.vendorName, v])).values());

        // Extract payment terms
        const paymentTerms = Array.from(new Set(records.map((r: any) => r.payment_term).filter(Boolean)));

        // Firm to Company Mapping
        const firmCompanyMap: Record<string, any> = {};
        records.forEach((r: any) => {
            if (r.firm_name && r.company_name) {
                firmCompanyMap[r.firm_name] = {
                    companyName: r.company_name,
                    companyAddress: r.company_address || '',
                    destinationAddress: r.destination_address || '',
                    companyGstin: r.company_gstin || '',
                    companyPan: r.company_pan || '',
                };
            }
        });

        // Company info (usually the first record or common values)
        const firstWithCompany = records.find((r: any) => r.company_name) || {};

        // Collect ALL default terms from ALL records (not just the first one)
        const allDefaultTerms = new Set<string>();
        records.forEach((r: any) => {
            if (r.default_terms) {
                allDefaultTerms.add(r.default_terms);
            }
        });

        // Aggregate Items (Products)
        const items = records
            .filter((r: any) => r.item_name)
            .map((r: any) => ({
                itemName: r.item_name,
                regularConditions: Array.isArray(r.regular_conditions)
                    ? r.regular_conditions
                    : (typeof r.regular_conditions === 'string' ? JSON.parse(r.regular_conditions || '[]') : []),
                thirdPartyConditions: Array.isArray(r.third_party_conditions)
                    ? r.third_party_conditions
                    : (typeof r.third_party_conditions === 'string' ? JSON.parse(r.third_party_conditions || '[]') : []),
            }));

        return {
            destinationAddress: firstWithCompany.destination_address || '',
            defaultTerms: Array.from(allDefaultTerms),
            vendors: uniqueVendors,
            items,
            firmCompanyMap,
            companyName: firstWithCompany.company_name || '',
            companyPhone: firstWithCompany.company_phone || '',
            companyGstin: firstWithCompany.company_gstin || '',
            companyPan: firstWithCompany.company_pan || '',
            companyEmail: firstWithCompany.company_email || '',
            companyAddress: firstWithCompany.company_address || '',
            billingAddress: firstWithCompany.billing_address || '',
            companyContactPerson: firstWithCompany.company_contact_person || '',
            paymentTerms,
            siteEngineers,
        };
    } catch (error) {
        console.error('Error fetching master data:', error);
        return {
            destinationAddress: '',
            defaultTerms: [],
            vendors: [],
            firmCompanyMap: {},
            companyName: '',
            companyPhone: '',
            companyGstin: '',
            companyPan: '',
            companyAddress: '',
            billingAddress: '',
            companyContactPerson: '',
            paymentTerms: [],
            siteEngineers: [],
        };
    }
}

/**
 * Insert new PO records into Supabase
 * @param poRecords - Array of PO records to insert
 */
export async function insertPoRecords(poRecords: any[]) {
    try {
        // Map the records to Supabase schema (snake_case)
        // Note: Most fields in po_master are text type, so we convert numbers to strings
        const mappedRecords = poRecords.map((record) => ({
            timestamp: record.timestamp,
            party_name: record.partyName || '',
            po_number: record.poNumber || '',
            internal_code: record.internalCode || '',
            product: record.product || '',
            description: record.description || '',
            quantity: String(record.quantity || 0),
            unit: record.unit || '',
            rate: String(record.rate || 0),
            gst: String(record.gstPercent || record.gst || 0),
            discount: String(record.discountPercent || record.discount || 0),
            amount: String(record.amount || 0),
            total_po_amount: String(record.totalPoAmount || 0),
            pdf: record.pdf || '',
            quotation_number: record.quotationNumber || '',
            quotation_date: record.quotationDate || '',
            enquiry_number: record.enquiryNumber || '',
            enquiry_date: record.enquiryDate || '',
            term1: record.term1 || '',
            term2: record.term2 || '',
            term3: record.term3 || '',
            term4: record.term4 || '',
            term5: record.term5 || '',
            term6: record.term6 || '',
            term7: record.term7 || '',
            term8: record.term8 || '',
            term9: record.term9 || '',
            term10: record.term10 || '',
            delivery_date: record.deliveryDate || '',
            payment_terms: record.paymentTerms || '',
            number_of_days: String(record.numberOfDays || 0),
            delivery_days: String(record.deliveryDays || 0),
            delivery_type: record.deliveryType || '',
            firm_name: record.firmNameMatch || '',
            company_email: record.companyEmail || '',
            advance_percent: record.advancePercent || 0,
            advance_amount: record.advanceAmount || 0,
            terms: record.termsObject || {},
            destination_address: record.destinationAddress || '',
            site_engineer_name: record.siteEngineerName || '',
            site_engineer_email: record.siteEngineerEmail || '',
            site_engineer_phoneNo: record.siteEngineerPhoneNo || '',
        }));

        const { data, error } = await supabase
            .from('po_master')
            .insert(mappedRecords)
            .select();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error inserting PO records:', error);
        throw error;
    }
}

/**
 * Update indent records to mark them as having PO created
 * Sets actual4 timestamp and delivery_date for indents that are included in the PO
 * @param indentNumbers - Array of indent numbers to update
 * @param deliveryDate - The delivery date from the PO
 */
export async function updateIndentsAfterPoCreation(ids: number[], deliveryDate?: string, poNumber?: string) {
    try {
        const now = new Date().toISOString();
        const updateData: any = {
            actual4: now,
            planned5: now
        };
        if (deliveryDate) {
            updateData.delivery_date = deliveryDate;
        }
        if (poNumber) {
            updateData.po_number = poNumber;
        }

        const { error } = await supabase
            .from('indent')
            .update(updateData)
            .in('id', ids);

        if (error) throw error;
    } catch (error) {
        console.error('Error updating indents after PO creation:', error);
        throw error;
    }
}
