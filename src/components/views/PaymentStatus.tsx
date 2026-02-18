import { Package2, FileText, Building, DollarSign, Calendar, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import type { ColumnDef, Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useAuth } from '@/context/AuthContext';
import { useSheets } from '@/context/SheetsContext';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { uploadFile } from '@/lib/fetchers';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';

// ✅ UPDATED INTERFACE
interface PIPendingData {
    rowIndex: number;
    timestamp: string;
    partyName: string;
    poNumber: string;
    internalCode: string;
    product: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    gstPercent: number;
    discountPercent: number;
    amount: number;
    totalPoAmount: number;
    deliveryDate: string;
    paymentTerms: string;
    numberOfDays: string | number;
    firmNameMatch: string;
    totalPaidAmount: number;
    outstandingAmount: number;
    status: string;
    pdf?: string;
}

interface POMasterRecord {
    rowIndex?: number;
    timestamp?: string;
    partyName?: string;
    poNumber?: string;
    internalCode?: string;
    product?: string;
    description?: string;
    quantity?: string | number;
    unit?: string;
    rate?: string | number;
    gstPercent?: string | number;
    discountPercent?: string | number;
    amount?: string | number;
    totalPoAmount?: string | number;
    deliveryDate?: string;
    paymentTerms?: string;
    numberOfDays?: string | number;
    firmNameMatch?: string;
    totalPaidAmount?: string | number;
    outstandingAmount?: string | number;
    status?: string;
    pdf?: string;
}

export default function PIApprovals() {
    const { poMasterSheet, paymentsSheet, storeInSheet, updateAll, allLoading: poMasterLoading } = useSheets();
    const { user } = useAuth();
    const [pendingData, setPendingData] = useState<PIPendingData[]>([]);
    const [selectedItem, setSelectedItem] = useState<PIPendingData | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);

    const [stats, setStats] = useState({
        total: 0,
        totalAmount: 0,
        pendingCount: 0
    });



    useEffect(() => {
        try {
            // ✅ Use data from useSheets context
            const safePoMasterSheet: any[] = Array.isArray(poMasterSheet) ? poMasterSheet : [];
            const safePaymentsSheet: any[] = Array.isArray(paymentsSheet) ? paymentsSheet : [];
            const safeStoreInSheet: any[] = Array.isArray(storeInSheet) ? storeInSheet : [];

            // 1. Identify received PO numbers from store_in
            const receivedPoNumbersSet = new Set(
                safeStoreInSheet
                    .filter(s => s.actual6 && s.actual6.toString().trim() !== '')
                    .map(s => s.poNumber || s.po_number || '')
                    .filter(Boolean)
            );

            // 2. Identify PO-based pending items
            const poBasedPendingItems = safePoMasterSheet
                .filter((record: any) => {
                    // Firm filtering
                    const firmMatch = !user || user.firmNameMatch?.toLowerCase() === "all" ||
                        record.firmNameMatch === user.firmNameMatch;
                    if (!firmMatch) return false;

                    // Status filtering
                    const status = (record.status || record.indent_status || '').toString().trim().toLowerCase();
                    const isPending = status === 'pending' || status === '' || status === undefined;
                    if (!isPending) return false;

                    // Outstanding amount calculation
                    const totalPo = Number(record.totalPoAmount || 0);

                    // Sum payments for this PO
                    const totalPaid = safePaymentsSheet
                        .filter((p: any) => (p.poNumber || p.po_number || p.po_no) === (record.poNumber || record.po_number || record.po_no))
                        .reduce((sum, p) => sum + Number(p.payAmount || p.pay_amount || 0), 0);

                    const outstanding = totalPo - totalPaid;

                    // Only show if received
                    const isReceived = receivedPoNumbersSet.has(record.poNumber || record.po_number || record.po_no || '');
                    if (!isReceived) return false;

                    // ✅ Check if Bill Type is "common" in Store In
                    // If so, do not show in HOD Approval (Process ends after Store In)
                    const linkedStoreIn = safeStoreInSheet.find((s: any) =>
                        (s.poNumber || s.po_number || '') === (record.poNumber || record.po_number || record.po_no || '')
                    );

                    if (linkedStoreIn?.typeOfBill) {
                        if (linkedStoreIn.typeOfBill.toLowerCase() !== 'independent') {
                            return false;
                        }
                    }

                    return outstanding > 0;
                })
                .map((record: any) => {
                    const totalPo = Number(record.totalPoAmount || 0);
                    const totalPaid = safePaymentsSheet
                        .filter((p: any) => (p.poNumber || p.po_number || p.po_no) === (record.poNumber || record.po_number || record.po_no))
                        .reduce((sum, p) => sum + Number(p.payAmount || p.pay_amount || 0), 0);

                    return {
                        rowIndex: record.id || record.rowIndex || 0,
                        timestamp: record.timestamp || '',
                        partyName: record.partyName || record.party_name || '',
                        poNumber: record.poNumber || record.po_number || '',
                        internalCode: record.internalCode || record.internal_code || '',
                        product: record.product || '',
                        description: record.description || record.product || '',
                        quantity: Number(record.quantity || 0),
                        unit: record.unit || '',
                        rate: Number(record.rate || 0),
                        gstPercent: Number(record.gstPercent || record.gst_percent || 0),
                        discountPercent: Number(record.discountPercent || record.discount_percent || 0),
                        amount: Number(record.amount || 0),
                        totalPoAmount: totalPo,
                        deliveryDate: record.deliveryDate || record.delivery_date || '',
                        paymentTerms: record.paymentTerms || record.payment_terms || '',
                        numberOfDays: record.numberOfDays || record.number_of_days || 0,
                        firmNameMatch: record.firmNameMatch || '',
                        totalPaidAmount: totalPaid,
                        outstandingAmount: totalPo - totalPaid,
                        status: record.status || 'Pending',
                        pdf: record.pdf || '',
                    };
                });

            // 3. Identify Payment-based pending items (Direct entries like Store In or Freight)
            const paymentBasedItems = safePaymentsSheet
                .filter((payment: any) => {
                    const status = String(payment?.status || '').toLowerCase();
                    const firmMatch = !user || user.firmNameMatch?.toLowerCase() === "all" ||
                        (payment?.firmNameMatch || payment?.firm_name) === user?.firmNameMatch;

                    // Show payments that are pending and not yet scheduled
                    const isPending = status === 'pending';
                    const notScheduled = !payment?.planned || String(payment?.planned || '').trim() === '';

                    // ✅ Link with StoreIn to check Bill Type
                    // If Bill Type is "common", DO NOT show in HOD Approval
                    const linkedStoreIn = safeStoreInSheet.find((s: any) =>
                        (s.indentNo || s.indentNumber) === (payment?.internalCode || payment?.internal_code)
                    );

                    // Strictly show ONLY 'independent' if typeOfBill is present
                    // This handles blocking 'common' bills as requested
                    if (linkedStoreIn?.typeOfBill) {
                        if (linkedStoreIn.typeOfBill.toLowerCase() !== 'independent') {
                            return false;
                        }
                    }

                    return firmMatch && isPending && notScheduled;
                })
                .map((payment: any) => ({
                    rowIndex: payment?.id || payment?.rowIndex || 0,
                    timestamp: payment?.timestamp || '',
                    partyName: payment?.partyName || payment?.party_name || '',
                    poNumber: payment?.poNumber || payment?.po_number || '',
                    internalCode: payment?.internalCode || payment?.internal_code || '',
                    product: payment?.product || '',
                    description: `${payment?.paymentForm || payment?.payment_form ? (payment.paymentForm || payment.payment_form).toUpperCase() + ' - ' : ''}${payment?.product || ''}`,
                    quantity: 0,
                    unit: '',
                    rate: 0,
                    gstPercent: 0,
                    discountPercent: 0,
                    amount: Number(payment?.payAmount || payment?.pay_amount || 0),
                    totalPoAmount: Number(payment?.totalPoAmount || payment?.total_po_amount || payment?.payAmount || payment?.pay_amount || 0),
                    deliveryDate: payment?.deliveryDate || payment?.delivery_date || '',
                    paymentTerms: payment?.paymentTerms || payment?.payment_terms || '',
                    numberOfDays: Number(payment?.numberOfDays || payment?.number_of_days || 0),
                    firmNameMatch: payment?.firmNameMatch || payment?.firm_name || '',
                    totalPaidAmount: Number(payment?.totalPaidAmount || payment?.total_paid_amount || 0),
                    outstandingAmount: Number(payment?.outstandingAmount || payment?.outstanding_amount || payment?.payAmount || payment?.pay_amount || 0),
                    status: payment?.status || 'Pending',
                    pdf: payment?.pdf || payment?.file || '',
                }));

            // Combine both lists and remove duplicates by poNumber
            const allPendingItems = [...poBasedPendingItems];
            const poNumbersInList = new Set(poBasedPendingItems.map(item => item.poNumber));

            for (const paymentItem of paymentBasedItems) {
                if (!paymentItem.poNumber || !poNumbersInList.has(paymentItem.poNumber)) {
                    allPendingItems.push(paymentItem);
                }
            }

            setPendingData(allPendingItems);

            const totalOutstanding = allPendingItems.reduce((sum, item) => sum + item.outstandingAmount, 0);

            setStats({
                total: allPendingItems.length,
                totalAmount: totalOutstanding,
                pendingCount: allPendingItems.length
            });

        } catch (error) {
            console.error('❌ Error in HOD Approval logic:', error);
            setPendingData([]);
        }
    }, [poMasterSheet, paymentsSheet, storeInSheet, user?.firmNameMatch]);

    const pendingColumns: ColumnDef<PIPendingData>[] = [
        {
            header: 'Action',
            cell: ({ row }: { row: Row<PIPendingData> }) => (
                <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                        setSelectedItem(row.original);
                        setOpenDialog(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 shadow-sm"
                >
                    <FileText className="mr-2 h-3 w-3" />
                    Against PI
                </Button>
            ),
        },
        {
            accessorKey: 'poNumber',
            header: 'PO Number',
            cell: ({ row }) => (
                <span className="font-medium text-purple-700">{row.original.poNumber || '-'}</span>
            )
        },
        {
            accessorKey: 'partyName',
            header: 'Party Name',
            cell: ({ row }) => (
                <span className="font-medium">{row.original.partyName || '-'}</span>
            )
        },
        {
            accessorKey: 'internalCode',
            header: 'Indent No.',
            cell: ({ row }) => (
                <div className="bg-gray-50 py-1 px-3 rounded-md inline-block border">
                    {row.original.internalCode || '-'}
                </div>
            )
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ row }) => (
                <span className="text-sm">{row.original.product || '-'}</span>
            )
        },
        {
            accessorKey: 'totalPoAmount',
            header: 'Total PO Amount',
            cell: ({ row }) => (
                <span className="font-bold text-purple-600">₹{row.original.totalPoAmount?.toLocaleString('en-IN')}</span>
            )
        },
        {
            accessorKey: 'totalPaidAmount',
            header: 'Total Paid',
            cell: ({ row }) => (
                <span className="font-semibold text-green-600">
                    ₹{row.original.totalPaidAmount?.toLocaleString('en-IN')}
                </span>
            )
        },
        {
            accessorKey: 'outstandingAmount',
            header: 'Outstanding',
            cell: ({ row }) => (
                <span className="font-semibold text-red-600">
                    ₹{row.original.outstandingAmount?.toLocaleString('en-IN')}
                </span>
            )
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status?.toLowerCase() || '';
                const isPending = status === 'pending';
                const isComplete = status === 'complete' || status === 'completed';

                return (
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${isComplete
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : isPending
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-gray-100 text-gray-800 border border-gray-300'
                        }`}>
                        {isComplete && <CheckCircle className="mr-1 h-3 w-3" />}
                        {isPending && <AlertCircle className="mr-1 h-3 w-3" />}
                        {row.original.status || 'Pending'}
                    </span>
                );
            }
        },
        {
            accessorKey: 'paymentTerms',
            header: 'Payment Terms',
            cell: ({ row }) => (
                <span className="text-sm">{row.original.paymentTerms || '-'}</span>
            )
        },
        {
            accessorKey: 'deliveryDate',
            header: 'Delivery Date',
            cell: ({ row }) => {
                const deliveryDate = row.original.deliveryDate;
                if (!deliveryDate) return <span className="text-sm">-</span>;

                try {
                    const date = new Date(deliveryDate);
                    if (isNaN(date.getTime())) {
                        return <span className="text-sm">{deliveryDate}</span>;
                    }
                    const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)}`;
                    return <span className="text-sm">{formattedDate}</span>;
                } catch (error) {
                    return <span className="text-sm">{deliveryDate}</span>;
                }
            }
        },
        {
            accessorKey: 'firmNameMatch',
            header: 'Firm',
            cell: ({ row }) => (
                <div className="flex items-center gap-1 text-gray-700">
                    <Building className="h-3 w-3 text-gray-500" />
                    {row.original.firmNameMatch || '-'}
                </div>
            )
        },
    ];

    // ✅ UPDATED SCHEMA - Only Pay Amount, File, Remarks
    const schema = z.object({
        payAmount: z.string().min(1, 'Pay Amount is required').refine(val => !isNaN(Number(val)), {
            message: 'Pay Amount must be a valid number'
        }),
        file: z.string().optional(),
        remark: z.string().min(1, 'Remarks are required'),
    });

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            payAmount: '',
            file: '',
            remark: '',
        },
    });

    useEffect(() => {
        if (!openDialog) {
            form.reset();
        }
    }, [openDialog, form]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Only PDF, JPG, and PNG files are allowed');
            return;
        }

        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            toast.error('File size must be less than 10MB');
            return;
        }

        try {
            setUploadingFile(true);
            const driveLink = await uploadFile({
                file: file,
                folderId: 'photo_of_bill'
            });

            form.setValue('file', driveLink);
            toast.success('File uploaded successfully');
        } catch (error) {
            toast.error('Failed to upload file');
            console.error('Upload error:', error);
        } finally {
            setUploadingFile(false);
        }
    };

    // ✅ Generate Unique Number for PAYMENTS sheet
    function generateUniqueNo(): string {
        const existingCount = Array.isArray(paymentsSheet) ? paymentsSheet.length : 0;
        return `PAY-${(existingCount + 1).toString().padStart(4, '0')}`;
    }

    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            if (!selectedItem) {
                toast.error('No item selected');
                return;
            }

            const currentDateTime = new Date().toISOString();
            const formattedDateTime = currentDateTime;

            const payAmount = Number(values.payAmount) || 0;
            const newTotalPaid = (selectedItem.totalPaidAmount || 0) + payAmount;
            const newOutstanding = (selectedItem.outstandingAmount || 0) - payAmount;
            const newStatus = newOutstanding <= 0 ? 'Complete' : 'Pending';

            // ✅ CHECK IF THIS IS A PAYMENT-BASED ITEM (from payments table) OR PO-BASED ITEM
            const isPaymentBased = selectedItem.rowIndex > 0 &&
                Array.isArray(paymentsSheet) &&
                paymentsSheet.some((p: any) => p.id === selectedItem.rowIndex);

            if (isPaymentBased) {
                // ✅ FOR PAYMENT-BASED ITEMS: Update the existing payment record
                const { error: updatePaymentError } = await supabase
                    .from('payments')
                    .update({
                        planned: currentDateTime,
                        status: 'Approved',
                        status1: 'approved',
                        pay_amount: payAmount,
                        file: values.file || '',
                        remark: values.remark || '',
                    })
                    .eq('id', selectedItem.rowIndex);

                if (updatePaymentError) {
                    throw updatePaymentError;
                }

                toast.success(`✅ Payment approved for: ${selectedItem.partyName}`);
            } else {
                // ✅ FOR PO-BASED ITEMS: Create a new payment entry as before
                const uniqueNo = generateUniqueNo();

                const paymentData = {
                    timestamp: formattedDateTime,
                    unique_no: uniqueNo,
                    party_name: selectedItem.partyName,
                    po_number: selectedItem.poNumber,
                    total_po_amount: selectedItem.totalPoAmount,
                    internal_code: selectedItem.internalCode,
                    product: selectedItem.product,
                    delivery_date: selectedItem.deliveryDate,
                    payment_terms: selectedItem.paymentTerms,
                    number_of_days: Number(selectedItem.numberOfDays || 0),
                    pdf: selectedItem.pdf || '',
                    pay_amount: payAmount,
                    file: values.file || '',
                    remark: values.remark,
                    total_paid_amount: newTotalPaid,
                    outstanding_amount: newOutstanding,
                    status: newStatus,
                    planned: currentDateTime,
                    actual: '',
                    firm_name: user?.firmNameMatch || '',
                };

                // ✅ Insert to PAYMENTS table in Supabase
                const { error: insertError } = await supabase
                    .from('payments')
                    .insert([paymentData]);

                if (insertError) {
                    throw insertError;
                }

                // ✅ Update PO MASTER table with new totals and status
                const { error: updateError } = await supabase
                    .from('po_master')
                    .update({
                        total_paid_amount: newTotalPaid,
                        outstanding_amount: newOutstanding,
                        status: newStatus,
                    })
                    .eq('id', selectedItem.rowIndex);

                if (updateError) {
                    throw updateError;
                }

                toast.success(`Payment submitted for PO: ${selectedItem.poNumber}`);
            }

            setOpenDialog(false);
            setTimeout(() => updateAll(), 1000);
        } catch (error) {
            toast.error('Failed to process payment');
            console.error('Payment error:', error);
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields correctly');
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 p-4 md:p-6">
            <div className="mx-auto max-w-7xl">
                {/* Header Section */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-purple-600 rounded-lg shadow">
                            <Package2 size={28} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">PI Payments</h1>
                            <p className="text-gray-600">Process payments for pending purchase orders</p>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <Card className="bg-white shadow border-0 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Pending Payments</p>
                                        <p className="text-2xl font-bold text-purple-600 mt-1">{stats.total}</p>
                                    </div>
                                    <FileText className="h-10 w-10 text-purple-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-white shadow border-0 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Total PO Amount</p>
                                        <p className="text-2xl font-bold text-green-600 mt-1">
                                            ₹{stats.totalAmount.toLocaleString('en-IN')}
                                        </p>
                                    </div>
                                    <DollarSign className="h-10 w-10 text-green-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-white shadow border-0 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Payment Status</p>
                                        <p className="text-2xl font-bold text-amber-600 mt-1">
                                            {stats.pendingCount > 0 ? 'Pending' : 'Completed'}
                                        </p>
                                    </div>
                                    <div className={`h-10 w-10 flex items-center justify-center rounded-full ${stats.pendingCount > 0 ? 'bg-amber-100' : 'bg-green-100'
                                        }`}>
                                        {stats.pendingCount > 0 ? (
                                            <AlertCircle className="h-6 w-6 text-amber-600" />
                                        ) : (
                                            <CheckCircle className="h-6 w-6 text-green-600" />
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Main Content Card */}
                <Card className="bg-white shadow-lg border-0 mb-6">
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl font-bold text-gray-800">Pending Payments</CardTitle>
                                <p className="text-gray-600 text-sm mt-1">Click "Make Payment" to process payment for purchase order</p>
                            </div>
                            {stats.total === 0 ? (
                                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-300">
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    All Paid
                                </div>
                            ) : (
                                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 border border-purple-300">
                                    <AlertCircle className="mr-1 h-3 w-3" />
                                    {stats.total} Pending
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {pendingData.length > 0 ? (
                            <DataTable
                                data={pendingData}
                                columns={pendingColumns}
                                searchFields={['poNumber', 'partyName', 'product', 'internalCode', 'firmNameMatch']}
                                dataLoading={poMasterLoading}
                                className="border rounded-lg"
                            />
                        ) : (
                            <div className="text-center py-12">
                                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">No Pending Payments</h3>
                                <p className="text-gray-500">All payments have been processed or no POs with pending status.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Payment Dialog */}
                <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                    {selectedItem && (
                        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6">
                                    <DialogHeader>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-purple-100 rounded-lg">
                                                <DollarSign className="h-6 w-6 text-purple-600" />
                                            </div>
                                            <div>
                                                <DialogTitle className="text-xl">Make Payment</DialogTitle>
                                                <DialogDescription>
                                                    Process payment for PO: <span className="font-semibold text-purple-600">{selectedItem.poNumber}</span>
                                                </DialogDescription>
                                            </div>
                                        </div>
                                    </DialogHeader>

                                    <Separator />

                                    {/* PO Details Card */}
                                    <Card className="bg-purple-50 border-purple-200">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base font-semibold text-purple-800 flex items-center gap-2">
                                                <Package2 className="h-4 w-4" />
                                                PO Details
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">PO Number</p>
                                                    <p className="text-sm font-semibold text-gray-800">{selectedItem.poNumber}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Party Name</p>
                                                    <p className="text-sm font-semibold text-gray-800">{selectedItem.partyName}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Indent No.</p>
                                                    <p className="text-sm font-semibold text-gray-800">{selectedItem.internalCode}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Product</p>
                                                    <p className="text-sm font-semibold text-gray-800">{selectedItem.product}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Total PO Amount</p>
                                                    <p className="text-sm font-semibold text-green-600">
                                                        ₹{selectedItem.totalPoAmount?.toLocaleString('en-IN')}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Total Paid</p>
                                                    <p className="text-sm font-semibold text-green-600">
                                                        ₹{selectedItem.totalPaidAmount?.toLocaleString('en-IN')}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Outstanding</p>
                                                    <p className="text-sm font-semibold text-red-600">
                                                        ₹{selectedItem.outstandingAmount?.toLocaleString('en-IN')}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Status</p>
                                                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                                        {selectedItem.status || 'Pending'}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* ✅ UPDATED Form Fields - Only Pay Amount, File, Remarks */}
                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="payAmount"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-medium flex items-center gap-2">
                                                        <DollarSign className="h-4 w-4" />
                                                        Pay Amount *
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="Enter payment amount"
                                                            className="border-gray-300 focus:border-purple-500"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="remark"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-medium">Remarks *</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="text"
                                                            placeholder="Enter payment remarks"
                                                            className="border-gray-300 focus:border-purple-500"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="file"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-medium flex items-center gap-2">
                                                        <Upload className="h-4 w-4" />
                                                        Upload Payment Proof
                                                    </FormLabel>
                                                    <FormControl>
                                                        <div className="space-y-2">
                                                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-purple-400 transition-colors">
                                                                <Input
                                                                    type="file"
                                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                                    onChange={handleFileUpload}
                                                                    disabled={uploadingFile}
                                                                    className="border-0 cursor-pointer"
                                                                />
                                                                <p className="text-xs text-gray-500 mt-2">
                                                                    Upload payment proof (PDF, JPG, PNG - Max 10MB)
                                                                </p>
                                                            </div>
                                                            {uploadingFile && (
                                                                <div className="flex items-center gap-2 text-sm text-blue-600">
                                                                    <Loader size={16} color="blue" />
                                                                    Uploading...
                                                                </div>
                                                            )}
                                                            {field.value && !uploadingFile && (
                                                                <div className="space-y-1">
                                                                    <p className="text-sm text-green-600 flex items-center gap-2">
                                                                        <CheckCircle className="h-4 w-4" />
                                                                        File uploaded successfully
                                                                    </p>
                                                                    <a
                                                                        href={field.value}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                                                    >
                                                                        View uploaded file →
                                                                    </a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <Separator />

                                    <DialogFooter className="gap-2">
                                        <DialogClose asChild>
                                            <Button
                                                variant="outline"
                                                type="button"
                                                className="border-gray-300"
                                                disabled={form.formState.isSubmitting || uploadingFile}
                                            >
                                                Cancel
                                            </Button>
                                        </DialogClose>
                                        <Button
                                            type="submit"
                                            className="bg-purple-600 hover:bg-purple-700 shadow-sm"
                                            disabled={form.formState.isSubmitting || uploadingFile}
                                        >
                                            {form.formState.isSubmitting ? (
                                                <>
                                                    <Loader size={18} className="mr-2" />
                                                    Submitting...
                                                </>
                                            ) : (
                                                <>
                                                    <DollarSign className="mr-2 h-4 w-4" />
                                                    Submit Payment
                                                </>
                                            )}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    )}
                </Dialog>
            </div>
        </div>
    );
}