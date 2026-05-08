import { supabase } from '@/lib/supabase';

export interface StockTransferRecord {
    id?: number;
    timestamp: string;
    transfer_no: string;
    from_project: string;
    to_project: string;
    product_name: string;
    uom: string;
    group_head: string;
    quantity: number;
    remark: string;
    status: string;
}

/**
 * Fetch all stock transfer records from Supabase
 * @param permittedFirms Optional array of firm names to filter by
 */
export async function fetchStockTransferRecords(permittedFirms?: string[]) {
    try {
        let query = supabase
            .from('stock_transfers')
            .select('*')
            .order('timestamp', { ascending: false });

        if (permittedFirms && permittedFirms.length > 0) {
            // Filter if user is either the sender or receiver project
            const firmsString = permittedFirms.map(f => `"${f}"`).join(',');
            query = query.or(`from_project.in.(${firmsString}),to_project.in.(${firmsString})`);
        }

        const { data, error } = await query;

        if (error) throw error;

        return (data || []).map((r: any) => ({
            id: r.id,
            timestamp: r.timestamp,
            transferNo: r.transfer_no,
            fromProject: r.from_project,
            toProject: r.to_project,
            productName: r.product_name,
            uom: r.uom,
            groupHead: r.group_head,
            quantity: Number(r.quantity) || 0,
            remark: r.remark,
            status: r.status
        }));
    } catch (error) {
        console.error('Error fetching stock transfers:', error);
        throw error;
    }
}
