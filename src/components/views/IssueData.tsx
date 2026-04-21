import { type ColumnDef, type Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useEffect, useState, useMemo } from 'react';
import { DownloadOutlined } from '@ant-design/icons';

import {
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Dialog,
} from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { z } from 'zod';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ClipboardCheck } from 'lucide-react';
import Heading from '../element/Heading';
import { Input } from '../ui/input';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import {
    fetchIssueRecords,
    updateIssueApproval,
    type IssueRecord
} from '@/services/issueService';

export default function IssueData() {
    const { user } = useAuth();
    const [allData, setAllData] = useState<IssueRecord[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [selectedIssue, setSelectedIssue] = useState<IssueRecord | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const fetchData = async () => {
        setDataLoading(true);
        try {
            const records = await fetchIssueRecords();
            // Filter by Project Name
            const filteredByFirm = records;
            setAllData(filteredByFirm);
        } catch (error) {
            console.error('Failed to fetch issue records:', error);
            toast.error('Failed to load data');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user.firmNameMatch]);

    const returnData = useMemo(() => {
        return allData.filter(i => i.rejected_damage_qty && i.rejected_damage_qty !== '0' && i.rejected_damage_qty !== '');
    }, [allData]);

    const pendingData = useMemo(() => {
        return allData.filter(i => 
            i.planned1 && !i.actual1 && 
            !(i.rejected_damage_qty && i.rejected_damage_qty !== '0' && i.rejected_damage_qty !== '')
        );
    }, [allData]);

    const historyData = useMemo(() => {
        return allData.filter(i => 
            i.planned1 && i.actual1 && 
            !(i.rejected_damage_qty && i.rejected_damage_qty !== '0' && i.rejected_damage_qty !== '')
        );
    }, [allData]);

    const handleDownload = (data: any[]) => {
        if (!data || data.length === 0) {
            toast.error('No data to download');
            return;
        }

        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(','),
            ...data.map((row) =>
                headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
            ),
        ];

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `issue-data-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const columns: ColumnDef<IssueRecord>[] = [
        ...(user.issueData
            ? [
                {
                    header: 'Action',
                    id: 'action',
                    cell: ({ row }: { row: Row<IssueRecord> }) => {
                        const indent = row.original;
                        return (
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedIssue(indent);
                                        setOpenDialog(true);
                                    }}
                                >
                                    Approve
                                </Button>
                            </DialogTrigger>
                        );
                    },
                },
            ]
            : []),
        { accessorKey: 'issue_no', header: 'Issue No' },
        { accessorKey: 'issue_to', header: 'Issue to' },
        { accessorKey: 'group_head', header: 'Group Head' },
        { accessorKey: 'uom', header: 'Uom' },
        { accessorKey: 'product_name', header: 'Product Name' },
        { accessorKey: 'quantity', header: 'Quantity' },
        { accessorKey: 'department', header: 'Department' },
        { accessorKey: 'location', header: 'Location' },
        { accessorKey: 'constructor_name', header: 'Contractor Name' },
        { accessorKey: 'site_location', header: 'Site Location' },
        { accessorKey: 'project_name', header: 'Project Name' },
        {
            accessorKey: 'planned1',
            header: 'Planned Date',
            cell: ({ row }) => row.original.planned1 ? formatDate(new Date(row.original.planned1)) : '-',
        },
        {
            accessorKey: 'issue_slip',
            header: 'Issue Slip',
            cell: ({ row }) => row.original.issue_slip ? (
                <a href={row.original.issue_slip} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                    View
                </a>
            ) : '-'
        },
    ];

    const historyColumns: ColumnDef<IssueRecord>[] = [
        { accessorKey: 'issue_no', header: 'Issue No' },
        { accessorKey: 'issue_to', header: 'Issue to' },
        { accessorKey: 'group_head', header: 'Group Head' },
        { accessorKey: 'uom', header: 'Uom' },
        { accessorKey: 'product_name', header: 'Product Name' },
        { accessorKey: 'quantity', header: 'Quantity' },
        { accessorKey: 'department', header: 'Department' },
        { accessorKey: 'location', header: 'Location' },
        { accessorKey: 'constructor_name', header: 'Contractor Name' },
        { accessorKey: 'site_location', header: 'Site Location' },
        { accessorKey: 'project_name', header: 'Project Name' },
        { accessorKey: 'status', header: 'Status' },
        { accessorKey: 'given_qty', header: 'Given Qty' },
        {
            accessorKey: 'planned1',
            header: 'Planned Date',
            cell: ({ row }) => row.original.planned1 ? formatDate(new Date(row.original.planned1)) : '-',
        },
        {
            accessorKey: 'actual1',
            header: 'Actual Date',
            cell: ({ row }) => (row.original.actual1 ? formatDate(new Date(row.original.actual1)) : '-'),
        },
        {
            accessorKey: 'issue_slip',
            header: 'Issue Slip',
            cell: ({ row }) => row.original.issue_slip ? (
                <a href={row.original.issue_slip} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                    View
                </a>
            ) : '-'
        },
    ];

    const returnColumns: ColumnDef<IssueRecord>[] = [
        { accessorKey: 'issue_no', header: 'Issue No' },
        { accessorKey: 'issue_to', header: 'Issue to' },
        { accessorKey: 'group_head', header: 'Group Head' },
        { accessorKey: 'product_name', header: 'Product Name' },
        { accessorKey: 'quantity', header: 'Issue Qty' },
        { accessorKey: 'rejected_damage_qty', header: 'Reject/Damage Qty' },
        { accessorKey: 'damage_remark', header: 'Damage Remark' },
        { accessorKey: 'return_person_name', header: 'Return Person' },
        { accessorKey: 'issue_person_name', header: 'Issue Person' },
        { accessorKey: 'department', header: 'Department' },
        { accessorKey: 'constructor_name', header: 'Contractor' },
        { accessorKey: 'site_location', header: 'Site' },
        { accessorKey: 'project_name', header: 'Project' },
        {
            accessorKey: 'actual1',
            header: 'Return Date',
            cell: ({ row }) => (row.original.actual1 ? formatDate(new Date(row.original.actual1)) : '-'),
        },
        {
            accessorKey: 'issue_slip',
            header: 'Issue Slip',
            cell: ({ row }) => row.original.issue_slip ? (
                <a href={row.original.issue_slip} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                    View
                </a>
            ) : '-'
        },
        {
            accessorKey: 'return_slip',
            header: 'Return Slip',
            cell: ({ row }) => row.original.return_slip ? (
                <a href={row.original.return_slip} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                    View
                </a>
            ) : '-'
        },
    ];

    const schema = z.object({
        status: z.enum(['Yes', 'No'], {
            required_error: 'Please select a status',
        }),
        givenQty: z.number().optional(),
    }).superRefine((data, ctx) => {
        if (data.status === 'Yes' && (!data.givenQty || data.givenQty <= 0)) {
            ctx.addIssue({
                path: ['givenQty'],
                code: z.ZodIssueCode.custom,
                message: 'Given quantity is required when status is Yes',
            });
        }
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: { givenQty: undefined, status: undefined },
    });

    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            if (!selectedIssue) return;

            const currentDateTime = new Date().toISOString();

            await updateIssueApproval(selectedIssue.issue_no, {
                actual1: currentDateTime,
                status: values.status,
                given_qty: values.status === 'Yes' ? values.givenQty : null,
            });

            toast.success(`Updated approval status of ${selectedIssue.issue_no}`);
            setOpenDialog(false);
            form.reset();
            setSelectedIssue(null);
            fetchData();
        } catch (err) {
            console.error('Error updating approval', err);
            toast.error('Failed to update issue');
        }
    }

    function onError(e: FieldErrors<z.infer<typeof schema>>) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    return (
        <div>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending">
                    <Heading
                        heading="Issue Data"
                        subtext="Update Issue Data"
                        tabs
                        pendingCount={pendingData.length}
                        returnCount={returnData.length}
                        historyCount={historyData.length}
                        returnValue="return"
                    >
                        <ClipboardCheck size={50} className="text-primary" />
                    </Heading>

                    <TabsContent value="pending">
                        <DataTable
                            data={pendingData}
                            columns={columns}
                            searchFields={['product_name', 'department', 'issue_no', 'issue_to', 'constructor_name', 'site_location', 'project_name']}
                            dataLoading={dataLoading}
                            extraActions={
                                <Button
                                    variant="default"
                                    onClick={() => handleDownload(pendingData)}
                                    style={{
                                        background: 'linear-gradient(90deg, #4CAF50, #2E7D32)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '0 16px',
                                        fontWeight: 'bold',
                                        boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                    }}
                                >
                                    <DownloadOutlined />
                                    {downloading ? 'Downloading...' : 'Download'}
                                </Button>
                            }
                        />
                    </TabsContent>
                    <TabsContent value="return">
                        <DataTable
                            data={returnData}
                            columns={returnColumns}
                            searchFields={['product_name', 'department', 'issue_no', 'issue_to', 'constructor_name', 'site_location', 'project_name', 'return_person_name']}
                            dataLoading={dataLoading}
                            // extraActions={
                            //     <Button
                            //         variant="default"
                            //         onClick={() => handleDownload(returnData)}
                            //         className="bg-gradient-to-r from-orange-500 to-red-600 border-none rounded-lg font-bold shadow-md flex items-center gap-2 px-4"
                            //     >
                            //         <DownloadOutlined />
                            //         Download Returns
                            //     </Button>
                            // }
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['product_name', 'department', 'issue_no', 'issue_to', 'constructor_name', 'site_location', 'project_name']}
                            dataLoading={dataLoading}
                            extraActions={
                                <Button
                                    variant="default"
                                    onClick={() => handleDownload(historyData)}
                                    className="bg-gradient-to-r from-blue-500 to-indigo-600 border-none rounded-lg font-bold shadow-md flex items-center gap-2 px-4"
                                >
                                    <DownloadOutlined />
                                    Download History
                                </Button>
                            }
                        />
                    </TabsContent>
                </Tabs>

                {selectedIssue && (
                    <DialogContent>
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="grid gap-5"
                            >
                                <DialogHeader className="grid gap-2">
                                    <DialogTitle>Approve Indent</DialogTitle>
                                    <DialogDescription>
                                        Approve indent{' '}
                                        <span className="font-medium">{selectedIssue.issue_no}</span>
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="grid gap-3">
                                    <FormField
                                        control={form.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Status</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Select approval status" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Yes">Yes</SelectItem>
                                                        <SelectItem value="No">No</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />

                                    {form.watch('status') === 'Yes' && (
                                        <FormField
                                            control={form.control}
                                            name="givenQty"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Given Quantity</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            {...field}
                                                            type="number"
                                                            onChange={(e) =>
                                                                field.onChange(Number(e.target.value))
                                                            }
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>

                                    <Button
                                        type="submit"
                                        disabled={form.formState.isSubmitting}
                                    >
                                        {form.formState.isSubmitting && (
                                            <Loader
                                                size={20}
                                                color="white"
                                                aria-label="Loading Spinner"
                                            />
                                        )}
                                        Approve
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}
