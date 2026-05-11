import { supabase } from '@/lib/supabase';
import { isAllowedFirm } from '@/lib/firmAccess';

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
    departments: string[];
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
    firmObjects: { id: number; name: string }[];
    firmsnames: string[];
    fmsNames: string[];
    locations: string[];
    areaOfUses: string[];
    allGroupHeads: string[];
    siteEngineers: { name: string; number: string; email: string }[];
    contractors: { contractorName: string; contractorGstin: string; contractorAddress: string; contractorEmail: string; responsiblePerson: string; location: string; phone: string }[];
    siteLocations: string[];
    firmCompanyMap: Record<string, { companyName: string; companyAddress: string; destinationAddress: string; companyContactPerson: string; billingAddress?: string; }>;
}


/**
 * Fetch all master data options for dropdowns
 */
export async function fetchMasterOptions(permittedFirms?: string[]): Promise<MasterData> {
    try {
        // 1. Fetch Firms and Companies
        const { data: firmData, error: firmError } = await supabase
            .from('firm')
            .select(`
                id,
                firm_name,
                billing_address,
                destination_address,
                contact_person,
                company:company_id (
                    id,
                    company_name,
                    gstin,
                    pan,
                    email,
                    phone,
                    address,
                    contact_person,
                    billing_address,
                    destination_address
                )
            `)
            .eq('active', true);

        if (firmError) throw firmError;

        // 2. Fetch Group Heads
        const { data: ghData, error: ghError } = await supabase
            .from('group_head')
            .select('*')
            .order('name');

        if (ghError) throw ghError;

        // 3. Fetch UOMs
        const { data: uomData, error: uomError } = await supabase
            .from('uom')
            .select('*')
            .order('name');

        if (uomError) throw uomError;

        // 4. Fetch Area of Use
        const { data: aouData, error: aouError } = await supabase
            .from('area_of_use')
            .select('*')
            .order('name');

        if (aouError) throw aouError;

        // 5. Fetch Items
        const { data: itemData, error: itemError } = await supabase
            .from('item')
            .select(`
                id,
                item_name,
                group_head:group_head_id ( name ),
                uom:uom_id ( name )
            `)
            .order('item_name');

        if (itemError) throw itemError;

        // 6. Fetch Vendors
        const { data: vendorData, error: vendorError } = await supabase
            .from('vendors')
            .select('*')
            .order('vendor_name');

        if (vendorError) throw vendorError;

        const { data: departmentData } = await supabase
            .from('department')
            .select('*')
            .order('name');

        const { data: defaultTermsData } = await supabase
            .from('default_po_terms')
            .select('*')
            .eq('active', true)
            .order('sort_order', { ascending: true });

        // 7. Fetch Site Engineers, Contractors, Site Locations (Stay same for now)
        const { data: seData } = await supabase.from('site_engineer_details').select('*');
        const siteEngineers = (seData || []).map((se: any) => ({
            name: se.name,
            number: se.number,
            email: se.email
        }));

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

        const { data: locationData } = await supabase.from('site_location_details').select('location');
        const siteLocations = (locationData || []).map((l: any) => l.location);

        // --- Processing Data for Return ---
        
        // Firms and Company Map
        const firms: string[] = [];
        const firmObjects: { id: number; name: string }[] = [];
        const firmCompanyMap: Record<string, any> = {};
        let firstCompany: any = null;

        (firmData || []).forEach((f: any) => {
            const firmName = f.firm_name;
            const firmId = f.id;
            
            // Use isAllowedFirm helper to check permissions (supports both name and ID)
            if (!isAllowedFirm({ id: firmId, name: firmName }, permittedFirms)) {
                return;
            }

            firms.push(firmName);
            firmObjects.push({ id: firmId, name: firmName });
            
            const company = f.company || {};
            if (!firstCompany && company.company_name) firstCompany = company;

            firmCompanyMap[firmName] = {
                companyName: company.company_name || '',
                companyAddress: company.address || '',
                destinationAddress: f.destination_address || company.destination_address || '',
                companyContactPerson: f.contact_person || company.contact_person || '',
                billingAddress: f.billing_address || company.billing_address || '',
            };
        });

        firms.sort((a, b) => a.localeCompare(b));
        firmObjects.sort((a, b) => a.name.localeCompare(b.name));


        const uoms = (uomData || []).map(u => u.name).filter(Boolean);
        const areaOfUses = (aouData || []).map(a => a.name).filter(Boolean);
        const allGroupHeads = (ghData || []).map(g => g.name).filter(Boolean);
        const departments = (departmentData || []).map((d: any) => d.name).filter(Boolean);
        const defaultTerms = (defaultTermsData || []).map((t: any) => t.term_text).filter(Boolean);

        // Group Heads and Products mapping
        const groupHeadsMap: Record<string, string[]> = {}; 
        const productsMap: Record<string, string[]> = {};
        
        (itemData || []).forEach((item: any) => {
            const ghName = item.group_head?.name;
            if (ghName) {
                if (!productsMap[ghName]) productsMap[ghName] = [];
                if (!productsMap[ghName].includes(item.item_name)) {
                    productsMap[ghName].push(item.item_name);
                }
            }
        });

        // Vendors
        const vendors = (vendorData || []).map(v => ({
            vendorName: v.vendor_name,
            gstin: v.gstin || '',
            address: v.address || '',
            email: v.email || '',
            paymentTerm: v.payment_term || '',
            personName: v.person_name || '',
        }));
        const vendorNames = vendors.map(v => v.vendorName);

        return {
            groupHeads: groupHeadsMap,
            allGroupHeads,
            products: productsMap,
            uoms,
            firms,
            firmObjects,
            firmsnames: firms,

            fmsNames: [],
            paymentTerms: Array.from(new Set(vendors.map(v => v.paymentTerm).filter(Boolean))),
            departments,
            locations: [],
            vendors,
            vendorNames,
            companyName: firstCompany?.company_name || '',
            companyAddress: firstCompany?.address || '',
            companyEmail: firstCompany?.email || '',
            companyGstin: firstCompany?.gstin || '',
            companyPhone: firstCompany?.phone || '',
            billingAddress: firstCompany?.billing_address || '',
            companyPan: firstCompany?.pan || '',
            destinationAddress: firstCompany?.destination_address || '',
            companyContactPerson: firstCompany?.contact_person || '',
            areaOfUses,
            siteEngineers,
            contractors,
            siteLocations,
            defaultTerms,
            firmCompanyMap,
        };
    } catch (error) {
        console.error('Error fetching master options:', error);
        return {
            groupHeads: {},
            allGroupHeads: [],
            products: {},
            uoms: [],
            firms: [],
            firmObjects: [],
            firmsnames: [],

            fmsNames: [],
            paymentTerms: [],
            locations: [],
            vendors: [],
            vendorNames: [],
            departments: [],
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
 * Fetch master-compatible records from normalized tables.
 * The returned shape intentionally matches the old `master` columns because
 * several views still consume those field names.
 */
export async function fetchMasterRecords(): Promise<any[]> {
    try {
        const [
            companies,
            firms,
            groupHeads,
            uoms,
            areaOfUses,
            vendors,
            items,
            departments,
            defaultTerms,
        ] = await Promise.all([
            supabase.from('company').select('*').order('company_name'),
            supabase.from('firm').select('*, company:company_id(*)').order('firm_name'),
            supabase.from('group_head').select('*').order('name'),
            supabase.from('uom').select('*').order('name'),
            supabase.from('area_of_use').select('*').order('name'),
            supabase.from('vendors').select('*').order('vendor_name'),
            supabase.from('item').select('*, group_head:group_head_id(name), uom:uom_id(name)').order('item_name'),
            supabase.from('department').select('*').order('name'),
            supabase.from('default_po_terms').select('*').order('sort_order', { ascending: true }),
        ]);

        const firstError = [companies, firms, groupHeads, uoms, areaOfUses, vendors, items, departments, defaultTerms].find(result => result.error)?.error;
        if (firstError) throw firstError;

        return [
            ...(companies.data || []).map((c: any) => ({
                id: c.id,
                __table: 'company',
                company_name: c.company_name,
                company_gstin: c.gstin,
                company_pan: c.pan,
                company_email: c.email,
                company_phone: c.phone,
                company_address: c.address,
                company_contact_person: c.contact_person,
                billing_address: c.billing_address,
                destination_address: c.destination_address,
            })),
            ...(firms.data || []).map((f: any) => ({
                id: f.id,
                __table: 'firm',
                firm_name: f.firm_name,
                company_name: f.company?.company_name,
                company_address: f.company?.address,
                company_gstin: f.company?.gstin,
                company_pan: f.company?.pan,
                billing_address: f.billing_address || f.company?.billing_address,
                destination_address: f.destination_address || f.company?.destination_address,
                company_contact_person: f.contact_person || f.company?.contact_person,
            })),
            ...(groupHeads.data || []).map((g: any) => ({ id: g.id, __table: 'group_head', group_head: g.name })),
            ...(uoms.data || []).map((u: any) => ({ id: u.id, __table: 'uom', uom: u.name })),
            ...(areaOfUses.data || []).map((a: any) => ({ id: a.id, __table: 'area_of_use', area_of_use: a.name })),
            ...(vendors.data || []).map((v: any) => ({
                id: v.id,
                __table: 'vendors',
                vendor_name: v.vendor_name,
                vendor_gstin: v.gstin,
                vendor_address: v.address,
                vendor_email: v.email,
                payment_term: v.payment_term,
                person_name: v.person_name,
                responsible_person: v.person_name,
                phone: v.phone,
                location: v.location,
                billing_address: v.address,
                destination_address: v.address,
            })),
            ...(items.data || []).map((i: any) => ({
                id: i.id,
                __table: 'item',
                item_name: i.item_name,
                group_head: i.group_head?.name,
                uom: i.uom?.name,
                regular_conditions: i.regular_pay_condition || [],
                third_party_conditions: i.third_party_pay_condition || [],
            })),
            ...(departments.data || []).map((d: any) => ({ id: d.id, __table: 'department', department: d.name })),
            ...(defaultTerms.data || []).map((t: any) => ({
                id: t.id,
                __table: 'default_po_terms',
                default_terms: t.term_text,
                sort_order: t.sort_order,
            })),
        ];
    } catch (error) {
        console.error('Error fetching normalized master records:', error);
        throw error;
    }
}

/**
 * Insert a new master registry record into the normalized table for that field.
 */
export async function insertMasterData(data: Record<string, any>): Promise<{ success: boolean; error?: any }> {
    try {
        const result = await upsertNormalizedMasterRecord(data);
        if (result.error) throw result.error;
        return { success: true };
    } catch (error) {
        console.error('Error inserting normalized master data:', error);
        return { success: false, error };
    }
}

async function upsertNormalizedMasterRecord(values: Record<string, any>, id?: number) {
    if ('company_name' in values) {
        const payload = {
            company_name: values.company_name,
            gstin: values.company_gstin || null,
            pan: values.company_pan || null,
            email: values.company_email || null,
            phone: values.company_phone || null,
            address: values.company_address || null,
            contact_person: values.company_contact_person || null,
            billing_address: values.billing_address || null,
            destination_address: values.destination_address || null,
        };
        return id ? supabase.from('company').update(payload).eq('id', id) : supabase.from('company').insert(payload);
    }

    if ('firm_name' in values) {
        const payload = { firm_name: values.firm_name };
        return id ? supabase.from('firm').update(payload).eq('id', id) : supabase.from('firm').insert(payload);
    }

    if ('group_head' in values && !('item_name' in values) && !('uom' in values)) {
        const payload = { name: values.group_head };
        return id ? supabase.from('group_head').update(payload).eq('id', id) : supabase.from('group_head').insert(payload);
    }

    if ('uom' in values && !('item_name' in values) && !('group_head' in values)) {
        const payload = { name: values.uom };
        return id ? supabase.from('uom').update(payload).eq('id', id) : supabase.from('uom').insert(payload);
    }

    if ('area_of_use' in values) {
        const payload = { name: values.area_of_use };
        return id ? supabase.from('area_of_use').update(payload).eq('id', id) : supabase.from('area_of_use').insert(payload);
    }

    if ('department' in values) {
        const payload = { name: values.department };
        return id ? supabase.from('department').update(payload).eq('id', id) : supabase.from('department').insert(payload);
    }

    if ('default_terms' in values) {
        const payload = { term_text: values.default_terms, active: true };
        return id ? supabase.from('default_po_terms').update(payload).eq('id', id) : supabase.from('default_po_terms').insert(payload);
    }

    if ('vendor_name' in values) {
        const payload = {
            vendor_name: values.vendor_name,
            gstin: values.vendor_gstin || null,
            address: values.vendor_address || null,
            email: values.vendor_email || null,
            payment_term: values.payment_term || null,
            person_name: values.person_name || values.responsible_person || null,
            phone: values.phone || null,
            location: values.location || null,
        };
        return id ? supabase.from('vendors').update(payload).eq('id', id) : supabase.from('vendors').insert(payload);
    }

    if ('item_name' in values) {
        const groupHeadId = await findOrCreateLookupId('group_head', values.group_head);
        const uomId = await findOrCreateLookupId('uom', values.uom);
        const normalizeConditions = (conditions: any) => Array.isArray(conditions)
            ? conditions.map((condition: any) => String((condition?.value ?? condition) || '').trim()).filter(Boolean)
            : [];
        const payload = {
            item_name: values.item_name,
            group_head_id: groupHeadId,
            uom_id: uomId,
            regular_pay_condition: normalizeConditions(values.regular_conditions),
            third_party_pay_condition: normalizeConditions(values.third_party_conditions),
        };
        return id ? supabase.from('item').update(payload).eq('id', id) : supabase.from('item').insert(payload);
    }

    if ('group_head' in values || 'uom' in values) {
        if (values.group_head) await findOrCreateLookupId('group_head', values.group_head);
        if (values.uom) await findOrCreateLookupId('uom', values.uom);
        return { error: null };
    }

    return { error: new Error('Unsupported normalized master payload') };
}

function isDuplicateError(error: any) {
    return error?.code === '23505';
}

async function findOrCreateLookupId(table: 'group_head' | 'uom', name?: string | null) {
    const normalizedName = String(name || '').trim();
    if (!normalizedName) return null;

    const { data: existing, error: findError } = await supabase
        .from(table)
        .select('id')
        .ilike('name', normalizedName)
        .maybeSingle();

    if (findError) throw findError;
    if (existing?.id) return existing.id;

    const { data: inserted, error: insertError } = await supabase
        .from(table)
        .insert({ name: normalizedName })
        .select('id')
        .single();

    if (insertError) {
        if (isDuplicateError(insertError)) {
            const { data: retry, error: retryError } = await supabase
                .from(table)
                .select('id')
                .ilike('name', normalizedName)
                .maybeSingle();

            if (retryError) throw retryError;
            return retry?.id || null;
        }

        throw insertError;
    }

    return inserted?.id || null;
}

/**
 * Backward-compatible alias. Writes now go directly to normalized tables.
 */
export async function insertNormalizedMasterData(_type: string, values: Record<string, any>): Promise<{ success: boolean; error?: any }> {
    try {
        void values;
        // Kept for older call sites. insertMasterData already writes directly
        // to normalized tables, so a second write here would duplicate items.
        return { success: true };
    } catch (error) {
        console.error('Error inserting normalized master data:', error);
        return { success: false, error };
    }
}

/**
 * Update an existing normalized master record by ID.
 */
export async function updateMasterData(id: number, data: Record<string, any>): Promise<{ success: boolean; error?: any }> {
    try {
        const result = await upsertNormalizedMasterRecord(data, id);
        const error = result.error;

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error updating master data:', error);
        return { success: false, error };
    }
}

/**
 * Delete a normalized master record by ID and table/type.
 */
export async function deleteMasterData(id: number, type?: string): Promise<{ success: boolean; error?: any }> {
    try {
        const tableByType: Record<string, string> = {
            company: 'company',
            project: 'firm',
            firm: 'firm',
            gh: 'group_head',
            group_head: 'group_head',
            uom: 'uom',
            areaofuse: 'area_of_use',
            area_of_use: 'area_of_use',
            vendor: 'vendors',
            vendors: 'vendors',
            item: 'item',
            dept: 'department',
            department: 'department',
            default_terms: 'default_po_terms',
            default_po_terms: 'default_po_terms',
        };
        const table = tableByType[type || ''];
        if (!table) throw new Error('Delete requires a normalized master record type');

        const { error } = await supabase
            .from(table)
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
