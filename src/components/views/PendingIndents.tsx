import { ListTodo } from 'lucide-react';
import Heading from '../element/Heading';
import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { formatDate } from '@/lib/utils';
import DataTable from '../element/DataTable';
import { useAuth } from '@/context/AuthContext';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Pill } from '../ui/pill';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
    DialogHeader,
    DialogFooter,
    DialogClose,
} from '../ui/dialog';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { supabase, supabaseEnabled } from '@/lib/supabase';

interface PendingIndentsData {
    date: string;
    indentNo: string;
    product: string;
    quantity: number;
    rate: number;
    withTaxOrNot: string;
    uom: string;
    vendorName: string;
    paymentTerm: string;
    specifications: string;
    firmNameMatch: string;
    plannedDate: string;
}

interface HistoryIndentsData {
    date: string;
    indentNo: string;
    product: string;
    quantity: number;
    rate: number;
    withTaxOrNot: string;
    uom: string;
    vendorName: string;
    paymentTerm: string;
    specifications: string;
    firmNameMatch: string;
    poRequired: string;
    poRequiredStatus: 'Yes' | 'No';
    plannedDate: string;
}

export default () => {
    const { user } = useAuth();

    const [pendingTableData, setPendingTableData] = useState<PendingIndentsData[]>([]);
    const [historyTableData, setHistoryTableData] = useState<HistoryIndentsData[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedIndent, setSelectedIndent] = useState<PendingIndentsData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [dataLoading, setDataLoading] = useState(false);

    // Fetch pending PO decisions from Supabase
    const fetchPendingPoDecisions = async () => {
        if (!supabaseEnabled) return;
        
        try {
            setDataLoading(true);
            let query = supabase
                .from('indent')
                .select('*')
                .eq('status', 'Pending')
                .not('approved_vendor_name', 'is', null)
                .neq('approved_vendor_name', '')
                .or('po_requred.is.null,po_requred.eq.');

            if (user.firmNameMatch.toLowerCase() !== 'all') {
                query = query.eq('firm_name', user.firmNameMatch);
            }

            const { data, error } = await query.order('indent_number', { ascending: false });

            if (error) throw error;

            const rows = (data ?? []) as any[];
            setPendingTableData(
                rows.map((r) => ({
                    date: formatDate(new Date(r.timestamp)),
                    indentNo: r.indent_number || '',
                    firmNameMatch: r.firm_name_match || '',
                    product: r.product_name || '',
                    quantity: r.pending_po_qty || 0,
                    rate: r.approved_rate || 0,
                    withTaxOrNot: r.with_tax_or_not1 || 'Yes',
                    uom: r.uom || '',
                    vendorName: r.approved_vendor_name || '',
                    paymentTerm: r.approved_payment_term || '',
                    specifications: r.specifications || '',
                    plannedDate: r.planned4 || '',
                }))
            );
        } catch (err) {
            console.error('Error fetching pending PO decisions:', err);
            toast.error('Failed to fetch pending PO decisions');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingPoDecisions();
    }, [user.firmNameMatch]);

    // Fetch PO decision history from Supabase
    const fetchPoDecisionHistory = async () => {
        if (!supabaseEnabled) return;
        
        try {
            setDataLoading(true);
            let query = supabase
                .from('indent')
                .select('*')
                .not('po_requred', 'is', null)
                .neq('po_requred', '')
                .in('po_requred', ['Yes', 'No']);

            if (user.firmNameMatch.toLowerCase() !== 'all') {
                query = query.eq('firm_name', user.firmNameMatch);
            }

            const { data, error } = await query.order('indent_number', { ascending: false });

            if (error) throw error;

            const rows = (data ?? []) as any[];
            setHistoryTableData(
                rows.map((r) => ({
                    date: formatDate(new Date(r.timestamp)),
                    indentNo: r.indent_number || '',
                    firmNameMatch: r.firm_name_match || '',
                    product: r.product_name || '',
                    quantity: r.pending_po_qty || r.quantity || 0,
                    rate: r.approved_rate || r.rate1 || 0,
                    withTaxOrNot: r.with_tax_or_not1 || 'Yes',
                    uom: r.uom || '',
                    vendorName: r.approved_vendor_name || r.vendor_name1 || '',
                    paymentTerm: r.approved_payment_term || r.payment_term1 || '',
                    specifications: r.specifications || '',
                    poRequired: r.po_requred || '',
                    poRequiredStatus: (r.po_requred?.toString().trim() || 'No') as 'Yes' | 'No',
                    plannedDate: r.planned4 || '',
                }))
            );
        } catch (err) {
            console.error('Error fetching PO decision history:', err);
            toast.error('Failed to fetch PO decision history');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingPoDecisions();
        fetchPoDecisionHistory();
    }, [user.firmNameMatch]);

    const handlePoRequired = async (response: 'Yes' | 'No') => {
        if (!selectedIndent) return;

        setIsSubmitting(true);

        try {
            const updates: any = {
                po_requred: response,
            };

            // If PO is required, set planned4 for the next workflow stage
            if (response === 'Yes') {
                updates.planned4 = new Date().toISOString();
            }

            const { error } = await supabase
                .from('indent')
                .update(updates)
                .eq('indent_number', selectedIndent.indentNo);

            if (error) throw error;

            toast.success(`PO Required status updated to ${response}`);
            setOpenDialog(false);
            setSelectedIndent(null);
            
            // Refresh both tables
            fetchPendingPoDecisions();
            fetchPoDecisionHistory();
        } catch (error) {
            console.error('Error updating PO Required:', error);
            toast.error('Failed to update PO Required status');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Creating pending table columns
    const pendingColumns: ColumnDef<PendingIndentsData>[] = [
        {
            header: 'Action',
            cell: ({ row }: { row: any }) => {
                const indent = row.original;
                return (
                    <div>
                        <DialogTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setSelectedIndent(indent);
                                    setOpenDialog(true);
                                }}
                            >
                                PO Required
                            </Button>
                        </DialogTrigger>
                    </div>
                );
            },
        },
        {
            accessorKey: 'date',
            header: 'Date',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'plannedDate',
            header: 'Planned Date',
            cell: ({ getValue }) => {
                const plannedDate = getValue() as string;
                return (
                    <div className="px-2">
                        {plannedDate ? formatDate(new Date(plannedDate)) : '-'}
                    </div>
                );
            }
        },
        {
            accessorKey: 'indentNo',
            header: 'Indent Number',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'firmNameMatch',
            header: 'Project Name',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ getValue }) => (
                <div className="max-w-[120px] break-words whitespace-normal px-1 text-sm">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'quantity',
            header: 'Pending PO Qty',
            cell: ({ getValue }) => <div className="px-2">{getValue() as number}</div>
        },
        {
            accessorKey: 'rate',
            header: 'Rate',
            cell: ({ row }) => (
                <div className="px-2">
                    &#8377;{row.original.rate}
                </div>
            ),
        },
        {
            accessorKey: 'withTaxOrNot',
            header: 'With Tax or Not',
            cell: ({ getValue }) => {
                const value = getValue() as string;
                return (
                    <div className="px-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            value === 'Yes' 
                                ? 'bg-green-100 text-green-800 border border-green-200' 
                                : 'bg-orange-100 text-orange-800 border border-orange-200'
                        }`}>
                            {value}
                        </span>
                    </div>
                );
            },
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'vendorName',
            header: 'Vendor Name',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'paymentTerm',
            header: 'Payment Term',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal px-2 text-sm">
                    {getValue() as string}
                </div>
            ),
        },
    ];

    // Creating history table columns
    const historyColumns: ColumnDef<HistoryIndentsData>[] = [
        {
            accessorKey: 'date',
            header: 'Date',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'plannedDate',
            header: 'Planned Date',
            cell: ({ getValue }) => {
                const plannedDate = getValue() as string;
                return (
                    <div className="px-2">
                        {plannedDate ? formatDate(new Date(plannedDate)) : '-'}
                    </div>
                );
            }
        },
        {
            accessorKey: 'indentNo',
            header: 'Indent Number',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'firmNameMatch',
            header: 'Project Name',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ getValue }) => (
                <div className="max-w-[120px] break-words whitespace-normal px-1 text-sm">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'quantity',
            header: 'Pending PO Qty',
            cell: ({ getValue }) => <div className="px-2">{getValue() as number}</div>
        },
        {
            accessorKey: 'rate',
            header: 'Rate',
            cell: ({ row }) => (
                <div className="px-2">
                    &#8377;{row.original.rate}
                </div>
            ),
        },
        {
            accessorKey: 'withTaxOrNot',
            header: 'With Tax or Not',
            cell: ({ getValue }) => {
                const value = getValue() as string;
                return (
                    <div className="px-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            value === 'Yes' 
                                ? 'bg-green-100 text-green-800 border border-green-200' 
                                : 'bg-orange-100 text-orange-800 border border-orange-200'
                        }`}>
                            {value}
                        </span>
                    </div>
                );
            },
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'vendorName',
            header: 'Vendor Name',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'paymentTerm',
            header: 'Payment Term',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal px-2 text-sm">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'poRequiredStatus',
            header: 'PO Required',
            cell: ({ row }) => {
                const status = row.original.poRequiredStatus;
                
                if (status === 'No') {
                    return (
                        <div className="px-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                {status}
                            </span>
                        </div>
                    );
                } else {
                    return (
                        <div className="px-2">
                            <Pill variant="primary">{status}</Pill>
                        </div>
                    );
                }
            },
        },
    ];

    return (
        <div>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending">
                    <Heading
                        heading="Pending POs"
                        subtext="View pending purchase orders and history"
                        tabs
                        pendingCount={pendingTableData.length}
                        historyCount={historyTableData.length}
                    >
                        <ListTodo size={50} className="text-primary" />
                    </Heading>
                    
                    <TabsContent value="pending">
                        <DataTable
                            data={pendingTableData}
                            columns={pendingColumns}
                            searchFields={['product', 'vendorName', 'paymentTerm', 'specifications','firmNameMatch']}
                            dataLoading={dataLoading}
                            className="h-[80dvh]"
                        />
                    </TabsContent>

                    <TabsContent value="history">
                        <DataTable
                            data={historyTableData}
                            columns={historyColumns}
                            searchFields={['product', 'vendorName', 'paymentTerm', 'specifications','firmNameMatch']}
                            dataLoading={dataLoading}
                            className="h-[80dvh]"
                        />
                    </TabsContent>
                </Tabs>

                {selectedIndent && (
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>PO Required Confirmation</DialogTitle>
                            <DialogDescription>
                                Please confirm PO requirement for this indent
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-3 bg-muted py-3 px-4 rounded-md">
                            <div className="space-y-1">
                                <p className="font-medium text-sm">Indent Number</p>
                                <p className="text-sm font-light">{selectedIndent.indentNo}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="font-medium text-sm">Project Name</p>
                                <p className="text-sm font-light">{selectedIndent.firmNameMatch}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="font-medium text-sm">Vendor Name</p>
                                <p className="text-sm font-light">{selectedIndent.vendorName}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="font-medium text-sm">Product</p>
                                <p className="text-sm font-light">{selectedIndent.product}</p>
                            </div>
                        </div>

                        <DialogFooter className="gap-2">
                            <DialogClose asChild>
                                <Button variant="outline" disabled={isSubmitting}>
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button 
                                variant="destructive"
                                onClick={() => handlePoRequired('No')}
                                disabled={isSubmitting}
                            >
                                {isSubmitting && <Loader size={16} color="white" className="mr-2" />}
                                No
                            </Button>
                            <Button 
                                variant="default"
                                onClick={() => handlePoRequired('Yes')}
                                disabled={isSubmitting}
                            >
                                {isSubmitting && <Loader size={16} color="white" className="mr-2" />}
                                Yes
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
};
