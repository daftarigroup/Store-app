import { supabase } from '@/lib/supabase';
import type { QuotationHistorySheet } from '@/types';

/**
 * Quotation Service
 * Handles all Supabase operations for Quotations
 */

/**
 * Fetch all quotation history records from Supabase
 */
export async function fetchQuotationHistory(): Promise<QuotationHistorySheet[]> {
    try {
        const { data, error } = await supabase
            .from('quotation_history')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) throw error;

        return (data || []).map((r: any) => ({
            timestamp: r.timestamp || '',
            quatationNo: r.quatationNo || '',
            supplierName: r.supplierName || '',
            adreess: r.adreess || '',
            gst: r.gst || '',
            indentNo: r.indentNo || '',
            product: r.product || '',
            description: r.description || '',
            qty: r.qty || '',
            unit: r.unit || '',
            pdfLink: r.pdfLink || '',
            firm: r.firm || '',
        }));
    } catch (error) {
        console.error('Error fetching quotation history:', error);
        throw error;
    }
}

/**
 * Insert multiple quotation records into Supabase
 */
export async function insertQuotationHistory(records: any[]) {
    try {
        // Map any field name differences if necessary
        const mappedRecords = records.map(r => ({
            timestamp: r.timestamp,
            quatationNo: r.quatationNo,
            supplierName: r.supplierName,
            adreess: r.adreess,
            gst: r.gst,
            indentNo: r.indentNo,
            product: r.product,
            description: r.description,
            qty: String(r.qty),
            unit: r.unit,
            pdfLink: r.pdfLink,
            firm: r.firm,
        }));

        const { error } = await supabase
            .from('quotation_history')
            .insert(mappedRecords);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error inserting quotation history:', error);
        throw error;
    }
}
