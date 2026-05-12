export function normalizeFirmAccess(firms?: (string | number)[]) {
    if (firms === undefined) return undefined;

    const normalized = firms
        .map((firm) => String(firm || '').trim())
        .filter(Boolean);
    
    const lowercaseFirms = normalized.map(f => f.toLowerCase());
    if (lowercaseFirms.includes('all')) return undefined;

    return Array.from(new Set(normalized));
}

export function hasNoFirmAccess(firms?: (string | number)[]) {
    const normalized = normalizeFirmAccess(firms);
    return normalized !== undefined && normalized.length === 0;
}

export function isAllowedFirm(firm: { id?: number | string; name?: string }, permitted?: (string | number)[]) {
    const allowed = normalizeFirmAccess(permitted);
    if (allowed === undefined) return true; // 'all' access
    if (allowed.length === 0) return false;

    const firmId = String(firm.id || '').trim();

    return allowed.some(val => {
        const normalizedVal = String(val).trim();
        // Check ID match
        return firmId && normalizedVal === firmId;
    });
}

export function filterByFirmAccess<T>(
    rows: T[],
    firms?: (string | number)[],
    accessors: { 
        id?: (row: T) => number | string | undefined; 
        name?: (row: T) => string | undefined; 
    } = {}
) {
    const allowed = normalizeFirmAccess(firms);
    if (allowed === undefined) return rows;
    if (allowed.length === 0) return [];

    return rows.filter((row: any) => {
        // Use provided accessors or fall back to common property names
        const firmId = accessors.id ? accessors.id(row) : (row.firm_id || row.id);
        
        return isAllowedFirm({ id: firmId }, allowed);
    });
}



export function applyFirmAccessFilter(query: any, firms?: (string | number)[]) {
    const allowed = normalizeFirmAccess(firms);
    if (allowed === undefined) return query; // 'all' access — no filter
    if (allowed.length === 0) return null;   // no access — return nothing

    const ids = allowed.filter((firm) => /^\d+$/.test(String(firm))).map(Number);

    // Filter exclusively by firm_id
    if (ids.length > 0) {
        return query.in('firm_id', ids);
    }

    // If no numerical IDs are found in access list, return null to deny access
    return null;
}
