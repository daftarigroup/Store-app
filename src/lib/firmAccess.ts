export function normalizeFirmAccess(firms?: string[]) {
    if (firms === undefined) return undefined;

    return Array.from(new Map(
        firms
            .map((firm) => String(firm || '').trim())
            .filter(Boolean)
            .map((firm) => [firm.toLowerCase(), firm])
    ).values());
}

export function hasNoFirmAccess(firms?: string[]) {
    return firms !== undefined && normalizeFirmAccess(firms)!.length === 0;
}

export function filterByFirmAccess<T extends { firmNameMatch?: string; firm_name?: string; firmName?: string }>(
    rows: T[],
    firms?: string[]
) {
    const normalized = normalizeFirmAccess(firms);
    if (normalized === undefined) return rows;
    if (normalized.length === 0) return [];

    const allowed = new Set(normalized.map((firm) => firm.toLowerCase()));
    return rows.filter((row) => {
        const rowFirm = String(row.firmNameMatch || row.firm_name || row.firmName || '').trim().toLowerCase();
        return allowed.has(rowFirm);
    });
}
