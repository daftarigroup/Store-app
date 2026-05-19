import type { PoMasterSheet } from '@/types';
import type { PcReportSheet, IndentSheet, StoreInSheet, IssueSheet, FullkittingSheet, TallyEntrySheet, PaymentsSheet } from '@/types/sheets';

export const calculatePcReportCounts = (
    indentSheet: IndentSheet[],
    storeInSheet: StoreInSheet[],
    issueSheet: IssueSheet[],
    fullkittingSheet: FullkittingSheet[],
    tallyEntrySheet: TallyEntrySheet[],
    paymentsSheet: PaymentsSheet[],
    poMasterSheet: PoMasterSheet[]
): PcReportSheet[] => {

    // ----------------------------------------------------------------
    // Single-pass stage counter
    // Previously: 6 separate .filter() passes per stage (one for
    // totalPending, one for totalComplete, one per firm × 4).
    // Now: one loop accumulates all six counters simultaneously.
    // ----------------------------------------------------------------
    const countStage = (
        data: any[],
        pendingFilter: (item: any) => boolean,
        completeFilter: (item: any) => boolean,
        stageName: string
    ): PcReportSheet => {
        let totalPending = 0;
        let totalComplete = 0;
        let pendingPmpl = 0;
        let pendingPurab = 0;
        let pendingPmmpl = 0;
        let pendingRefrasynth = 0;

        for (const item of data) {
            if (pendingFilter(item)) {
                totalPending++;
                const firm = (item.firmNameMatch || item.firm_name)?.toUpperCase();
                if (firm === 'PMPL') pendingPmpl++;
                else if (firm === 'PURAB') pendingPurab++;
                else if (firm === 'PMMPL') pendingPmmpl++;
                else if (firm === 'REFRASYNTH') pendingRefrasynth++;
            }
            if (completeFilter(item)) totalComplete++;
        }

        return { stage: stageName, totalPending, totalComplete, pendingPmpl, pendingPurab, pendingPmmpl, pendingRefrasynth };
    };

    // ----------------------------------------------------------------
    // Pre-build lookup structures for "Process for Payment" stage.
    // Previously: .find() inside .forEach() = O(N²).
    // Now: one pass to build Maps → each lookup is O(1).
    // ----------------------------------------------------------------

    // Single pass over storeInSheet builds both maps and the receivedPos set
    const storeInByPoNo = new Map<string, any>();
    const storeInByIndentNo = new Map<string, any>();
    const receivedPos = new Set<string>();

    for (const s of storeInSheet || []) {
        const poNo = (s as any).poNumber || (s as any).po_number || '';
        if (poNo) {
            if (!storeInByPoNo.has(poNo)) storeInByPoNo.set(poNo, s);
            if ((s as any).actual6 && (s as any).actual6 !== '') receivedPos.add(poNo);
        }
        const indentNo = (s as any).indentNo || (s as any).indentNumber || '';
        if (indentNo && !storeInByIndentNo.has(indentNo)) storeInByIndentNo.set(indentNo, s);
    }

    // Single pass over paymentsSheet to build po→totalPaid map
    const paymentsByPo: Record<string, number> = {};
    for (const p of paymentsSheet || []) {
        const k = (p as any).poNumber || (p as any).po_number || '';
        if (k) paymentsByPo[k] = (paymentsByPo[k] || 0) + Number((p as any).payAmount || (p as any).pay_amount || 0);
    }

    const uniqueBills = new Set<string>();

    // PO Based — O(M) via Map lookup instead of O(M × N)
    for (const r of poMasterSheet || []) {
        const poNum = (r as any).poNumber || (r as any).po_number || '';
        const isReceived = receivedPos.has(poNum);
        const paymentTerms = ((r as any).paymentTerms || (r as any).payment_terms || '').toString().trim().toLowerCase();
        const isPI = paymentTerms.includes('partly pi') || paymentTerms.includes('partly advance');
        const totalPo = Number((r as any).totalPoAmount || 0);
        const totalPaid = paymentsByPo[poNum] || 0;
        const outstanding = totalPo - totalPaid;
        const status = String((r as any).status || '').toLowerCase();
        const isPending = status === 'pending' || status === '';

        if ((isReceived || isPI) && outstanding > 0 && isPending) {
            const linkedStoreIn = storeInByPoNo.get(poNum); // O(1)
            const billNo = linkedStoreIn?.billNo || 'NoBill';
            uniqueBills.add(`${(r as any).partyName || (r as any).party_name}-${billNo}`);
        }
    }

    // Payment Based — O(P) via Map lookup instead of O(P × N)
    for (const p of paymentsSheet || []) {
        const status = String((p as any).status || '').toLowerCase();
        const isPending = status === 'pending';
        const notScheduled = !(p as any).planned || String((p as any).planned).trim() === '';

        if (isPending && notScheduled) {
            const internalCode = (p as any).internalCode || (p as any).internal_code || '';
            const linkedStoreIn = storeInByIndentNo.get(internalCode); // O(1)
            const billNo = (p as any).billNo || (p as any).bill_no || linkedStoreIn?.billNo || 'NoBill';
            uniqueBills.add(`${(p as any).partyName || (p as any).party_name}-${billNo}`);
        }
    }

    return [
        countStage(
            issueSheet || [],
            (item) => item.planned1 && !item.actual1,
            (item) => !!item.actual1,
            'Store Issue'
        ),
        countStage(
            indentSheet || [],
            (item) => item.planned1 && !item.actual1,
            (item) => !!item.actual1,
            'Indent Approval'
        ),
        countStage(
            indentSheet || [],
            (item) => item.planned2 && !item.actual2,
            (item) => !!item.actual2,
            'Vendor Rate Update'
        ),
        countStage(
            indentSheet || [],
            (item) => item.planned3 && !item.actual3,
            (item) => !!item.actual3,
            'Technical Approval'
        ),
        countStage(
            indentSheet || [],
            (item) => item.planned4 && !item.actual4,
            (item) => !!item.actual4,
            'Management Approval'
        ),
        countStage(
            indentSheet || [],
            (item) =>
                item.poRequred &&
                item.poRequred.toString().trim() === 'Yes' &&
                item.pendingPoQty &&
                item.pendingPoQty > 0 &&
                item.approvedVendorName &&
                item.approvedVendorName.toString().trim() !== '',
            (item) => !item.poRequred || item.poRequred !== 'Yes' || (item.pendingPoQty || 0) <= 0,
            'Pending PO'
        ),
        countStage(
            indentSheet || [],
            (item) => (item.liftingStatus === 'Pending' || item.lifting_status === 'Pending') && item.planned5 && !item.actual5,
            (item) => !!item.actual5,
            'Lifting'
        ),
        countStage(
            storeInSheet || [],
            (item) => (item.planned6 || item.planned_6) && !(item.actual6 || item.actual_6),
            (item) => !!(item.actual6 || item.actual_6),
            'Store Check'
        ),
        countStage(
            storeInSheet || [],
            (item) => (item.plannedHod || item.hod_planned) && !(item.actualHod || item.hod_actual),
            (item) => !!(item.actualHod || item.hod_actual),
            'HOD Check'
        ),
        countStage(
            fullkittingSheet || [],
            (item) => item.planned && !item.actual,
            (item) => !!item.actual,
            'Freight Payment'
        ),
        countStage(
            paymentsSheet || [],
            (item) => item.planned && !item.actual && item.status1 !== 'hod_approval_pending',
            (item) => !!item.actual,
            'Make Payment'
        ),
        countStage(
            storeInSheet || [],
            (item) => (item.planned7 || item.planned_7) && !(item.actual7 || item.actual_7),
            (item) => !!(item.actual7 || item.actual_7),
            'Reject For GRN'
        ),
        countStage(
            storeInSheet || [],
            (item) => (item.planned9 || item.planned_9) && !(item.actual9 || item.actual_9),
            (item) => !!(item.actual9 || item.actual_9),
            'Send Debit Note'
        ),
        countStage(
            tallyEntrySheet || [],
            (item) => item.planned1 && !item.actual1,
            (item) => !!item.actual1,
            'Audit Data'
        ),
        countStage(
            storeInSheet || [],
            (item) => (item.planned11 || item.planned_11) && !(item.actual11 || item.actual_11),
            (item) => !!(item.actual11 || item.actual_11),
            'Bill Not Received'
        ),
        {
            stage: 'Process for Payment / Debit Note',
            totalPending: uniqueBills.size,
            totalComplete: 0,
            pendingPmpl: 0,
            pendingPurab: 0,
            pendingPmmpl: 0,
            pendingRefrasynth: 0,
        },
    ];
};
