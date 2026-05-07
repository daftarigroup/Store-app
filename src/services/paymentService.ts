import { supabase } from '@/lib/supabase';
import type { PaymentsSheet, PaymentHistory } from '@/types/sheets';

/**
 * Payment Service
 * Handles all Supabase operations for Payments and Payment History
 */

/**
 * Fetch all payment records from Supabase
 */
export async function fetchPayments(): Promise<PaymentsSheet[]> {
    try {
        const { data, error } = await supabase
            .from('payments')
            .select('*')
            .order('id', { ascending: false });

        if (error) throw error;

        return (data || []).map((p: any) => ({
            timestamp: p.timestamp || '',
            uniqueNo: p.unique_no || '',
            partyName: p.party_name || '',
            poNumber: p.po_number || '',
            totalPoAmount: Number(p.total_po_amount) || 0,
            internalCode: p.internal_code || '',
            product: p.product || '',
            deliveryDate: p.delivery_date || '',
            paymentTerms: p.payment_terms || '',
            numberOfDays: Number(p.number_of_days) || 0,
            pdf: p.pdf || '',
            payAmount: Number(p.pay_amount) || 0,
            file: p.file || '',
            remark: p.remark || '',
            totalPaidAmount: Number(p.total_paid_amount) || 0,
            outstandingAmount: Number(p.outstanding_amount) || 0,
            status: p.status || '',
            planned: p.planned || '',
            actual: p.actual || '',
            delay: p.delay || '',
            status1: p.status1 || '',
            paymentForm: p.payment_form || '',
            paymentDone: p.payment_done || false,
            firmNameMatch: p.firm_name || '',
            id: p.id,
        })) as unknown as PaymentsSheet[];
    } catch (error) {
        console.error('Error fetching payments:', error);
        throw error;
    }
}

/**
 * Fetch all payment history records from Supabase (now from payments table)
 */
export async function fetchPaymentHistory(): Promise<PaymentHistory[]> {
    try {
        const { data, error } = await supabase
            .from('payments')
            .select('*')
            .eq('payment_done', true)
            .order('id', { ascending: false });

        if (error) throw error;

        return (data || []).map((h: any) => ({
            timestamp: h.actual || h.timestamp || '',
            appaymentNumber: '', // Not used anymore if fetching from payments
            status: h.status || 'Completed',
            uniquenumber: h.unique_no || '',
            fmsName: h.firm_name || '',
            payTo: h.party_name || '',
            amountToBepaid: Number(h.pay_amount) || 0,
            remarks: h.remark || '',
            anyAttachments: h.file || h.pdf || '',
            indent_no: h.internal_code || '',
            po_number: h.po_number || '',
            vendor_name: h.party_name || '',
            product_name: h.product || '',
            firmNameMatch: h.firm_name || '',
        })) as unknown as PaymentHistory[];
    } catch (error) {
        console.error('Error fetching payment history from payments table:', error);
        throw error;
    }
}
