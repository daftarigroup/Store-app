import { type ColumnDef, type Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useEffect, useState, useMemo } from 'react';
import { DownloadOutlined } from "@ant-design/icons";
import { pdf } from '@react-pdf/renderer';
import IndentPdf from '../element/IndentPdf';
import { ClipLoader } from 'react-spinners';

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
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ClipboardCheck, PenSquare, CheckSquare, ListTodo, Download } from 'lucide-react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { formatDate, formatDateTimeFull } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';
import { Input } from '../ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
    fetchIndentRecords,
    updateIndentApproval,
    updateIndentSpecifications,
    updateIndentHistoryFields,
    type IndentRecord
} from '@/services/indentService';
import { supabase } from '@/lib/supabase';
import { filterByFirmAccess } from '@/lib/firmAccess';


export default function ApproveIndent() {
    const { user } = useAuth();
    const [allData, setAllData] = useState<IndentRecord[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [selectedIndent, setSelectedIndent] = useState<IndentRecord | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingRow, setEditingRow] = useState<number | null>(null);
    const [editValues, setEditValues] = useState<Partial<IndentRecord>>({});
    const [downloading, setDownloading] = useState(false);
    const [exportingIndentNo, setExportingIndentNo] = useState<string | null>(null);
    const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
    const [editedStatuses, setEditedStatuses] = useState<Record<number, string>>({});
    const [editedQuantities, setEditedQuantities] = useState<Record<number, number>>({});
    const [bulkSubmitting, setBulkSubmitting] = useState(false);

    const fetchData = async () => {
        setDataLoading(true);
        try {
            const permittedFirms = user?.firm_access || [];
            const records = await fetchIndentRecords(permittedFirms);
            
            // Secondary frontend check for absolute security/robustness
            const filtered = filterByFirmAccess(records, permittedFirms, {
                id: (i) => i.firm_id
            });
            
            setAllData(filtered);

        } catch (error) {
            console.error('Failed to fetch indent records:', error);
            toast.error('Failed to load data');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user?.firm_access]);

    const pendingData = useMemo(() => {
        return allData.filter(i => i.planned1 && !i.actual1);
    }, [allData]);

    const historyData = useMemo(() => {
        return allData.filter(i => i.planned1 && i.actual1);
    }, [allData]);

    const handleDownload = (data: any[]) => {
        if (!data || data.length === 0) {
            toast.error("No data to download");
            return;
        }

        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(","),
            ...data.map(row =>
                headers.map(h => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",")
            )
        ];
        const csvContent = csvRows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `approve-indent-data-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    async function handleExportIndentPdf(indentNo: string) {
        setExportingIndentNo(indentNo);
        try {
            let logoBase64 = '';
            try {
                const r = await fetch('/logo.png');
                if (r.ok) {
                    const blob = await r.blob();
                    logoBase64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                }
            } catch {}

            const rows = allData.filter(r => r.indent_number === indentNo);
            if (rows.length === 0) return;
            const first = rows[0];

            const blob = await pdf(
                <IndentPdf
                    indentNumber={indentNo}
                    indenterName={first.indenter_name}
                    firmName={first.firm_name}
                    indentStatus={first.indent_status as 'Critical' | 'Non-Critical'}
                    date={first.timestamp ? formatDateTimeFull(new Date(first.timestamp)) : formatDateTimeFull(new Date())}
                    products={rows.map(r => ({
                        productName: r.product_name,
                        groupHead: r.group_head ?? '',
                        quantity: r.approved_quantity ?? r.quantity,
                        uom: r.uom,
                        expectedRequirementDate: r.expected_req_date || '',
                        specifications: r.specifications || '',
                        areaOfUse: r.area_of_use || '',
                    }))}
                    logo={logoBase64 || '/logo.png'}
                /> as any
            ).toBlob();

            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            toast.success(`${indentNo} PDF opened`);
        } catch (err) {
            console.error(err);
            toast.error('Failed to generate PDF');
        } finally {
            setExportingIndentNo(null);
        }
    }

    const handleEditClick = (row: IndentRecord) => {
        setEditingRow(row.id);
        setEditValues({
            approved_quantity: row.approved_quantity,
            uom: row.uom,
            vendor_type: row.vendor_type,
        });
    };

    const handleCancelEdit = () => {
        setEditingRow(null);
        setEditValues({});
    };

    const handleSaveEdit = async (id: number) => {
        try {
            const approvedQty = Number(editValues.approved_quantity);
            await updateIndentHistoryFields(id, {
                approved_quantity: approvedQty,
                uom: editValues.uom,
                vendor_type: editValues.vendor_type,
            });

            toast.success(`Updated record ID ${id}`);
            setEditingRow(null);
            setEditValues({});
            fetchData();

        } catch (err) {
            console.error('Error updating indent:', err);
            toast.error('Failed to update indent');
        }
    };

    const handleInputChange = (field: keyof IndentRecord, value: any) => {
        setEditValues(prev => ({ ...prev, [field]: value }));
    };

    const handleSpecificationUpdate = async (id: number, value: string) => {
        try {
            await updateIndentSpecifications(id, value);
            toast.success(`Updated specifications for ID ${id}`);
            fetchData();
        } catch (err) {
            console.error('Error updating specifications:', err);
            toast.error('Failed to update specifications');
        }
    };

    const columns = useMemo<ColumnDef<IndentRecord>[]>(() => [
        ...(user?.indentApprovalAction
            ? [
                {
                    id: 'select',
                    header: ({ table }: { table: any }) => (
                        <Checkbox
                            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
                            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                            aria-label="Select all"
                        />
                    ),
                    cell: ({ row }: { row: any }) => (
                        <Checkbox
                            checked={row.getIsSelected()}
                            onCheckedChange={(value) => row.toggleSelected(!!value)}
                            aria-label="Select row"
                        />
                    ),
                    enableSorting: false,
                    enableHiding: false,
                },
                {
                    header: 'Action',
                    id: 'action',
                    cell: ({ row, table }: { row: Row<IndentRecord>, table: any }) => {
                        const id = row.original.id;
                        const status = table.options.meta?.editedStatuses[id] ?? 'Regular';

                        return (
                            <div className="flex items-center gap-2">
                                <Select
                                    value={status}
                                    onValueChange={(val) => table.options.meta?.updateStatus(id, val)}
                                >
                                    <SelectTrigger className="w-[100px] h-8 text-xs">
                                        <SelectValue placeholder="Action" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Regular">Accept</SelectItem>
                                        <SelectItem value="Reject">Reject</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                        setSelectedIndent(row.original);
                                        setOpenDialog(true);
                                    }}
                                >
                                    <ListTodo className="h-4 w-4" />
                                </Button>
                            </div>
                        );
                    },
                },
            ]
            : []),
        { accessorKey: 'indent_number', header: 'Indent No.' },
        {
            accessorKey: 'product_name',
            header: 'Product',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'quantity',
            header: 'Req Qty',
        },
        ...(user?.indentApprovalAction
            ? [
                {
                    header: 'Approve Qty',
                    id: 'approve_qty',
                    cell: ({ row, table }: { row: Row<IndentRecord>, table: any }) => {
                        const id = row.original.id;
                        const qty = table.options.meta?.editedQuantities[id] ?? row.original.quantity;
                        return (
                            <div className="flex items-center gap-1">
                                <Input
                                    type="number"
                                    className="w-20 h-8"
                                    value={qty}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        table.options.meta?.updateQuantity(id, val === '' ? 0 : Number(val));
                                    }}
                                />
                                <span className="text-[10px] text-muted-foreground">{row.original.uom}</span>
                            </div>
                        );
                    },
                }
            ]
            : [
                { accessorKey: 'uom', header: 'UOM' }
            ]),
        { accessorKey: 'firm_name', header: 'Project Name' },
        { accessorKey: 'indenter_name', header: 'Indenter' },

        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ row, getValue }) => {
                const [value, setValue] = useState(getValue() as string);
                const [isEditing, setIsEditing] = useState(false);
                const id = row.original.id;

                const handleBlur = async () => {
                    setIsEditing(false);
                    if (value !== getValue()) {
                        await handleSpecificationUpdate(id, value);
                    }
                };

                return (
                    <div className="max-w-[150px]">
                        {isEditing ? (
                            <Input
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                onBlur={handleBlur}
                                autoFocus
                                className="border-1 focus:border-2"
                            />
                        ) : (
                            <div
                                className="break-words whitespace-normal cursor-pointer p-2 hover:bg-gray-50 rounded"
                                onClick={() => setIsEditing(true)}
                                tabIndex={0}
                            >
                                {value || 'Click to edit...'}
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'vendor_type',
            header: 'Vendor Type',
            cell: ({ row }: { row: Row<IndentRecord> }) => {
                const status = row.original.vendor_type;
                return (
                    <Pill
                        variant={
                            status === 'Reject'
                                ? 'reject'
                                : status === 'Regular'
                                    ? 'primary'
                                    : 'secondary'
                        }
                    >
                        {status}
                    </Pill>
                );
            },
        },
        {
            accessorKey: 'indent_status',
            header: 'Priority',
            cell: ({ row }: { row: Row<IndentRecord> }) => {
                const status = row.original.indent_status;
                return (
                    <Pill variant={status === 'Critical' ? 'reject' : 'secondary'}>
                        {status}
                    </Pill>
                );
            },
        },
        {
            accessorKey: 'no_day',
            header: 'Days',
            cell: ({ getValue }) => (
                <div className="text-center">
                    {getValue() as number}
                </div>
            ),
        },
        {
            accessorKey: 'attachment',
            header: 'Attachment',
            cell: ({ row }: { row: Row<IndentRecord> }) => {
                const attachment = row.original.attachment;
                return attachment ? (
                    <a href={attachment} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline whitespace-nowrap flex items-center gap-1">
                        <DownloadOutlined className="text-[10px]" /> User File
                    </a>
                ) : <span className="text-muted-foreground text-[10px]">None</span>;
            },
        },
        {
            accessorKey: 'indent_url',
            header: 'PDF',
            cell: ({ row }: { row: Row<IndentRecord> }) => {
                const indentUrl = row.original.indent_url;
                return indentUrl ? (
                    <a href={indentUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-medium hover:underline whitespace-nowrap flex items-center gap-1">
                        <DownloadOutlined className="text-[10px]" /> Indent PDF
                    </a>
                ) : <span className="text-muted-foreground text-[10px]">None</span>;
            },
        },
        {
            accessorKey: 'timestamp',
            header: 'Date',
            cell: ({ row }) => row.original.timestamp ? formatDate(new Date(row.original.timestamp)) : '-',
        },
        {
            accessorKey: 'planned1',
            header: 'Planned Date',
            cell: ({ row }) => row.original.planned1 ? formatDate(new Date(row.original.planned1)) : '-',
        },
        {
            id: 'export_pdf',
            header: 'PDF',
            cell: ({ row, table }: { row: Row<IndentRecord>, table: any }) => {
                const indentNo = row.original.indent_number;
                const isLoading = table.options.meta?.exportingIndentNo === indentNo;
                return (
                    <Button
                        size="sm"
                        variant="ghost"
                        disabled={isLoading}
                        onClick={() => table.options.meta?.onExportPdf(indentNo)}
                        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 h-7 px-2 text-xs"
                    >
                        {isLoading ? <ClipLoader size={11} color="currentColor" /> : <Download size={11} />}
                        View PDF
                    </Button>
                );
            },
        },
    ], [user?.indentApprovalAction]);

    const historyColumns = useMemo<ColumnDef<IndentRecord>[]>(() => [
        { accessorKey: 'indent_number', header: 'Indent No.' },
        { accessorKey: 'firm_name', header: 'Project Name' },
        { accessorKey: 'indenter_name', header: 'Indenter' },

        {
            accessorKey: 'product_name',
            header: 'Product',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'approved_quantity',
            header: 'Quantity',
            cell: ({ row, table }: { row: any, table: any }) => {
                const id = row.original.id;
                const isEditing = table.options.meta?.editingRow === id;
                const val = table.options.meta?.editValues?.approved_quantity ?? row.original.approved_quantity;
                return isEditing ? (
                    <Input
                        type="number"
                        value={val}
                        onChange={(e) => table.options.meta?.onInputChange('approved_quantity', Number(e.target.value))}
                        className="w-20"
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        {row.original.approved_quantity}
                        {user.indentApprovalAction && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4"
                                onClick={() => handleEditClick(row.original)}
                            >
                                <PenSquare className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
            cell: ({ row, table }: { row: any, table: any }) => {
                const id = row.original.id;
                const isEditing = table.options.meta?.editingRow === id;
                const val = table.options.meta?.editValues?.uom ?? row.original.uom;
                return isEditing ? (
                    <Input
                        value={val}
                        onChange={(e) => table.options.meta?.onInputChange('uom', e.target.value)}
                        className="w-20"
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        {row.original.uom}
                        {user.indentApprovalAction && !isEditing && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4"
                                onClick={() => handleEditClick(row.original)}
                            >
                                <PenSquare className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'indent_status',
            header: 'Priority',
            cell: ({ row }: { row: Row<IndentRecord> }) => {
                const status = row.original.indent_status;
                return (
                    <Pill variant={status === 'Critical' ? 'reject' : 'secondary'}>
                        {status}
                    </Pill>
                );
            },
        },
        {
            accessorKey: 'no_day',
            header: 'Days',
            cell: ({ getValue }) => (
                <div className="text-center">
                    {getValue() as number}
                </div>
            ),
        },
        {
            accessorKey: 'attachment',
            header: 'Attachment',
            cell: ({ row }: { row: Row<IndentRecord> }) => {
                const attachment = row.original.attachment;
                return attachment ? (
                    <a href={attachment} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline whitespace-nowrap flex items-center gap-1">
                        <DownloadOutlined className="text-[10px]" /> User File
                    </a>
                ) : <span className="text-muted-foreground text-[10px]">None</span>;
            },
        },
        {
            accessorKey: 'timestamp',
            header: 'Request Date',
            cell: ({ row }) => row.original.timestamp ? formatDate(new Date(row.original.timestamp)) : '-',
        },
        {
            accessorKey: 'actual1',
            header: 'Approval Date',
            cell: ({ row }) => row.original.actual1 ? formatDate(new Date(row.original.actual1)) : '-',
        },
        {
            accessorKey: 'planned1',
            header: 'Planned Date',
            cell: ({ row }) => row.original.planned1 ? formatDate(new Date(row.original.planned1)) : '-',
        },
        {
            id: 'export_pdf',
            header: 'PDF',
            cell: ({ row, table }: { row: Row<IndentRecord>, table: any }) => {
                const indentNo = row.original.indent_number;
                const isLoading = table.options.meta?.exportingIndentNo === indentNo;
                return (
                    <Button
                        size="sm"
                        variant="ghost"
                        disabled={isLoading}
                        onClick={() => table.options.meta?.onExportPdf(indentNo)}
                        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 h-7 px-2 text-xs"
                    >
                        {isLoading ? <ClipLoader size={11} color="currentColor" /> : <Download size={11} />}
                        View PDF
                    </Button>
                );
            },
        },
        ...(user.indentApprovalAction
            ? [
                {
                    id: 'editActions',
                    cell: ({ row, table }: { row: Row<IndentRecord>, table: any }) => {
                        const id = row.original.id;
                        const isEditing = table.options.meta?.editingRow === id;
                        return isEditing ? (
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => handleSaveEdit(id)}
                                >
                                    Save
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                >
                                    Cancel
                                </Button>
                            </div>
                        ) : null;
                    },
                },
            ]
            : []),
    ], [user?.indentApprovalAction, handleEditClick, handleSaveEdit, handleCancelEdit]);

    const schema = z.object({
        approval: z.enum(['Reject', 'Three Party', 'Regular'], {
            required_error: "Please select an approval status",
        }),
        approvedQuantity: z.coerce.number().optional(),
    }).superRefine((data, ctx) => {
        if (data.approval !== 'Reject') {
            if (!data.approvedQuantity || data.approvedQuantity <= 0) {
                ctx.addIssue({
                    path: ['approvedQuantity'],
                    code: z.ZodIssueCode.custom,
                    message: "Approved quantity must be greater than 0",
                });
            }

            if (data.approvedQuantity && selectedIndent && data.approvedQuantity > selectedIndent.quantity) {
                ctx.addIssue({
                    path: ['approvedQuantity'],
                    code: z.ZodIssueCode.custom,
                    message: `Approved quantity cannot exceed requested quantity (${selectedIndent.quantity})`,
                });
            }
        }
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: { approvedQuantity: undefined, approval: 'Regular' },
    });

    useEffect(() => {
        if (selectedIndent) {
            form.setValue("approvedQuantity", selectedIndent.quantity);
            form.setValue("approval", 'Regular');
        }
    }, [selectedIndent, form]);

    const handleReject = async () => {
        if (!selectedIndent) return;
        try {
            await updateIndentApproval(selectedIndent.id, {
                actual1: new Date().toISOString(),
                vendor_type: 'Reject',
                approved_quantity: 0,
            });
            toast.success(`Rejected indent item from ${selectedIndent.indent_number}`);
            setOpenDialog(false);
            setSelectedIndent(null);
            fetchData();
            // PDF update in background — rejections don't need a PDF but keep for consistency
        } catch (err) {
            console.error('Error rejecting indent:', err);
            toast.error('Failed to reject indent');
        }
    };

    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            if (!selectedIndent) return;

            const currentDateTime = new Date().toISOString();
            const approvedQty = values.approvedQuantity ?? selectedIndent.quantity;

            await updateIndentApproval(selectedIndent.id, {
                actual1: currentDateTime,
                vendor_type: values.approval,
                approved_quantity: approvedQty,
                status: values.approval === 'Reject' ? 'Rejected' : 'Completed',
                ...(values.approval !== 'Reject' && { planned2: currentDateTime }),
            });

            // Show success immediately — PDF generates in the background
            toast.success(`Updated approval status of ${selectedIndent.indent_number}`);
            setOpenDialog(false);
            form.reset();
            const indentNumber = selectedIndent.indent_number;
            setSelectedIndent(null);
            fetchData();

        } catch (err) {
            console.error('Error approving indent:', err);
            toast.error('Failed to approve indent');
        }
    }

    const handleBulkSubmit = async () => {
        const selectedIds = Object.keys(rowSelection).filter(id => rowSelection[id]);
        if (selectedIds.length === 0) {
            toast.error("Please select items first");
            return;
        }

        const selectedIndents = pendingData.filter(i => selectedIds.includes(String(i.id)));

        // Validate quantities before any DB calls
        for (const indent of selectedIndents) {
            const qtyToApprove = editedQuantities[indent.id] ?? indent.quantity;
            const status = editedStatuses[indent.id] ?? 'Regular';
            if (status !== 'Reject' && qtyToApprove > indent.quantity) {
                toast.error(`Indent ${indent.indent_number}: Approved qty (${qtyToApprove}) exceeds requested (${indent.quantity})`);
                return;
            }
        }

        setBulkSubmitting(true);
        try {
            const currentDateTime = new Date().toISOString();

            // All DB updates in parallel
            await Promise.all(selectedIndents.map(indent => {
                const qtyToApprove = editedQuantities[indent.id] ?? indent.quantity;
                const status = editedStatuses[indent.id] ?? 'Regular';
                return updateIndentApproval(indent.id, {
                    actual1: currentDateTime,
                    vendor_type: status,
                    approved_quantity: status === 'Reject' ? 0 : qtyToApprove,
                    status: status === 'Reject' ? 'Rejected' : 'Completed',
                    ...(status !== 'Reject' && { planned2: currentDateTime }),
                });
            }));

            // Show success immediately
            toast.success(`Successfully processed ${selectedIds.length} items`);
            setRowSelection({});
            setEditedStatuses({});
            setEditedQuantities({});
            fetchData();

            // PDF regeneration in background for approved indents
            const overrideQtyMap: Record<number, number> = {};
            selectedIndents.forEach(i => { overrideQtyMap[i.id] = editedQuantities[i.id] ?? i.quantity; });

            const uniqueIndentNumbers = Array.from(new Set(selectedIndents.map(i => i.indent_number)));
            uniqueIndentNumbers.forEach(indentNo => {
                const someApproved = selectedIndents.some(i =>
                    i.indent_number === indentNo && (editedStatuses[i.id] ?? 'Regular') !== 'Reject'
                );
            });
        } catch (err) {
            console.error('Error in bulk approval:', err);
            toast.error('Failed to process some items');
        } finally {
            setBulkSubmitting(false);
        }
    };

    function onError(e: FieldErrors<z.infer<typeof schema>>) {
        console.error(e);
        toast.error('Please fill all required fields');
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <Tabs defaultValue="pending" className="w-full">
                <Heading
                    heading="Indent Approval"
                    subtext="Update Indent status to Approve or Reject them"
                    tabs
                    pendingCount={pendingData.length}
                    historyCount={historyData.length}
                >
                    <CheckSquare size={50} className="text-primary" />
                </Heading>

                <TabsContent value="pending" className="m-0 border-none p-0">
                    <DataTable
                        data={pendingData}
                        columns={columns}
                        searchFields={['product_name', 'indenter_name', 'vendor_type', 'firm_name']}
                        dataLoading={dataLoading}
                        rowSelection={rowSelection}
                        onRowSelectionChange={setRowSelection}
                        getRowId={(row) => String(row.id)}
                        meta={{
                            editedStatuses,
                            editedQuantities,
                            updateStatus: (id: number, val: string) => setEditedStatuses(prev => ({ ...prev, [id]: val })),
                            updateQuantity: (id: number, val: number) => setEditedQuantities(prev => ({ ...prev, [id]: val })),
                            exportingIndentNo,
                            onExportPdf: handleExportIndentPdf,
                        }}
                        extraActions={
                            <div className="flex items-center gap-3">
                                {user?.indentApprovalAction && Object.keys(rowSelection).length > 0 && (
                                    <div className="flex items-center gap-2 border-r pr-4 mr-2 bg-muted p-1 rounded-md">
                                        <span className="text-sm font-medium whitespace-nowrap">Selected: {Object.keys(rowSelection).length}</span>
                                        <Button
                                            onClick={handleBulkSubmit}
                                            disabled={bulkSubmitting}
                                            size="sm"
                                            className="h-9"
                                        >
                                            {bulkSubmitting ? "Processing..." : "Submit All Selected"}
                                        </Button>
                                    </div>
                                )}
                                <Button
                                    variant="default"
                                    onClick={() => handleDownload(pendingData)}
                                    className="h-9 font-bold flex items-center gap-2 px-4 rounded-md shadow-md"
                                    style={{
                                        background: "linear-gradient(90deg, #4CAF50, #2E7D32)",
                                        border: "none",
                                    }}
                                >
                                    <DownloadOutlined />
                                    {downloading ? "Downloading..." : "Download"}
                                </Button>
                            </div>
                        }
                    />
                </TabsContent>
                <TabsContent value="history" className="m-0 border-none p-0">
                    <DataTable
                        data={historyData}
                        columns={historyColumns}
                        searchFields={['product_name', 'indenter_name', 'vendor_type', 'firm_name']}
                        dataLoading={dataLoading}
                        meta={{
                            editingRow,
                            editValues,
                            onInputChange: handleInputChange,
                            exportingIndentNo,
                            onExportPdf: handleExportIndentPdf,
                        }}
                    />
                </TabsContent>
            </Tabs>

            <Sheet open={openDialog} onOpenChange={setOpenDialog}>
                {selectedIndent ? (() => {
                    const indent = selectedIndent;
                    return (
                        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
                            <SheetHeader className="pb-4">
                                <SheetTitle>Approve Indent</SheetTitle>
                                <SheetDescription>
                                    Update status and quantity for indent{' '}
                                    <span className="font-semibold text-primary">
                                        {indent.indent_number}
                                    </span>
                                </SheetDescription>
                            </SheetHeader>

                            <div className="py-4 border-y my-4 space-y-4">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="text-muted-foreground font-medium">Product:</div>
                                    <div className="font-semibold">{indent.product_name}</div>
                                    <div className="text-muted-foreground font-medium">Requested Qty:</div>
                                    <div className="font-semibold">{indent.quantity} {indent.uom}</div>
                                    <div className="text-muted-foreground font-medium">Indenter:</div>
                                    <div className="font-semibold">{indent.indenter_name}</div>
                                </div>
                            </div>

                            <Form {...form}>
                                <form
                                    onSubmit={form.handleSubmit(onSubmit, onError)}
                                    className="space-y-6 pt-4"
                                >
                                    <FormField
                                        control={form.control}
                                        name="approval"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Action</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    defaultValue={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select action" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Regular">Accept</SelectItem>
                                                        <SelectItem value="Reject">Reject</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="approvedQuantity"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Approved Quantity</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input {...field} type="number" className="pr-12" />
                                                        <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-medium">
                                                            {indent.uom}
                                                        </span>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="flex flex-col gap-3 pt-6">
                                        <Button
                                            type="submit"
                                            className="w-full h-11"
                                            disabled={form.formState.isSubmitting}
                                        >
                                            {form.formState.isSubmitting ? (
                                                <Loader size={20} color="white" />
                                            ) : (
                                                "Confirm Approval"
                                            )}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setOpenDialog(false)}
                                            className="w-full h-11"
                                        >
                                            Cancel
                                        </Button>

                                        <div className="pt-4 border-t mt-4">
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                onClick={handleReject}
                                                className="w-full bg-red-50/50 text-red-600 border-red-200 hover:bg-red-600 hover:text-white transition-colors"
                                            >
                                                Reject Indent Completely
                                            </Button>
                                        </div>
                                    </div>
                                </form>
                            </Form>
                        </SheetContent>
                    );
                })() : null}
            </Sheet>
        </div>
    );
}
