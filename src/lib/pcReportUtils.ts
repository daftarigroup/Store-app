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
    const calculateCounts = (data: any[], pendingFilter: (item: any) => boolean, completeFilter: (item: any) => boolean, stageName: string): PcReportSheet => {
        const firms = ['PMPL', 'PURAB', 'PMMPL', 'REFRASYNTH'];
        const firmData: Record<string, number> = {};

        firms.forEach(firm => {
            firmData[firm] = data.filter(item =>
                (item.firmNameMatch || item.firm_name_match)?.toUpperCase() === firm && pendingFilter(item)
            ).length;
        });

        return {
            stage: stageName,
            totalPending: data.filter(pendingFilter).length,
            totalComplete: data.filter(completeFilter).length,
            pendingPmpl: firmData['PMPL'],
            pendingPurab: firmData['PURAB'],
            pendingPmmpl: firmData['PMMPL'],
            pendingRefrasynth: firmData['REFRASYNTH']
        };
    };

    return [
        calculateCounts(
            issueSheet || [],
            (item) => item.planned1 && !item.actual1,
            (item) => !!item.actual1,
            'Store Issue'
        ),
        calculateCounts(
            indentSheet || [],
            (item) => item.planned1 && !item.actual1,
            (item) => !!item.actual1,
            'Department Indent Approval'
        ),
        calculateCounts(
            indentSheet || [],
            (item) => item.planned2 && !item.actual2,
            (item) => !!item.actual2,
            'Vendor Rate Update'
        ),
        calculateCounts(
            indentSheet || [],
            (item) => item.planned3 && !item.actual3,
            (item) => !!item.actual3,
            'Department Approval'
        ),
        calculateCounts(
            indentSheet || [],
            (item) => item.planned4 && !item.actual4,
            (item) => !!item.actual4,
            'Department Approval'
        ),
        calculateCounts(
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
        calculateCounts(
            indentSheet || [],
            (item) => (item.liftingStatus === 'Pending' || item.lifting_status === 'Pending') && item.planned5 && !item.actual5,
            (item) => !!item.actual5,
            'Lifting'
        ),
        calculateCounts(
            storeInSheet || [],
            (item) => (item.planned6 || item.planned_6) && !(item.actual6 || item.actual_6),
            (item) => !!(item.actual6 || item.actual_6),
            'Store Check'
        ),
        calculateCounts(
            storeInSheet || [],
            (item) => (item.plannedHod || item.hod_planned) && !(item.actualHod || item.hod_actual),
            (item) => !!(item.actualHod || item.hod_actual),
            'HOD Check'
        ),
        calculateCounts(
            fullkittingSheet || [],
            (item) => item.planned && !item.actual,
            (item) => !!item.actual,
            'Freight Payment'
        ),
        calculateCounts(
            paymentsSheet || [],
            (item) => item.planned && !item.actual && item.status1 !== 'hod_approval_pending',
            (item) => !!item.actual,
            'Make Payment'
        ),
        calculateCounts(
            storeInSheet || [],
            (item) => (item.planned7 || item.planned_7) && !(item.actual7 || item.actual_7),
            (item) => !!(item.actual7 || item.actual_7),
            'Reject For GRN'
        ),
        calculateCounts(
            storeInSheet || [],
            (item) => (item.planned9 || item.planned_9) && !(item.actual9 || item.actual_9),
            (item) => !!(item.actual9 || item.actual_9),
            'Send Debit Note'
        ),
        calculateCounts(
            tallyEntrySheet || [],
            (item) => item.planned1 && !item.actual1,
            (item) => !!item.actual1,
            'Audit Data'
        ),
        calculateCounts(
            storeInSheet || [],
            (item) => (item.planned11 || item.planned_11) && !(item.actual11 || item.actual_11),
            (item) => !!(item.actual11 || item.actual_11),
            'Bill Not Received'
        ),
        {
            stage: 'Process for Payment / Debit Note',
            totalPending: (() => {
                const receivedPos = new Set((storeInSheet || []).filter((s: any) => s.actual6 && s.actual6 !== '').map((s: any) => s.poNumber || s.po_number).filter(Boolean));
                const paymentsByPo: Record<string, number> = {};
                (paymentsSheet || []).forEach((p: any) => { const k = p.poNumber || p.po_number || ''; if (k) paymentsByPo[k] = (paymentsByPo[k] || 0) + Number(p.payAmount || p.pay_amount || 0); });

                const uniqueBills = new Set<string>();

                // PO Based
                (poMasterSheet || []).forEach((r: any) => {
                    const poNum = r.poNumber || r.po_number || '';
                    const isReceived = receivedPos.has(poNum);
                    const paymentTerms = (r.paymentTerms || r.payment_terms || '').toString().trim().toLowerCase();
                    const isPI = paymentTerms.includes("partly pi") || paymentTerms.includes("partly advance");
                    
                    const totalPo = Number(r.totalPoAmount || 0);
                    const totalPaid = paymentsByPo[poNum] || 0;
                    const outstanding = totalPo - totalPaid;
                    const status = String(r.status || '').toLowerCase();
                    const isPending = status === 'pending' || status === '';
                    
                    if ((isReceived || isPI) && outstanding > 0 && isPending) {
                        const linkedStoreIn = (storeInSheet || []).find((s: any) => (s.poNumber || s.po_number) === poNum);
                        const billNo = linkedStoreIn?.billNo || 'NoBill';
                        uniqueBills.add(`${r.partyName || r.party_name}-${billNo}`);
                    }
                });

                // Payment Based
                (paymentsSheet || []).forEach((p: any) => {
                    const status = String(p.status || '').toLowerCase();
                    const isPending = status === 'pending';
                    const notScheduled = !p.planned || String(p.planned).trim() === '';

                    if (isPending && notScheduled) {
                        const linkedStoreIn = (storeInSheet || []).find((s: any) => (s.indentNo || s.indentNumber) === (p.internalCode || p.internal_code));
                        const billNo = p.billNo || (p as any).bill_no || linkedStoreIn?.billNo || 'NoBill';
                        uniqueBills.add(`${p.partyName || p.party_name}-${billNo}`);
                    }
                });

                return uniqueBills.size;
            })(),
            totalComplete: 0,
            pendingPmpl: 0,
            pendingPurab: 0,
            pendingPmmpl: 0,
            pendingRefrasynth: 0
        }
    ];
};
