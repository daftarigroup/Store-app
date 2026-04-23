import { supabase } from '@/lib/supabase';

/**
 * Issue Service
 * Handles all Supabase operations for the Issue component
 */

// ==================== INTERFACES ====================

export interface IssueRecord {
    id?: number;
    issue_no: string;
    issue_to: string;
    uom: string;
    product_name: string;
    quantity: number;
    department: string;
    group_head: string;
    planned1: string;
    actual1: string;
    status: string;
    given_qty: number;
    timestamp?: string;
    location?: string;
    constructor_name?: string;
    site_location?: string;
    project_name?: string;
    rejected_damage_qty?: string;
    damage_remark?: string;
    return_person_name?: string;
    issue_person_name?: string;
    issue_slip?: string;
    return_slip?: string;
}

// ==================== FETCH FUNCTIONS ====================

/**
 * Fetch all issue records from Supabase
 */
export async function fetchIssueRecords(): Promise<IssueRecord[]> {
    try {
        const { data, error } = await supabase
            .from('issue')
            .select('*')
            .order('issue_no', { ascending: false });

        if (error) throw error;

        return (data || []).map((r: any) => ({
            id: r.id,
            issue_no: r.issue_no || '',
            issue_to: r.issue_to || '',
            uom: r.uom || '',
            product_name: r.product_name || '',
            quantity: Number(r.quantity) || 0,
            department: r.department || '',
            group_head: r.group_head || '',
            planned1: r.planned1 || '',
            actual1: r.actual1 || '',
            status: r.status || '',
            given_qty: Number(r.given_qty) || 0,
            timestamp: r.timestamp || '',
            location: r.location || '',
            constructor_name: r.constructor_name || '',
            site_location: r.site_location || '',
            project_name: r.project_name || '',
            rejected_damage_qty: r.rejected_damage_qty || '',
            damage_remark: r.damage_remark || '',
            return_person_name: r.return_person_name || '',
            issue_person_name: r.issue_person_name || '',
            issue_slip: r.issue_slip || '',
            return_slip: r.return_slip || '',
        }));
    } catch (error) {
        console.error('Error fetching issue records:', error);
        throw error;
    }
}

// ==================== UPDATE FUNCTIONS ====================

/**
 * Update issue record with approval details
 * @param issue_no - Issue number to identify the record
 * @param updateData - Data to update
 */
export async function updateIssueApproval(
    issue_no: string,
    updateData: {
        actual1: string;
        status: string;
        given_qty?: number | null;
        issue_slip?: string;
    }
) {
    try {
        const { error } = await supabase
            .from('issue')
            .update({
                actual1: updateData.actual1,
                status: updateData.status,
                given_qty: updateData.given_qty,
                issue_slip: updateData.issue_slip,
            })
            .eq('issue_no', issue_no);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('Error updating issue approval:', error);
        throw error;
    }
}

/**
 * Update a specific issue record by ID
 * @param id - The primary ID of the record
 * @param data - The data to update
 */
export async function updateIssueRecordById(id: number, data: Partial<IssueRecord>) {
    try {
        const { error } = await supabase
            .from('issue')
            .update(data)
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error(`Error updating issue record with ID ${id}:`, error);
        throw error;
    }
}
/**
 * Create new issue records in Supabase
 * @param rows - Array of issue records to insert
 */
export async function createIssueRecords(rows: Partial<IssueRecord>[]) {
    try {
        const mappedRows = rows.map(r => ({
            timestamp: r.timestamp || r.planned1 || new Date().toISOString(),
            issue_no: r.issue_no,
            issue_to: r.issue_to,
            uom: r.uom,
            product_name: r.product_name,
            quantity: r.quantity,
            department: r.department,
            group_head: r.group_head,
            planned1: r.planned1,
            actual1: r.actual1,
            status: r.status || 'Pending',
            given_qty: r.given_qty || 0,
            constructor_name: r.constructor_name || '',
            site_location: r.site_location || '',
            project_name: r.project_name || '',
            rejected_damage_qty: r.rejected_damage_qty || '',
            damage_remark: r.damage_remark || '',
            return_person_name: r.return_person_name || '',
            issue_person_name: r.issue_person_name || '',
            issue_slip: r.issue_slip || '',
            return_slip: r.return_slip || '',
        }));

        const { data, error } = await supabase
            .from('issue')
            .insert(mappedRows)
            .select();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error creating issue records:', error);
        throw error;
    }
}
