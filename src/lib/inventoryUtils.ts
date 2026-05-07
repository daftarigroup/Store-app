import type { InventorySheet, IndentSheet, StoreInSheet, IssueSheet } from '../types/sheets';

/**
 * Calculates real-time inventory metrics by aggregating transactional data
 * across Indents, Store-Ins, and Issues.
 */
export function calculateRealInventory(
    inventoryMaster: InventorySheet[],
    indents: IndentSheet[],
    storeIns: StoreInSheet[],
    issues: IssueSheet[],
    transfers: any[] = [],
    currentProject: string = 'All'
): InventorySheet[] {
    // 1. Group transactions by product name for efficient lookup
    const indentSummary = groupAndSum(indents, 'productName', ['quantity', 'approvedQuantity']);
    const storeInDetailed = storeIns.reduce((acc, s) => {
        const key = (s.productName || '').trim();
        if (!acc[key]) {
            acc[key] = { liftingQty: 0, stockTransfer: 0, purchaseQuantity: 0, purchaseReturn: 0 };
        }
        
        const qty = Number(s.receivedQuantity) || 0;
        const totalQty = Number(s.qty) || 0;
        const retQty = Number(s.returnQuantity) || 0;

        if (s.receivingStatus === 'Transfer') {
            acc[key].stockTransfer += qty;
        } else {
            acc[key].liftingQty += qty;
            acc[key].purchaseQuantity += totalQty;
            acc[key].purchaseReturn += retQty;
        }
        return acc;
    }, {} as Record<string, any>);
    
    const issueSummary = issues.reduce((acc, is) => {
        const key = (is.productName || '').trim();
        if (!acc[key]) {
            acc[key] = { givenQty: 0, rejectedDamageQty: 0 };
        }
        acc[key].givenQty += Number(is.givenQty) || 0;
        acc[key].rejectedDamageQty += Number(is.rejected_damage_qty) || 0;
        return acc;
    }, {} as Record<string, { givenQty: number; rejectedDamageQty: number }>);

    const transferSummary = (transfers || []).reduce((acc, t) => {
        const key = (t.productName || '').trim();
        if (!acc[key]) acc[key] = { in: 0, out: 0, totalVolume: 0, sources: new Set<string>(), destinations: new Set<string>() };
        
        const qty = Number(t.quantity) || 0;
        acc[key].totalVolume += qty;

        const curProjLower = currentProject.trim().toLowerCase();
        const toProjLower = (t.toProject || '').trim().toLowerCase();
        const fromProjLower = (t.fromProject || '').trim().toLowerCase();

        if (currentProject === 'All') {
            if (t.fromProject) acc[key].sources.add(t.fromProject);
            if (t.toProject) acc[key].destinations.add(t.toProject);
        } else {
            if (toProjLower === curProjLower) {
                acc[key].in += qty;
                if (t.fromProject) acc[key].sources.add(t.fromProject);
            }
            if (fromProjLower === curProjLower) {
                acc[key].out += qty;
                if (t.toProject) acc[key].destinations.add(t.toProject);
            }
        }
        return acc;
    }, {} as Record<string, { in: number; out: number; totalVolume: number; sources: Set<string>; destinations: Set<string> }>);

    // 1. Collect ALL unique item names from all sources to ensure we don't miss anything (e.g. transfers of new items)
    const allItemNames = new Set([
        ...inventoryMaster.map(i => (i.itemName || '').trim()),
        ...Object.keys(indentSummary),
        ...Object.keys(storeInDetailed),
        ...Object.keys(issueSummary),
        ...Object.keys(transferSummary)
    ]);

    return Array.from(allItemNames).map(itemName => {
        // Find existing master record or create a skeleton
        const item = inventoryMaster.find(i => (i.itemName || '').trim() === itemName) || {
            itemName,
            groupHead: '',
            uom: '',
            opening: 0,
            individualRate: 0,
            purchaseReturn: 0,
            issueReturn: 0,
            stockTransfer: 0
        } as InventorySheet;

        const key = itemName;
        
        const iSum = indentSummary[key] || { quantity: 0, approvedQuantity: 0 };
        const sDet = storeInDetailed[key] || { liftingQty: 0, stockTransfer: 0, purchaseQuantity: 0, purchaseReturn: 0 };
        const oSum = issueSummary[key] || { givenQty: 0, rejectedDamageQty: 0 };

        // Core metrics
        const indented = iSum.quantity;
        const approved = iSum.approvedQuantity;
        const purchaseQuantity = sDet.purchaseQuantity;
        const liftingQty = sDet.liftingQty;
        const purchaseReturn = sDet.purchaseReturn || item.purchaseReturn || 0;
        const outQuantity = oSum.givenQty;
        const issueReturn = oSum.rejectedDamageQty || item.issueReturn || 0;

        // Stock Transfer: Old way (from storeIn) + New way (from dedicated table)
        const tSum = transferSummary[key] || { in: 0, out: 0, totalVolume: 0, sources: new Set(), destinations: new Set() };
        let stockTransfer = (sDet.stockTransfer || 0) + (item.stockTransfer || 0);
        
        const stockTransferReceiving = (sDet.stockTransfer || 0) + (item.stockTransfer || 0) + (currentProject === 'All' ? tSum.totalVolume : tSum.in);
        const stockTransferGiven = currentProject === 'All' ? tSum.totalVolume : tSum.out;

        const sourcesArr = Array.from(tSum.sources);
        const destinationsArr = Array.from(tSum.destinations);
        const fromProject = sourcesArr.length > 0 ? (sourcesArr.length > 1 ? `${sourcesArr[0]} (+${sourcesArr.length - 1})` : sourcesArr[0]) : '';
        const toProject = destinationsArr.length > 0 ? (destinationsArr.length > 1 ? `${destinationsArr[0]} (+${destinationsArr.length - 1})` : destinationsArr[0]) : '';

        if (currentProject === 'All') {
            stockTransfer += tSum.totalVolume;
        } else {
            stockTransfer += (tSum.in - tSum.out);
        }

        // Derived metrics
        const inTransit = Math.max(0, purchaseQuantity - liftingQty);
        
        // Final Current Quantity Calculation:
        // Current = Opening + Lifting + NetStockTransfer - PurchaseReturn - (Issued - IssueReturn)
        const netTransferForBalance = currentProject === 'All' ? 0 : (tSum.in - tSum.out);
        const current = (item.opening || 0) + liftingQty + (sDet.stockTransfer || 0) + netTransferForBalance + (item.stockTransfer || 0) - purchaseReturn - (outQuantity - issueReturn);

        // Filter: If we are in a specific project view and there's absolutely no activity or stock for this item, skip it
        // This prevents the "All" list from being cluttered with items that have 0 everything.
        if (currentProject !== 'All' && 
            current === 0 && indented === 0 && liftingQty === 0 && stockTransferReceiving === 0 && stockTransferGiven === 0 && outQuantity === 0) {
            return null as any;
        }

        return {
            ...item,
            indented,
            approved,
            purchaseQuantity,
            purchaseReturn,
            liftingQty,
            inTransit,
            outQuantity,
            issueReturn,
            stockTransfer,
            stockTransferGiven,
            stockTransferReceiving,
            fromProject,
            toProject,
            current,
            totalPrice: current * (item.individualRate || 0),
            colorCode: current < 5 ? 'red' : 'green',
            status: current < 5 ? 'red' : 'green'
        } as InventorySheet;
    }).filter(Boolean);
}

/**
 * Helper to group an array of objects by a key and sum specified numeric fields
 */
function groupAndSum<T>(data: T[], keyField: keyof T, sumFields: string[]): Record<string, any> {
    return data.reduce((acc, item) => {
        const key = String(item[keyField] || '').trim();
        if (!acc[key]) {
            acc[key] = {};
            sumFields.forEach(f => acc[key][f] = 0);
        }
        sumFields.forEach(f => {
            const val = Number((item as any)[f]) || 0;
            acc[key][f] += val;
        });
        return acc;
    }, {} as Record<string, any>);
}
