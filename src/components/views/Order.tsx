import { Package2 } from 'lucide-react';
import Heading from '../element/Heading';
import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { Pill } from '../ui/pill';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '@/context/AuthContext';
import { supabase, supabaseEnabled } from '@/lib/supabase';
import { toast } from 'sonner';

interface HistoryData {
    poNumber: string;
    poCopy: string;
    vendorName: string;
    preparedBy: string;
    approvedBy: string;
    totalAmount: number;
    status: 'Revised' | 'Not Received' | 'Received';
    timestamp: string;
}

interface POMasterRecord {
    approvedBy?: string;
    pdf?: string;
    poNumber?: string;
    preparedBy?: string;
    totalPoAmount?: string | number;
    partyName?: string;
    firmNameMatch?: string;
}

interface IndentRecord {
    poNumber?: string;
}

interface ReceivedRecord {
    poNumber?: string;
}

export default function POHistory() {
    const { user } = useAuth();

    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [dataLoading, setDataLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('All');

    useEffect(() => {
        async function fetchPOHistory() {
            if (!supabaseEnabled) return;

            try {
                setDataLoading(true);

                // Fetch PO Master data
                let poQuery = supabase
                    .from('po_master')
                    .select('*')
                    .order('timestamp', { ascending: false });

                if (user?.firmNameMatch?.toLowerCase() !== 'all') {
                    poQuery = poQuery.eq('firm_name_match', user.firmNameMatch);
                }

                const { data: poMasterData, error: poError } = await poQuery;
                if (poError) throw poError;

                // Fetch indent data to check PO status
                const { data: indentData, error: indentError } = await supabase
                    .from('indent')
                    .select('indent_number, po_number')
                    .not('po_number', 'is', null);

                if (indentError) throw indentError;

                // Fetch received data to check if PO is received
                const { data: receivedData, error: receivedError } = await supabase
                    .from('received')
                    .select('po_number')
                    .not('po_number', 'is', null);

                if (receivedError) throw receivedError;

                // Create sets for quick lookup
                const indentPoNumbers = new Set(
                    (indentData || [])
                        .map(r => r.po_number)
                        .filter(Boolean)
                );

                const receivedPoNumbers = new Set(
                    (receivedData || [])
                        .map(r => r.po_number)
                        .filter(Boolean)
                );

                // Get unique PO numbers
                const uniquePOMap = new Map<string, any>();
                (poMasterData || []).forEach((sheet: any) => {
                    const poNumber = sheet?.po_number;
                    if (poNumber && !uniquePOMap.has(poNumber)) {
                        uniquePOMap.set(poNumber, sheet);
                    }
                });

                // Process history data
                const processedHistoryData: HistoryData[] = Array.from(uniquePOMap.values()).map((sheet: any) => {
                    const poNumber = sheet.po_number || '';

                    // Determine status
                    let status: 'Revised' | 'Not Received' | 'Received' = 'Not Received';

                    if (indentPoNumbers.has(poNumber)) {
                        status = receivedPoNumbers.has(poNumber) ? 'Received' : 'Not Received';
                    } else {
                        status = 'Revised';
                    }

                    return {
                        approvedBy: sheet.approved_by || '',
                        poCopy: sheet.pdf || '',
                        poNumber: poNumber,
                        preparedBy: sheet.prepared_by || '',
                        totalAmount: Number(sheet.total_po_amount) || 0,
                        vendorName: sheet.party_name || '',
                        status: status,
                        timestamp: sheet.timestamp || '',
                    };
                });

                // Explicitly sort by latest
                processedHistoryData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                setHistoryData(processedHistoryData);
            } catch (error) {
                console.error('Error fetching PO history:', error);
                toast.error('Failed to fetch PO history');
                setHistoryData([]);
            } finally {
                setDataLoading(false);
            }
        }

        fetchPOHistory();
    }, [user?.firmNameMatch]);

    const filteredData = statusFilter === 'All'
        ? historyData
        : historyData.filter(item => item.status === statusFilter);


    // Creating table columns
    const historyColumns: ColumnDef<HistoryData>[] = [
        {
            accessorKey: 'poNumber',
            header: 'PO Number',
            cell: ({ getValue }) => <div>{getValue() as string || '-'}</div>
        },
        {
            accessorKey: 'poCopy',
            header: 'PO Copy',
            cell: ({ row }) => {
                const attachment = row.original.poCopy;
                return attachment ? (
                    <a href={attachment} target="_blank" rel="noopener noreferrer">
                        PDF
                    </a>
                ) : (
                    <span className="text-gray-400">No PDF</span>
                );
            },
        },
        {
            accessorKey: 'vendorName',
            header: 'Vendor Name',
            cell: ({ getValue }) => <div>{getValue() as string || '-'}</div>
        },
        // { 
        //     accessorKey: 'preparedBy', 
        //     header: 'Prepared By',
        //     cell: ({ getValue }) => <div>{getValue() as string || '-'}</div>
        // },
        // { 
        //     accessorKey: 'approvedBy', 
        //     header: 'Approved By',
        //     cell: ({ getValue }) => <div>{getValue() as string || '-'}</div>
        // },
        {
            accessorKey: 'totalAmount',
            header: 'Amount',
            cell: ({ row }) => {
                return <div>&#8377;{(row.original.totalAmount || 0).toLocaleString('en-IN')}</div>;
            },
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status;
                const variant =
                    status === "Not Received" ? "secondary" :
                        status === "Received" ? "primary" :
                            "default";

                return <Pill variant={variant}>{status}</Pill>;
            }
        },
    ];

    return (
        <div>
            <Heading heading="PO History " subtext="View purchase orders ">
                <Package2 size={50} className="text-primary" />
            </Heading>

            <DataTable
                data={filteredData}
                columns={historyColumns}
                searchFields={['vendorName', 'poNumber', 'preparedBy', 'approvedBy']}
                dataLoading={dataLoading}
                className='h-[80dvh]'
                extraActions={
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Status</SelectItem>
                            <SelectItem value="Revised">Revised</SelectItem>
                            <SelectItem value="Not Received">Not Received</SelectItem>
                            <SelectItem value="Received">Received</SelectItem>
                        </SelectContent>
                    </Select>
                }
            />
        </div>
    );
};
