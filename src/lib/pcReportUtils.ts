import type { PcReportSheet, IndentSheet, StoreInSheet, IssueSheet, FullkittingSheet, TallyEntrySheet, PaymentsSheet } from '@/types/sheets';

export const calculatePcReportCounts = (
    indentSheet: IndentSheet[],
    storeInSheet: StoreInSheet[],
    issueSheet: IssueSheet[],
    fullkittingSheet: FullkittingSheet[],
    tallyEntrySheet: TallyEntrySheet[],
    paymentsSheet: PaymentsSheet[]
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
            'Issue Data'
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
            'PO Creation'
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
            fullkittingSheet || [],
            (item) => item.planned && !item.actual,
            (item) => !!item.actual,
            'Freight Payment'
        ),
        calculateCounts(
            paymentsSheet || [],
            (item) => item.planned && !item.actual,
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
    ];
};
