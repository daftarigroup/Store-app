import { PackageCheck } from 'lucide-react';
import Heading from '../element/Heading';
import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import type { PcReportSheet } from '@/types/sheets';
import { useSheets } from '@/context/SheetsContext';
import { calculatePcReportCounts } from '@/lib/pcReportUtils';

export default function PcReportTable() {
    const {
        pcReportSheet,
        allLoading
    } = useSheets();


    const historyColumns: ColumnDef<PcReportSheet>[] = [
        { accessorKey: 'stage', header: 'Stage' },
        { accessorKey: 'totalPending', header: 'Total Pending' },
        { accessorKey: 'totalComplete', header: 'Total Complete' },
        // { accessorKey: 'pendingPmpl', header: 'Pending PMPL' },
        // { accessorKey: 'pendingPurab', header: 'Pending PURAB' },
        // { accessorKey: 'pendingPmmpl', header: 'Pending PMMPL' },
        // { accessorKey: 'pendingRefrasynth', header: 'Pending REFRASYNTH' },
    ];

    return (
        <div>
            <Heading heading="PC Report" subtext="View real-time pending and completed stages report">
                <PackageCheck size={50} className="text-primary" />
            </Heading>

            <DataTable
                data={pcReportSheet}
                columns={historyColumns}
                searchFields={['stage']}
                dataLoading={allLoading}
                className="h-[80dvh]"
            />
        </div>
    );
}
