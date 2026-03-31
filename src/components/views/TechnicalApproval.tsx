import type { ColumnDef, Row } from '@tanstack/react-table';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../ui/dialog';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Users } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate, formatDateTime } from '@/lib/utils';
import { Input } from '../ui/input';
import { supabase, supabaseEnabled } from '@/lib/supabase';

interface RateApprovalData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    comparisonSheet: string;
    vendors: [string, string, string, string, string, string, string, string, string][];
    date: string;
    firmNameMatch?: string;
    plannedDate: string; // ✅ ADD THIS
}

interface HistoryData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    vendor: [string, string];
    date: string;
    rank: string;
}

export default () => {
    const { user } = useAuth();

    const [selectedIndent, setSelectedIndent] = useState<RateApprovalData | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<HistoryData | null>(null);
    const [tableData, setTableData] = useState<RateApprovalData[]>([]);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [dataLoading, setDataLoading] = useState(false);

    // Fetch pending three party approvals from Supabase
    const fetchPendingApprovals = async () => {
        if (!supabaseEnabled) return;

        try {
            setDataLoading(true);
            let query = supabase
                .from('indent')
                .select('*')
                .not('planned3', 'is', null)
                .is('actual3', null)
                .in('vendor_type', ['Three Party', 'Regular']);

            if (user.firmNameMatch.toLowerCase() !== 'all') {
                query = query.eq('firm_name', user.firmNameMatch);
            }

            const { data, error } = await query.order('indent_number', { ascending: false });

            if (error) throw error;

            const rows = (data ?? []) as any[];
            setTableData(
                rows.map((r): RateApprovalData => ({
                    indentNo: r.indent_number || '',
                    firmNameMatch: r.firm_name_match || '',
                    indenter: r.indenter_name || '',
                    department: r.department || '',
                    product: r.product_name || '',
                    comparisonSheet: r.comparison_sheet || '',
                    date: formatDateTime(new Date(r.timestamp)).replace(/\//g, '-'),
                    plannedDate: r.planned3 ? formatDate(new Date(r.planned3)) : 'Not Set',
                    vendors: [
                        [
                            r.vendor_name1 || '',
                            r.rate1?.toString() || '0',
                            r.payment_term1 || '',
                            r.select_rate_type1 || 'With Tax',
                            r.with_tax_or_not1 || 'Yes',
                            r.tax_value1?.toString() || '0',
                            r.quotation_no1 || '',
                            r.quotation_date1 || '',
                            r.vendor1_rank || ''
                        ],
                        [
                            r.vendor_name2 || '',
                            r.rate2?.toString() || '0',
                            r.payment_term2 || '',
                            r.select_rate_type2 || 'With Tax',
                            r.with_tax_or_not2 || 'Yes',
                            r.tax_value2?.toString() || '0',
                            r.quotation_no2 || '',
                            r.quotation_date2 || '',
                            r.vendor2_rank || ''
                        ],
                        [
                            r.vendor_name3 || '',
                            r.rate3?.toString() || '0',
                            r.payment_term3 || '',
                            r.select_rate_type3 || 'With Tax',
                            r.with_tax_or_not3 || 'Yes',
                            r.tax_value3?.toString() || '0',
                            r.quotation_no3 || '',
                            r.quotation_date3 || '',
                            r.vendor3_rank || ''
                        ],
                    ].filter(vendor => vendor[0] !== '') as [string, string, string, string, string, string, string, string, string][],
                }))
            );
        } catch (err) {
            console.error('Error fetching pending approvals:', err);
            toast.error('Failed to fetch pending approvals');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingApprovals();
    }, [user.firmNameMatch]);


    // Fetch completed three party approvals from Supabase
    const fetchCompletedApprovals = async () => {
        if (!supabaseEnabled) return;

        try {
            setDataLoading(true);
            let query = supabase
                .from('indent')
                .select('*')
                .not('planned3', 'is', null)
                .not('actual3', 'is', null)
                .in('vendor_type', ['Three Party', 'Regular']);

            if (user.firmNameMatch.toLowerCase() !== 'all') {
                query = query.eq('firm_name', user.firmNameMatch);
            }

            const { data, error } = await query.order('indent_number', { ascending: false });

            if (error) throw error;

            const rows = (data ?? []) as any[];
            setHistoryData(
                rows.map((r) => ({
                    indentNo: r.indent_number || '',
                    firmNameMatch: r.firm_name_match || '',
                    indenter: r.indenter_name || '',
                    department: r.department || '',
                    product: r.product_name || '',
                    date: formatDateTime(new Date(r.timestamp)).replace(/\//g, '-'),
                    vendor: [r.approved_vendor_name || '', r.approved_rate?.toString() || '0'],
                    rank: r.vendor_rate || '',
                }))
            );
        } catch (err) {
            console.error('Error fetching completed approvals:', err);
            toast.error('Failed to fetch completed approvals');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingApprovals();
        fetchCompletedApprovals();
    }, [user.firmNameMatch]);

    const columns: ColumnDef<RateApprovalData>[] = [
        ...(user.threePartyApprovalAction
            ? [
                {
                    header: 'Action',
                    id: 'action',
                    cell: ({ row }: { row: Row<RateApprovalData> }) => {
                        const indent = row.original;

                        return (
                            <div>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setSelectedIndent(indent);
                                        }}
                                    >
                                        Approve
                                    </Button>
                                </DialogTrigger>
                            </div>
                        );
                    },
                },
            ]
            : []),
        { accessorKey: 'date', header: 'Timestamp' },
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'firmNameMatch', header: 'Firm Name' },
        { accessorKey: 'indenter', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        { accessorKey: 'product', header: 'Product' },
        {
            accessorKey: 'plannedDate',
            header: 'Planned Date', // ✅ ADD THIS COLUMN
            cell: ({ getValue }) => {
                const plannedDate = getValue() as string;
                return (
                    <div className={`${plannedDate === 'Not Set' ? 'text-muted-foreground italic' : ''}`}>
                        {plannedDate}
                    </div>
                );
            }
        },
        {
            accessorKey: 'vendors',
            header: 'Vendors',
            cell: ({ row }) => {
                const vendors = row.original.vendors;
                return (
                    <div className="grid place-items-center">
                        <div className="flex flex-col gap-1">
                            {vendors.map((vendor, index) => (
                                <span key={index} className="rounded-full text-xs px-3 py-1 bg-accent text-accent-foreground border border-accent-foreground">
                                    {vendor[0]} - &#8377;{vendor[1]}
                                </span>
                            ))}
                        </div>
                    </div>
                );
            },
        },
    ];

    const historyColumns: ColumnDef<HistoryData>[] = [
        ...(user.updateVendorAction ? [
            {
                header: 'Action',
                cell: ({ row }: { row: Row<HistoryData> }) => {
                    const indent = row.original;

                    return (
                        <div>
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedHistory(indent);
                                    }}
                                >
                                    Update
                                </Button>
                            </DialogTrigger>
                        </div>
                    );
                },
            },
        ] : []),
        { accessorKey: 'date', header: 'Timestamp' },
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'firmNameMatch', header: ' Firm Name' },
        { accessorKey: 'indenter', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        { accessorKey: 'product', header: 'Product' },
        {
            accessorKey: 'vendor',
            header: 'Vendor',
            cell: ({ row }) => {
                const vendor = row.original.vendor;
                return (
                    <div className="grid place-items-center">
                        <div className="flex flex-col gap-1">
                            <span className="rounded-full text-xs px-3 py-1 bg-accent text-accent-foreground border border-accent-foreground">
                                {vendor[0]} - &#8377;{vendor[1]}
                                {row.original.rank && (
                                    <span className="ml-2 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                                        {row.original.rank}
                                    </span>
                                )}
                            </span>
                        </div>
                    </div>
                );
            },
        },
    ];

    const schema = z.object({
        ranks: z.record(z.string()),
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            ranks: {},
        },
    });

    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            const updates: any = {
                actual3: new Date().toISOString(),
                planned4: new Date().toISOString(),
            };

            // Map ranks back to their original vendor index logic.
            // Our vendors array has original elements [0], [1], [2] in `selectedIndent.vendors`.
            selectedIndent?.vendors.forEach((_, idx) => {
                const rankVal = values.ranks[idx.toString()] || '';
                // Assume vendor[0] was vendor1, vendor[1] was vendor2...
                if (idx === 0) updates.vendor1_rank = rankVal;
                if (idx === 1) updates.vendor2_rank = rankVal;
                if (idx === 2) updates.vendor3_rank = rankVal;
            });

            const { error } = await supabase
                .from('indent')
                .update(updates)
                .eq('indent_number', selectedIndent?.indentNo);

            if (error) throw error;

            toast.success(`Completed Technical Approval for ${selectedIndent?.indentNo}`);
            setOpenDialog(false);
            form.reset();

            // Refresh both tables
            fetchPendingApprovals();
            fetchCompletedApprovals();
        } catch (error) {
            console.error('Error approving vendor:', error);
            toast.error('Failed to update vendor');
        }
    }

    const historyUpdateSchema = z.object({
        rate: z.coerce.number(),
    })

    const historyUpdateForm = useForm<z.infer<typeof historyUpdateSchema>>({
        resolver: zodResolver(historyUpdateSchema),
        defaultValues: {
            rate: 0,
        },
    })

    useEffect(() => {
        if (selectedHistory) {
            historyUpdateForm.reset({ rate: parseInt(selectedHistory.vendor[1]) || 0 })
        }
    }, [selectedHistory, historyUpdateForm])

    async function onSubmitHistoryUpdate(values: z.infer<typeof historyUpdateSchema>) {
        try {
            const { error } = await supabase
                .from('indent')
                .update({ approved_rate: values.rate.toString() })
                .eq('indent_number', selectedHistory?.indentNo);

            if (error) throw error;

            toast.success(`Updated rate of ${selectedHistory?.indentNo}`);
            setOpenDialog(false);
            historyUpdateForm.reset({ rate: 0 });

            // Refresh history table
            fetchCompletedApprovals();
        } catch (err) {
            console.error('Error updating rate:', err);
            toast.error('Failed to update vendor');
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    return (
        <div>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending">
                    <Heading
                        heading="Technical Approval"
                        subtext="Set the technical details of the vendors"
                        tabs
                        pendingCount={tableData.length}
                        historyCount={historyData.length}
                    >
                        <Users size={50} className="text-primary" />
                    </Heading>
                    <TabsContent value="pending">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={['product', 'department', 'indenter', 'firmNameMatch']}
                            dataLoading={dataLoading}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['product', 'department', 'indenter', 'firmNameMatch']}
                            dataLoading={dataLoading}
                        />
                    </TabsContent>
                </Tabs>

                {selectedIndent && (
                    <DialogContent className="w-[95vw] md:max-w-3xl">
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="space-y-6"
                            >
                                <DialogHeader>
                                    <DialogTitle>Technical Approval</DialogTitle>
                                    <DialogDescription>
                                        Assign T1, T2, T3 ranks for vendor quotes in Indent <span className="font-bold text-foreground">{selectedIndent.indentNo}</span>
                                    </DialogDescription>
                                </DialogHeader>

                                {/* Indent Info Summary */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-md border text-sm bg-muted/20">
                                    <div>
                                        <p className="font-semibold text-muted-foreground mb-1 text-xs uppercase">Indenter</p>
                                        <p>{selectedIndent.indenter}</p>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-muted-foreground mb-1 text-xs uppercase">Department</p>
                                        <p>{selectedIndent.department}</p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <p className="font-semibold text-muted-foreground mb-1 text-xs uppercase">Product</p>
                                        <p className="truncate" title={selectedIndent.product}>{selectedIndent.product}</p>
                                    </div>
                                </div>

                                {/* Minimal Vendor Table */}
                                <div className="rounded-md border overflow-hidden text-sm">
                                    <table className="w-full text-left">
                                        <thead className="bg-muted">
                                            <tr>
                                                <th className="px-4 py-3 font-medium">Vendor</th>
                                                <th className="px-4 py-3 font-medium text-right">Effective Rate</th>
                                                <th className="px-4 py-3 font-medium text-center">Rank</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {(() => {
                                                const processedVendors = selectedIndent.vendors.map((v, i) => {
                                                    const rate = parseFloat(v[1]) || 0;
                                                    const tax = parseFloat(v[5]) || 0;
                                                    const total = v[3] === 'Basic Rate' ? rate * (1 + tax / 100) : rate;
                                                    return { vendor: v, originalIndex: i, total };
                                                }).sort((a, b) => a.total - b.total);

                                                return processedVendors.map(({ vendor, originalIndex, total }) => (
                                                    <tr key={originalIndex} className="hover:bg-muted/10 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="font-semibold text-foreground">{vendor[0]}</div>
                                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                                {vendor[6] ? `Quote: ${vendor[6]}` : ''} | {vendor[2]}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="font-bold text-primary">
                                                                &#8377;{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </div>
                                                            <div className="text-[10px] text-muted-foreground">
                                                                {vendor[3]} {vendor[3] === 'Basic Rate' ? `(+${vendor[5]}% tax)` : ''}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center w-36">
                                                            <FormField
                                                                control={form.control}
                                                                name={`ranks.${originalIndex}`}
                                                                render={({ field }) => (
                                                                    <FormItem className="space-y-0">
                                                                        <FormControl>
                                                                            <select
                                                                                {...field}
                                                                                className="w-full h-8 px-2 rounded border border-input bg-background text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                                                                                value={field.value || ''}
                                                                            >
                                                                                <option value="">None</option>
                                                                                <option value="T1">T1</option>
                                                                                <option value="T2">T2</option>
                                                                                <option value="T3">T3</option>
                                                                            </select>
                                                                        </FormControl>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                </div>

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline" type="button">Cancel</Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={form.formState.isSubmitting}>
                                        {form.formState.isSubmitting && <Loader size={16} color="white" className="mr-2" />}
                                        Save Approval
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}

                {selectedHistory && (
                    <DialogContent className="w-[95vw] md:max-w-xl">
                        <Form {...historyUpdateForm}>
                            <form onSubmit={historyUpdateForm.handleSubmit(onSubmitHistoryUpdate, onError)} className="space-y-7">
                                <DialogHeader className="space-y-1">
                                    <DialogTitle>Update Rate</DialogTitle>
                                    <DialogDescription>
                                        Update rate for{' '}
                                        <span className="font-medium">
                                            {selectedHistory.indentNo}
                                        </span>
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-3">
                                    <FormField
                                        control={historyUpdateForm.control}
                                        name="rate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Rate</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>

                                    <Button
                                        type="submit"
                                        disabled={historyUpdateForm.formState.isSubmitting}
                                    >
                                        {historyUpdateForm.formState.isSubmitting && (
                                            <Loader
                                                size={20}
                                                color="white"
                                                aria-label="Loading Spinner"
                                            />
                                        )}
                                        Update
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
};