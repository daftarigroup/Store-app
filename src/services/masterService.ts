import { supabase } from '@/lib/supabase';
import { normalizeFirmAccess } from '@/lib/firmAccess';

/**
 * Master Service
 * Handles fetching global options and master data from Supabase
 */

export interface MasterData {
    vendors: {
        vendorName: string;
        gstin: string;
        address: string;
        email: string;
        paymentTerm: string;
        personName: string;
    }[];
    vendorNames: string[];
    paymentTerms: string[];
    // departments: string[];
    groupHeads: Record<string, string[]>;
    products: Record<string, string[]>;
    companyName: string;
    companyAddress: string;
    companyEmail: string;
    companyGstin: string;
    companyPhone: string;
    billingAddress: string;
    companyPan: string;
    destinationAddress: string;
    companyContactPerson: string;
    defaultTerms: string[];
    uoms: string[];
    firms: string[];
    firmsnames: string[];
    fmsNames: string[];
    locations: string[];
    areaOfUses: string[];
    allGroupHeads: string[];
    siteEngineers: { name: string; number: string; email: string }[];
    contractors: { contractorName: string; contractorGstin: string; contractorAddress: string; contractorEmail: string; responsiblePerson: string; location: string; phone: string }[];
    siteLocations: string[];
    firmCompanyMap: Record<string, { companyName: string; companyAddress: string; destinationAddress: string; companyContactPerson: string; }>;
}

/**
 * Fetch all master data options for dropdowns
 */
export async function fetchMasterOptions(permittedFirms?: string[]): Promise<MasterData> {
    try {
        const { data, error } = await supabase
            .from('master')
            .select('*');

        if (error) throw error;

        const allowedFirms = normalizeFirmAccess(permittedFirms);
        const records = allowedFirms === undefined
            ? data || []
            : (data || []).filter((r: any) => {
                const firm = String(r.firm_name || '').trim().toLowerCase();
                return !firm || allowedFirms.map((allowed) => allowed.toLowerCase()).includes(firm);
            });

        // const departments = Array.from(new Set(records.map(r => r.department).filter(Boolean)));
        const uoms = Array.from(new Set(records.map(r => r.uom).filter(Boolean)));
        const firms = Array.from(new Map(
            records
                .map(r => String(r.firm_name || '').trim())
                .filter(Boolean)
                .map(firm => [firm.toLowerCase(), firm])
        ).values()).sort((a, b) => a.localeCompare(b));
        const fmsNames = Array.from(new Set(records.map(r => r.fms_name).filter(Boolean)));
        const paymentTerms = Array.from(new Set(records.map(r => r.payment_term).filter(Boolean)));
        const locations = Array.from(new Set(records.map(r => r.where).filter(Boolean)));
        const areaOfUses = Array.from(new Set(records.map(r => r.area_of_use).filter(Boolean)));
        const allGroupHeads = Array.from(new Set(records.map(r => r.group_head).filter(Boolean))).sort();

        // Fetch site engineers from the other table
        const { data: seData } = await supabase.from('site_engineer_details').select('*');
        const siteEngineers = (seData || []).map((se: any) => ({
            name: se.name,
            number: se.number,
            email: se.email
        }));

        // Fetch contractors
        const { data: contractorData } = await supabase.from('contractor_details').select('*');
        const contractors = (contractorData || []).map((c: any) => ({
            contractorName: c.contractor_name,
            contractorGstin: c.contractor_gstin || '',
            contractorAddress: c.contractor_address || '',
            contractorEmail: c.contractor_email || '',
            responsiblePerson: c.responsible_person || '',
            location: c.location || '',
            phone: c.phone || '',
        }));

        // Fetch site locations
        const { data: locationData } = await supabase.from('site_location_details').select('location');
        const siteLocations = (locationData || []).map((l: any) => l.location);

        // Aggregate vendors
        const vendors = records
            .filter(r => r.vendor_name)
            .map(r => ({
                vendorName: r.vendor_name,
                gstin: r.vendor_gstin || '',
                address: r.vendor_address || '',
                email: r.vendor_email || '',
                paymentTerm: r.payment_term || '',
                personName: r.person_name || '',
            }));

        // Deduplicate vendors by name
        const uniqueVendors = Array.from(new Map(vendors.map(v => [v.vendorName, v])).values());
        const vendorNames = uniqueVendors.map(v => v.vendorName);

        // Map group heads to departments and products to group heads
        const groupHeads: Record<string, string[]> = {};
        const products: Record<string, string[]> = {};
        records.forEach(r => {
            if (r.department && r.group_head) {
                if (!groupHeads[r.department]) {
                    groupHeads[r.department] = [];
                }
                if (!groupHeads[r.department].includes(r.group_head)) {
                    groupHeads[r.department].push(r.group_head);
                }
            }
            if (r.group_head && r.item_name) {
                if (!products[r.group_head]) {
                    products[r.group_head] = [];
                }
                if (!products[r.group_head].includes(r.item_name)) {
                    products[r.group_head].push(r.item_name);
                }
            }
        });

        // Company info (usually the first record or common values)
        const firstWithCompany = records.find(r => r.company_name) || {};

        // Firm to Company Mapping
        const firmCompanyMap: Record<string, { companyName: string; companyAddress: string; destinationAddress: string; companyContactPerson: string; }> = {};
        records.forEach(r => {
            if (r.firm_name && r.company_name) {
                firmCompanyMap[r.firm_name] = {
                    companyName: r.company_name,
                    companyAddress: r.company_address || '',
                    destinationAddress: r.destination_address || '',
                    companyContactPerson: r.company_contact_person || '',
                };
            }
        });

        // Fetch all default terms from all rows
        const rawTerms = records
            .map(r => r.default_terms)
            .filter(Boolean)
            .flatMap(termString => termString.split(/(?:\s*\|\|\s*|\\n+|\n+)/))
            .map(term => term.trim())
            .filter(term => term.length > 0);

        const allTerms = Array.from(new Set(rawTerms));
        return {
            // departments,
            groupHeads,
            allGroupHeads,
            products,
            uoms,
            firms,
            firmsnames: firms,
            fmsNames,
            paymentTerms,
            locations,
            vendors: uniqueVendors,
            vendorNames,
            companyName: firstWithCompany.company_name || '',
            companyAddress: firstWithCompany.company_address || '',
            companyEmail: firstWithCompany.company_email || '',
            companyGstin: firstWithCompany.company_gstin || '',
            companyPhone: firstWithCompany.company_phone || '',
            billingAddress: firstWithCompany.billing_address || '',
            companyPan: firstWithCompany.company_pan || '',
            destinationAddress: firstWithCompany.destination_address || '',
            companyContactPerson: firstWithCompany.company_contact_person || '',
            areaOfUses,
            siteEngineers,
            contractors,
            siteLocations,
            defaultTerms: allTerms,
            firmCompanyMap,
        };
    } catch (error) {
        console.error('Error fetching master options:', error);
        return {
            // departments: [],
            groupHeads: {},
            allGroupHeads: [],
            products: {},
            uoms: [],
            firms: [],
            firmsnames: [],
            fmsNames: [],
            paymentTerms: [],
            locations: [],
            vendors: [],
            vendorNames: [],
            companyName: '',
            companyAddress: '',
            companyEmail: '',
            companyGstin: '',
            companyPhone: '',
            billingAddress: '',
            companyPan: '',
            destinationAddress: '',
            companyContactPerson: '',
            areaOfUses: [],
            siteEngineers: [],
            contractors: [],
            siteLocations: [],
            defaultTerms: [],
            firmCompanyMap: {},
        };
    }
}

/**
 * Fetch all raw records from the master table
 */
export async function fetchMasterRecords() {
    try {
        const { data, error } = await supabase
            .from('master')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching master records:', error);
        throw error;
    }
}

/**
 * Insert a new record into the master table
 */
export async function insertMasterData(data: Record<string, any>): Promise<{ success: boolean; error?: any }> {
    try {
        const { error } = await supabase
            .from('master')
            .insert(data);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error inserting master data:', error);
        return { success: false, error };
    }
}

/**
 * Update an existing record in the master table by ID
 */
export async function updateMasterData(id: number, data: Record<string, any>): Promise<{ success: boolean; error?: any }> {
    try {
        const { error } = await supabase
            .from('master')
            .update(data)
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error updating master data:', error);
        return { success: false, error };
    }
}

/**
 * Delete a record from the master table by ID
 */
export async function deleteMasterData(id: number): Promise<{ success: boolean; error?: any }> {
    try {
        const { error } = await supabase
            .from('master')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error deleting master data:', error);
        return { success: false, error };
    }
}
/**
 * Fetch all site engineer details
 */
export async function fetchSiteEngineers() {
    try {
        const { data, error } = await supabase
            .from('site_engineer_details')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching site engineers:', error);
        throw error;
    }
}

export async function upsertSiteEngineer(data: { name: string; number: string; email: string }): Promise<{ success: boolean; error?: any }> {
    try {
        // First check if an engineer with this number already exists
        const { data: existing, error: fetchError } = await supabase
            .from('site_engineer_details')
            .select('number')
            .eq('number', data.number)
            .maybeSingle();

        if (fetchError) throw fetchError;

        let result;
        if (existing) {
            // If exists, update the details for this number
            result = await supabase
                .from('site_engineer_details')
                .update({ name: data.name, email: data.email })
                .eq('number', data.number);
        } else {
            // If not exists, insert a new record
            result = await supabase
                .from('site_engineer_details')
                .insert([data]);
        }

        if (result.error) throw result.error;
        return { success: true };
    } catch (error) {
        console.error('Error upserting site engineer:', error);
        return { success: false, error };
    }
}

/**
 * Insert a new site engineer (legacy, now uses upsert)
 */
export async function insertSiteEngineer(data: { name: string; number: string; email: string }): Promise<{ success: boolean; error?: any }> {
    return upsertSiteEngineer(data);
}

/**
 * Update a site engineer by number
 */
export async function updateSiteEngineer(number: string, data: { name: string; number: string; email: string }): Promise<{ success: boolean; error?: any }> {
    try {
        const { error } = await supabase
            .from('site_engineer_details')
            .update(data)
            .eq('number', number);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error updating site engineer:', error);
        return { success: false, error };
    }
}

/**
 * Delete a site engineer by number
 */
export async function deleteSiteEngineer(number: string): Promise<{ success: boolean; error?: any }> {
    try {
        const { error } = await supabase
            .from('site_engineer_details')
            .delete()
            .eq('number', number);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error deleting site engineer:', error);
        return { success: false, error };
    }
}

/**
 * Contractor Details Functions
 */
export async function fetchContractors() {
    try {
        const { data, error } = await supabase
            .from('contractor_details')
            .select('*')
            .order('contractor_name', { ascending: true });
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching contractors:', error);
        throw error;
    }
}

export async function insertContractor(data: any): Promise<{ success: boolean; error?: any }> {
    try {
        const { error } = await supabase.from('contractor_details').insert(data);
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error inserting contractor:', error);
        return { success: false, error };
    }
}

export async function updateContractor(id: number, data: any): Promise<{ success: boolean; error?: any }> {
    try {
        const { error } = await supabase.from('contractor_details').update(data).eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error updating contractor:', error);
        return { success: false, error };
    }
}

export async function deleteContractor(id: number): Promise<{ success: boolean; error?: any }> {
    try {
        const { error } = await supabase.from('contractor_details').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error deleting contractor:', error);
        return { success: false, error };
    }
}

/**
 * Site Location Functions
 */
export async function fetchSiteLocations() {
    try {
        const { data, error } = await supabase
            .from('site_location_details')
            .select('*')
            .order('location', { ascending: true });
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching site locations:', error);
        throw error;
    }
}

export async function insertSiteLocation(data: { location: string }): Promise<{ success: boolean; error?: any }> {
    try {
        const { error } = await supabase.from('site_location_details').insert(data);
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error inserting site location:', error);
        return { success: false, error };
    }
}

export async function updateSiteLocation(id: number, data: { location: string }): Promise<{ success: boolean; error?: any }> {
    try {
        const { error } = await supabase.from('site_location_details').update(data).eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error updating site location:', error);
        return { success: false, error };
    }
}

export async function deleteSiteLocation(id: number): Promise<{ success: boolean; error?: any }> {
    try {
        const { error } = await supabase.from('site_location_details').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error deleting site location:', error);
        return { success: false, error };
    }
}
