import type { InventorySheet, IndentSheet, StoreInSheet, IssueSheet } from '../types/sheets';

/**
 * Calculates real-time inventory metrics by aggregating transactional data
 * across Indents, Store-Ins, and Issues.
 */
export function calculateRealInventory(
    inventoryMaster: InventorySheet[],
    indents: IndentSheet[],
    storeIns: StoreInSheet[],
    issues: IssueSheet[]
): InventorySheet[] {
    // 1. Group transactions by product name for efficient lookup
    const indentSummary = groupAndSum(indents, 'productName', ['quantity', 'approvedQuantity']);
    const storeInSummary = groupAndSum(storeIns, 'productName', ['qty', 'receivedQuantity', 'returnQuantity']);
    const issueSummary = groupAndSum(issues, 'productName', ['givenQty', 'rejectedDamageQty']);

    return inventoryMaster.map(item => {
        const key = item.itemName;
        
        const iSum = indentSummary[key] || { quantity: 0, approvedQuantity: 0 };
        const sSum = storeInSummary[key] || { qty: 0, receivedQuantity: 0, returnQuantity: 0 };
        const oSum = issueSummary[key] || { givenQty: 0, rejectedDamageQty: 0 };

        // Core metrics
        const indented = iSum.quantity;
        const approved = iSum.approvedQuantity;
        const purchaseQuantity = sSum.qty;
        const liftingQty = sSum.receivedQuantity;
        const purchaseReturn = sSum.returnQuantity || item.purchaseReturn || 0; // Fallback to master if no trans
        const outQuantity = oSum.givenQty;
        const issueReturn = oSum.rejectedDamageQty || item.issueReturn || 0;

        // Derived metrics
        const inTransit = Math.max(0, purchaseQuantity - liftingQty);
        
        // Final Current Quantity Calculation:
        // Current = Opening + Lifting - PurchaseReturn - (Issued - IssueReturn)
        const current = (item.opening || 0) + liftingQty - purchaseReturn - (outQuantity - issueReturn);

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
            current,
            totalPrice: current * (item.individualRate || 0),
            colorCode: current < 5 ? 'red' : 'green'
        };
    });
}

/**
 * Helper to group an array of objects by a key and sum specified numeric fields
 */
function groupAndSum<T>(data: T[], keyField: keyof T, sumFields: string[]): Record<string, any> {
    return data.reduce((acc, item) => {
        const key = String(item[keyField]);
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
