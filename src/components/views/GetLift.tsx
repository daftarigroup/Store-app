import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
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
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ShoppingCart, X, Truck, FileText, IndianRupee, CreditCard, User, Phone, CheckCircle2, Package, Info, Upload } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate, formatDateTime, parseCustomDate } from '@/lib/utils';
import {
    fetchIndentRecords,
    fetchStoreInRecords,
    fetchVendorOptions,
    insertStoreInRecord,
    updateCancelQuantity,
    uploadBillPhoto,
    updateActual5Timestamp,
    updateLiftingStatus,
    type GetLiftIndentRecord,
    type GetLiftStoreInRecord,
} from '@/services/getLiftService';
import { fetchPoMaster } from '@/services/poService';

interface GetPurchaseData {
    indentNo: string;
    firmNameMatch: string;
    vendorName: string;
    poNumber: string;
    poDate: string;
    deliveryDate: string;
    product?: string;
    quantity?: number;
    pendingLiftQty?: number;
    receivedQty?: number;
    pendingPoQty?: number;
    plannedDate?: string;
    approvedRate?: string;
    timestamp?: string;
    department?: string;
    areaOfUse?: string;
    approvedVendorName?: string;
    liftingStatus?: string;
}

interface HistoryData {
    indentNo: string;
    firmNameMatch: string;
    vendorName: string;
    poNumber: string;
    poDate: string;
    deliveryDate: string;
    product?: string;
    photoOfBill?: string;
    quantity?: number;
    pendingLiftQty?: number;
    receivedQty?: number;
    pendingPoQty?: number;
    timestamp?: string;
    department?: string;
    areaOfUse?: string;
    approvedVendorName?: string;
    liftingStatus?: string;
}

interface AuthUser {
    firmNameMatch?: string;
    receiveItemAction?: boolean;
}

export default function GetPurchase() {
    const { user } = useAuth() as { user: AuthUser };
    const [selectedIndent, setSelectedIndent] = useState<GetPurchaseData | null>(null);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [tableData, setTableData] = useState<GetPurchaseData[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [vendorOptions, setVendorOptions] = useState<string[]>([]);
    const [vendorSearch, setVendorSearch] = useState('');
    const [showCancelQty, setShowCancelQty] = useState(false);
    const [cancelQtyValue, setCancelQtyValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [indentRecords, setIndentRecords] = useState<GetLiftIndentRecord[]>([]);
    const [storeInRecords, setStoreInRecords] = useState<GetLiftStoreInRecord[]>([]);
    const [poMasterData, setPoMasterData] = useState<any[]>([]);

    // Fetch all data from Supabase
    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            try {
                const [vendors, indents, storeIns, poMaster] = await Promise.all([
                    fetchVendorOptions(),
                    fetchIndentRecords(),
                    fetchStoreInRecords(),
                    fetchPoMaster(),
                ]);

                setVendorOptions(vendors);
                setIndentRecords(indents);
                setStoreInRecords(storeIns);
                setPoMasterData(poMaster);
            } catch (error) {
                console.error('Failed to fetch data:', error);
                toast.error('Failed to load data');
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, []);

    // Process pending table data
    useEffect(() => {
        const filteredByFirm = indentRecords.filter(
            (sheet) =>
                user?.firmNameMatch?.toLowerCase() === 'all' ||
                sheet.firmNameMatch === user?.firmNameMatch
        );
        setTableData(
            filteredByFirm
                .map((sheet) => {
                    // Calculate received quantity from STORE IN records
                    const receivedQty = storeInRecords
                        .filter(
                            (store) =>
                                store.indentNo === sheet.indentNumber?.toString()
                        )
                        .reduce(
                            (sum, store) =>
                                sum + (Number(store.receivedQuantity) || 0),
                            0
                        );

                    // Use pendingPoQty from sheet if available, otherwise calculate
                    const pendingPoQty = (Number(sheet.approvedQuantity) || 0) - receivedQty;

                    return { ...sheet, pendingPoQty, receivedQty };
                })
                .filter((item) => {
                    // Show only Pending items with planned date but no actual date
                    const hasPlanned5 = item.planned5 && item.planned5.toString().trim() !== '';
                    const hasActual5 = item.actual5 && item.actual5.toString().trim() !== '';
                    const isPending = item.liftingStatus === 'Pending' || item.liftingStatus === '' || item.liftingStatus === null;

                    // Check if PO is created in po_master
                    const indentStr = item.indentNumber?.toString().trim();
                    const isPoCreated = poMasterData.some(po => po.internalCode?.toString().trim() === indentStr);

                    // ✅ Hide if no quantity left to lift
                    return isPending && hasPlanned5 && !hasActual5 && item.pendingPoQty > 0 && isPoCreated;
                })
                .map((item) => {
                    return {
                        indentNo: item.indentNumber?.toString() || '',
                        firmNameMatch: item.firmNameMatch || '',
                        vendorName: item.approvedVendorName || '',
                        poNumber: item.poNumber || '',
                        poDate: item.actual4 ? formatDate(parseCustomDate(item.actual4)) : '',
                        deliveryDate: item.deliveryDate
                            ? formatDate(parseCustomDate(item.deliveryDate))
                            : '',
                        plannedDate: item.planned5
                            ? formatDate(parseCustomDate(item.planned5))
                            : 'Not Set',
                        product: item.productName || '',
                        quantity: Number(item.approvedQuantity) || 0,
                        pendingLiftQty: item.pendingPoQty,
                        receivedQty: item.receivedQty,
                        pendingPoQty: item.pendingPoQty,
                        approvedRate: item.approvedRate || '',
                        timestamp: item.timestamp || '',
                        department: item.department || '',
                        areaOfUse: item.areaOfUse || '',
                        approvedVendorName: item.approvedVendorName || '',
                        liftingStatus: item.liftingStatus || '',
                    };
                })
        );
    }, [indentRecords, storeInRecords, poMasterData, user?.firmNameMatch]);

    // Process history data
    useEffect(() => {
        const filteredByFirm = indentRecords.filter(
            (sheet) =>
                user?.firmNameMatch?.toLowerCase() === 'all' ||
                sheet.firmNameMatch === user?.firmNameMatch
        );

        const completedIndents = filteredByFirm.filter((sheet) => {
            return (
                sheet.liftingStatus === 'Complete' &&
                sheet.planned5 &&
                sheet.planned5.toString().trim() !== ''
            );
        });

        const indentDataMap = new Map(
            completedIndents.map((sheet) => [
                sheet.indentNumber?.toString() || '',
                {
                    poNumber: sheet.poNumber || '',
                    poDate: sheet.actual4 ? formatDate(parseCustomDate(sheet.actual4)) : '',
                    deliveryDate: sheet.deliveryDate
                        ? formatDate(parseCustomDate(sheet.deliveryDate))
                        : '',
                    approvedVendorName: sheet.approvedVendorName || '',
                    productName: sheet.productName || '',
                    approvedQuantity: sheet.quantity || 0,
                    pendingLiftQty: sheet.pendingQty || 0,
                    firmNameMatch: sheet.firmNameMatch || '',
                },
            ])
        );

        const filteredStoreIn = storeInRecords.filter(
            (sheet) =>
                user?.firmNameMatch?.toLowerCase() === 'all' ||
                sheet.firmNameMatch === user?.firmNameMatch
        );

        setHistoryData(
            filteredStoreIn
                .filter((sheet) => indentDataMap.has(sheet.indentNo || ''))
                .map((sheet) => {
                    const indentData = indentDataMap.get(sheet.indentNo || '')!;

                    const indentRecord = completedIndents.find(
                        (indent) => indent.indentNumber?.toString() === sheet.indentNo
                    );

                    const approvedQty =
                        Number(indentRecord?.approvedQuantity) || 0;

                    const receivedQty = filteredStoreIn
                        .filter((store) => store.indentNo === sheet.indentNo)
                        .reduce(
                            (sum, store) =>
                                sum + (Number(store.receivedQuantity) || 0),
                            0
                        );

                    const pendingLift = approvedQty - receivedQty;

                    return {
                        indentNo: sheet.indentNo || '',
                        firmNameMatch: indentData.firmNameMatch || sheet.firmNameMatch || '',
                        vendorName: indentData.approvedVendorName || sheet.vendorName || '',
                        poNumber: indentData.poNumber,
                        poDate: indentData.poDate,
                        deliveryDate: indentData.deliveryDate,
                        product: indentData.productName,
                        quantity: approvedQty,
                        pendingLiftQty: pendingLift,
                        receivedQty: receivedQty,
                        pendingPoQty: Math.max(0, pendingLift),
                        photoOfBill: sheet.photoOfBill || '',
                        timestamp: sheet.timestamp || '',
                        department: indentRecord?.department || '',
                        areaOfUse: indentRecord?.areaOfUse || '',
                        approvedVendorName: indentRecord?.approvedVendorName || '',
                        liftingStatus: indentRecord?.liftingStatus || '',
                    };
                })
                .sort((a, b) => b.indentNo.localeCompare(a.indentNo))
        );
    }, [storeInRecords, indentRecords, user?.firmNameMatch]);

    // Creating table columns
    const columns: ColumnDef<GetPurchaseData>[] = [
        ...(user?.receiveItemAction
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<GetPurchaseData> }) => {
                        const indent = row.original;
                        return (
                            <div>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setSelectedIndent(indent);
                                            setShowCancelQty(false);
                                            setCancelQtyValue('');
                                        }}
                                    >
                                        Update
                                    </Button>
                                </DialogTrigger>
                            </div>
                        );
                    },
                },
            ]
            : []),
        {
            accessorKey: 'timestamp',
            header: 'Timestamp',
            cell: ({ getValue }) => <div>{getValue() ? formatDateTime(parseCustomDate(getValue())) : '-'}</div>,
        },
        {
            accessorKey: 'indentNo',
            header: 'Indent No.',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'firmNameMatch',
            header: 'Firm Name',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'vendorName',
            header: 'Approved Vendor Name',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'poNumber',
            header: 'PO Number',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'poDate',
            header: 'PO Date',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'deliveryDate',
            header: 'Delivery Date',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'plannedDate', // ✅ ADD THIS COLUMN
            header: 'Planned Date',
            cell: ({ getValue }) => {
                const plannedDate = getValue() as string;
                return (
                    <div
                        className={`${plannedDate === 'Not Set' ? 'text-muted-foreground italic' : ''}`}
                    >
                        {plannedDate}
                    </div>
                );
            },
        },
        {
            accessorKey: 'pendingLiftQty',
            header: 'Pending Lift Qty',
            cell: ({ getValue }) => <div>{(getValue() as number) || 0}</div>,
        },
        {
            accessorKey: 'receivedQty',
            header: 'Received Qty',
            cell: ({ getValue }) => <div>{(getValue() as number) || 0}</div>,
        },
        {
            accessorKey: 'pendingPoQty',
            header: 'Pending PO Qty',
            cell: ({ getValue }) => <div>{(getValue() as number) || 0}</div>,
        },
    ];

    const historyColumns: ColumnDef<HistoryData>[] = [
        {
            accessorKey: 'timestamp',
            header: 'Timestamp',
            cell: ({ getValue }) => <div>{getValue() ? formatDateTime(parseCustomDate(getValue())) : '-'}</div>,
        },
        {
            accessorKey: 'indentNo',
            header: 'Indent No.',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'firmNameMatch',
            header: 'Firm Name',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'vendorName',
            header: 'Approved Vendor Name',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'photoOfBill',
            header: 'Photo Of Bill',
            cell: ({ getValue }) => {
                const photoUrl = getValue() as string;
                if (!photoUrl) return <div className="text-muted-foreground">-</div>;

                return (
                    <div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(photoUrl, '_blank')}
                        >
                            View Bill
                        </Button>
                    </div>
                );
            },
        },
        {
            accessorKey: 'poNumber',
            header: 'PO Number',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'poDate',
            header: 'PO Date',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'deliveryDate',
            header: 'Delivery Date',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'pendingLiftQty',
            header: 'Pending Lift Qty',
            cell: ({ getValue }) => <div>{(getValue() as number) || 0}</div>,
        },
        {
            accessorKey: 'receivedQty',
            header: 'Received Qty',
            cell: ({ getValue }) => <div>{(getValue() as number) || 0}</div>,
        },
        {
            accessorKey: 'pendingPoQty',
            header: 'Pending PO Qty',
            cell: ({ getValue }) => <div>{(getValue() as number) || 0}</div>,
        },
    ];

    // Creating form schema
    const formSchema = z.object({
        billStatus: z.string().min(1, 'Bill status is required'),
        billNo: z.string().optional(),
        qty: z.coerce.number().optional(),
        typeOfBill: z.string().optional(),
        billAmount: z.coerce.number().optional(),
        discountAmount: z.coerce.number().optional(),
        paymentType: z.string().optional(),
        advanceAmount: z.coerce.number().optional(),
        photoOfBill: z
            .instanceof(File)
            .optional()
            .refine((file) => {
                // Allow both images and PDFs
                if (!file) return true; // Optional field
                const allowedTypes = [
                    'image/jpeg',
                    'image/jpg',
                    'image/png',
                    'image/gif',
                    'image/webp',
                    'application/pdf',
                ];
                return allowedTypes.includes(file.type);
            }, 'File must be an image (JPEG, PNG, GIF, WebP) or PDF'),
        billRemark: z.string().optional(),
        vendorName: z.string().optional(),
        transportationInclude: z.string().optional(),
        transporterName: z.string().optional(),
        vehicleNo: z.string().optional(),
        driverName: z.string().optional(),
        driverMobileNo: z.string().optional(),
        amount: z.coerce.number().optional(),
        cancelPendingQty: z.coerce.number().optional(),
    });

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any, // Add type assertion here
        defaultValues: {
            billStatus: '',
            billNo: '',
            qty: 0,
            typeOfBill: '',
            billAmount: 0,
            discountAmount: 0,
            paymentType: '',
            advanceAmount: 0,
            billRemark: '',
            vendorName: '',
            transportationInclude: '',
            transporterName: '',
            vehicleNo: '',
            driverName: '',
            driverMobileNo: '',
            amount: 0,
            cancelPendingQty: 0,
        },
    });

    const billStatus = form.watch('billStatus');
    const typeOfBill = form.watch('typeOfBill');

    // Handle cancel quantity only submission
    // Handle cancel quantity only submission
    // Handle cancel quantity only submission
    // Handle cancel quantity only submission
    // Handle cancel quantity only submission
    const handleCancelQtySubmit = async () => {
        if (!cancelQtyValue || Number(cancelQtyValue) <= 0) {
            toast.error('Please enter a valid quantity to cancel');
            return;
        }

        const cancelQty = Number(cancelQtyValue);
        if (cancelQty > (selectedIndent?.pendingPoQty || 0)) {
            toast.error(
                `Cancel quantity cannot exceed pending PO quantity: ${selectedIndent?.pendingPoQty || 0}`
            );
            return;
        }

        try {
            console.log('❌ Processing cancel pending quantity only:', cancelQty);

            if (!selectedIndent?.indentNo) {
                toast.error('Could not find the indent record to update');
                return;
            }

            await updateCancelQuantity(selectedIndent.indentNo, cancelQty);

            toast.success(`Cancelled ${cancelQty} quantity for ${selectedIndent?.indentNo}`);
            setShowCancelQty(false);
            setCancelQtyValue('');

            // Refresh data
            setTimeout(async () => {
                const [indents, storeIns] = await Promise.all([
                    fetchIndentRecords(),
                    fetchStoreInRecords(),
                ]);
                setIndentRecords(indents);
                setStoreInRecords(storeIns);
                console.log('🔄 Data refreshed after cancel');
            }, 1500);
        } catch (error) {
            console.error('❌ Error in cancel quantity:', error);
            toast.error('Failed to cancel quantity. Please try again.');
        }
    };
    // Add this useEffect to set form values when selectedIndent changes
    useEffect(() => {
        if (selectedIndent) {
            form.reset({
                billStatus: '',
                billNo: '',
                qty: selectedIndent.pendingLiftQty || 0,
                typeOfBill: '',
                billAmount: 0,
                discountAmount: 0,
                paymentType: '',
                advanceAmount: 0,
                billRemark: '',
                vendorName: selectedIndent.vendorName || '', // Auto-fill vendor name
                transportationInclude: '',
                transporterName: '',
                vehicleNo: '',
                driverName: '',
                driverMobileNo: '',
                amount: 0,
                cancelPendingQty: 0,
            });
            setVendorSearch(''); // Reset vendor search
        }
    }, [selectedIndent, form]);

    const typeOfBillWatcher = form.watch('typeOfBill');
    const qtyWatcher = form.watch('qty');

    useEffect(() => {
        if ((typeOfBillWatcher === 'common' || typeOfBillWatcher === 'independent') && selectedIndent) {
            const rateStr = selectedIndent.approvedRate || '0';
            const numericRate = parseFloat(rateStr) || 0;
            const calculatedAmount = (Number(qtyWatcher) || 0) * numericRate;

            // Only auto-fill if the bill amount is either 0 or we are switching to 'common'
            // This prevents overwriting manual edits in 'independent' mode unless qty/type changes
            form.setValue('billAmount', calculatedAmount);
        }
    }, [typeOfBillWatcher, qtyWatcher, selectedIndent, form]);

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            console.log('📝 Selected indent:', selectedIndent);
            console.log('📋 Form values:', values);

            // ✅ VALIDATION: Ensure lifting quantity does not exceed pending lift quantity
            if (Number(values.qty) > (selectedIndent?.pendingLiftQty || 0)) {
                toast.error(`Lifting quantity (${values.qty}) cannot exceed pending quantity (${selectedIndent?.pendingLiftQty || 0})`);
                return;
            }

            // Handle cancel pending quantity first (independent of bill status)
            if (values.cancelPendingQty && values.cancelPendingQty > 0) {
                console.log('❌ Processing cancel pending quantity:', values.cancelPendingQty);

                if (selectedIndent?.indentNo) {
                    await updateCancelQuantity(selectedIndent.indentNo, values.cancelPendingQty);
                    await updateActual5Timestamp(selectedIndent.indentNo);

                    toast.success(
                        `Cancelled ${values.cancelPendingQty} quantity for ${selectedIndent?.indentNo}`
                    );
                } else {
                    toast.error('Could not find the indent record to update');
                }
            } // Continue with original bill submission logic only if bill status is provided

            if (values.billStatus) {
                let photoUrl = '';
                // In the onSubmit function, update the file upload section:
                if (values.photoOfBill) {
                    console.log('📤 Uploading file...');
                    console.log('📄 File type:', values.photoOfBill.type);
                    console.log('📄 File name:', values.photoOfBill.name);

                    try {
                        photoUrl = await uploadBillPhoto(values.photoOfBill, selectedIndent?.indentNo || '');
                        console.log('✅ File uploaded:', photoUrl);

                        // Show success message based on file type
                        if (values.photoOfBill.type === 'application/pdf') {
                            toast.success('PDF document uploaded successfully');
                        } else {
                            toast.success('Image uploaded successfully');
                        }
                    } catch (uploadError) {
                        console.error('❌ File upload error:', uploadError);
                        toast.error('Failed to upload file. Please try again.');
                        return;
                    }
                }

                const currentDateTime = new Date().toISOString();

                console.log('📅 Timestamp:', currentDateTime);

                const newStoreInRecord = {
                    timestamp: currentDateTime,
                    indentNo: selectedIndent?.indentNo || '',
                    billNo: values.billNo || '',
                    vendorName: values.vendorName || selectedIndent?.vendorName || '',
                    productName: selectedIndent?.product || '',
                    qty: Number(values.qty) || Number(selectedIndent?.quantity) || 0,
                    discountAmount: Number(values.discountAmount) || 0,
                    typeOfBill: values.typeOfBill || '',
                    billAmount: Number(values.billAmount) || 0,
                    paymentType: values.paymentType || '',
                    advanceAmountIfAny: Number(values.advanceAmount) || 0,
                    photoOfBill: photoUrl,
                    transportationInclude: values.transportationInclude || '',
                    transporterName: values.transporterName || '',
                    amount: Number(values.amount) || 0,
                    billStatus: values.billStatus === 'Bill Not Received' ? 'Not Received' : values.billStatus,
                    quantityAsPerBill: Number(values.qty) || 0,
                    poDate: selectedIndent?.poDate || '',
                    poNumber: selectedIndent?.poNumber || '',
                    vendor: values.vendorName || selectedIndent?.vendorName || '',
                    indentNumber: selectedIndent?.indentNo || '',
                    product: selectedIndent?.product || '',
                    quantity: Number(values.qty) || Number(selectedIndent?.quantity) || 0,
                    vehicleNo: values.vehicleNo || '',
                    driverName: values.driverName || '',
                    driverMobileNo: values.driverMobileNo || '',
                    billRemark: values.billRemark || '',
                    firmNameMatch: selectedIndent?.firmNameMatch || user?.firmNameMatch || '',
                    rate: selectedIndent?.approvedRate || '',
                    department: selectedIndent?.department || '',
                    areaOfUse: selectedIndent?.areaOfUse || '',
                    approvedVendorName: selectedIndent?.approvedVendorName || '',
                    liftingStatus: selectedIndent?.liftingStatus || '',
                    notBillReceivedNo: values.billStatus === 'Bill Not Received' ? values.billNo : '',
                };

                console.log('📤 Data to insert:', newStoreInRecord);

                await insertStoreInRecord(newStoreInRecord);
                console.log('✅ Insert completed');

                // ✅ Auto-complete status if quantity reaches 0
                const remaining = (selectedIndent?.pendingLiftQty || 0) - (Number(values.qty) || 0);
                if (remaining <= 0) {
                    console.log(`✅ Auto-completing status for ${selectedIndent?.indentNo}`);
                    await updateLiftingStatus(selectedIndent?.indentNo || '', 'Complete');
                }

                toast.success(`Created store record for ${selectedIndent?.indentNo}`);
            }

            setOpenDialog(false);
            form.reset();
            setShowCancelQty(false);
            setCancelQtyValue('');

            setTimeout(async () => {
                const [indents, storeIns] = await Promise.all([
                    fetchIndentRecords(),
                    fetchStoreInRecords(),
                ]);
                setIndentRecords(indents);
                setStoreInRecords(storeIns);
                console.log('🔄 Data refreshed after insert');
            }, 1500);
        } catch (error) {
            console.error('❌ Error in onSubmit:', error);
            toast.error('Failed to process request. Please try again.');
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
                        heading="Get Purchase"
                        subtext="Manage purchase bill details and status"
                        tabs
                        pendingCount={tableData.length}
                        historyCount={historyData.length}
                    >
                        <ShoppingCart size={50} className="text-primary" />
                    </Heading>

                    <TabsContent value="pending">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={['indentNo', 'vendorName', 'poNumber', 'firmNameMatch']}
                            dataLoading={loading}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['indentNo', 'vendorName', 'poNumber', 'firmNameMatch']}
                            dataLoading={false}
                        />
                    </TabsContent>
                </Tabs>

                {selectedIndent && (
                    <DialogContent
                        className="max-h-[95vh] overflow-y-auto"
                        style={{ maxWidth: '80vw', width: '60vw' }}
                    >
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="space-y-6"
                            >
                                <DialogHeader className="space-y-1">
                                    <DialogTitle className="text-lg font-semibold">
                                        Update Purchase Details
                                    </DialogTitle>
                                    <DialogDescription>
                                        Update purchase details for{" "}
                                        <span className="font-medium">
                                            {selectedIndent.indentNo}
                                        </span>
                                    </DialogDescription>
                                </DialogHeader>

                                {/* Info Card */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-muted/50 p-4 rounded-xl border shadow-sm">
                                    {[
                                        ["Indent Number", selectedIndent.indentNo],
                                        ["Product", selectedIndent.product || "-"],
                                        ["PO Number", selectedIndent.poNumber],
                                        ["Pending Lift Qty", selectedIndent.pendingLiftQty || 0],
                                        ["Received Qty", selectedIndent.receivedQty || 0],
                                        ["Pending PO Qty", selectedIndent.pendingPoQty || 0],
                                    ].map(([label, value]) => (
                                        <div key={label} className="space-y-1">
                                            <p className="text-xs text-muted-foreground">{label}</p>
                                            <p className="text-sm font-medium">{value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Cancel Section */}
                                {!showCancelQty ? (
                                    <div className="flex justify-between items-center border rounded-xl p-4 bg-orange-50 border-orange-200 shadow-sm">
                                        <div>
                                            <h3 className="font-medium text-orange-800">
                                                Cancel Pending PO Quantity
                                            </h3>
                                            <p className="text-xs text-orange-600">
                                                Cancel quantity
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="border-orange-300 text-orange-700 hover:bg-orange-100"
                                            onClick={() => setShowCancelQty(true)}
                                        >
                                            Cancel Pending PO
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="border rounded-xl p-4 bg-orange-50 border-orange-200 shadow-sm space-y-3">
                                        <div className="flex justify-between items-center">
                                            <h3 className="font-medium text-orange-800">
                                                Cancel Pending PO Quantity
                                            </h3>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setShowCancelQty(false);
                                                    setCancelQtyValue("");
                                                }}
                                            >
                                                <X size={16} />
                                            </Button>
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-4 items-end">
                                            <div>
                                                <FormLabel className="text-orange-700 text-sm">
                                                    Quantity to Cancel (Max:{" "}
                                                    {selectedIndent.pendingPoQty || 0})
                                                </FormLabel>
                                                <Input
                                                    type="number"
                                                    placeholder="Enter quantity"
                                                    min="0"
                                                    max={selectedIndent.pendingPoQty}
                                                    value={cancelQtyValue}
                                                    onChange={(e) =>
                                                        setCancelQtyValue(e.target.value)
                                                    }
                                                    className="border-orange-300 focus:border-orange-500"
                                                />
                                            </div>

                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="border-orange-300 text-orange-700 hover:bg-orange-100 h-10"
                                                onClick={handleCancelQtySubmit}
                                            >
                                                Submit Cancel Only
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Hidden */}
                                <FormField
                                    control={form.control}
                                    name="cancelPendingQty"
                                    render={({ field }) => (
                                        <FormItem className="hidden">
                                            <FormControl>
                                                <Input type="hidden" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                {/* Main Form - Sections */}
                                <div className="space-y-8">
                                    {/* Section 1: Basic Receipt Info */}
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <FormField
                                            control={form.control}
                                            name="billStatus"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Bill Status *</FormLabel>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger className="h-11">
                                                                <SelectValue placeholder="Select status" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="Bill Received">Bill Received</SelectItem>
                                                            <SelectItem value="Bill Not Received">Bill Not Received</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="typeOfBill"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Type Of Bill *</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-11">
                                                                <SelectValue placeholder="Select type" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="independent">Independent</SelectItem>
                                                            <SelectItem value="common">Common </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />

                                        {billStatus === "Bill Received" && (
                                            <FormField
                                                control={form.control}
                                                name="billNo"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Bill Number *</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} className="h-11" placeholder="Enter bill #" />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        )}

                                        <FormField
                                            control={form.control}
                                            name="qty"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Quantity to Lift *</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" {...field} className="h-11" />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="vendorName"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Approved Vendor</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} readOnly className="h-11 bg-muted cursor-not-allowed" />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    {billStatus && (
                                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                            {/* Section 2: Logistics */}
                                            {typeOfBill === 'independent' && (
                                                <div className="space-y-4 border-t pt-6">
                                                    <div className="flex items-center gap-2 text-primary font-semibold mb-2">
                                                        <Truck size={18} />
                                                        <span>Logistics & Transportation</span>
                                                    </div>
                                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                        <FormField
                                                            control={form.control}
                                                            name="transportationInclude"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Transportation Included?</FormLabel>
                                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                                        <FormControl>
                                                                            <SelectTrigger className="h-11">
                                                                                <SelectValue placeholder="Select" />
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

                                                        {form.watch("transportationInclude") === "Yes" && (
                                                            <>
                                                                <FormField
                                                                    control={form.control}
                                                                    name="transporterName"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel>Transporter Name</FormLabel>
                                                                            <FormControl>
                                                                                <Input {...field} className="h-11" />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />

                                                                <FormField
                                                                    control={form.control}
                                                                    name="vehicleNo"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel>Vehicle No.</FormLabel>
                                                                            <FormControl>
                                                                                <Input {...field} className="h-11" />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />

                                                                <FormField
                                                                    control={form.control}
                                                                    name="driverName"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel>Driver Name</FormLabel>
                                                                            <FormControl>
                                                                                <Input {...field} className="h-11" />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />

                                                                <FormField
                                                                    control={form.control}
                                                                    name="driverMobileNo"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel>Driver Mobile</FormLabel>
                                                                            <FormControl>
                                                                                <Input {...field} className="h-11" />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />

                                                                <FormField
                                                                    control={form.control}
                                                                    name="amount"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel>Freight Amount</FormLabel>
                                                                            <FormControl>
                                                                                <Input type="number" {...field} className="h-11" />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-4 border-t pt-6">
                                                <div className="flex items-center gap-2 text-primary font-semibold mb-2">
                                                    <CreditCard size={18} />
                                                    <span>Financials & Billing</span>
                                                </div>
                                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">


                                                    {(typeOfBill === "independent" || typeOfBill === "common") && (
                                                        <FormField
                                                            control={form.control}
                                                            name="billAmount"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Bill Amount {typeOfBill === 'common' && '(Auto)'}</FormLabel>
                                                                    <FormControl>
                                                                        <Input type="number" {...field} className={`h-11 ${typeOfBill === 'common' ? 'bg-muted' : ''}`} disabled={typeOfBill === 'common'} />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    )}

                                                    {typeOfBill === "independent" && (
                                                        <>
                                                            <FormField
                                                                control={form.control}
                                                                name="discountAmount"
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel>Discount</FormLabel>
                                                                        <FormControl>
                                                                            <Input type="number" {...field} className="h-11" />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                            <FormField
                                                                control={form.control}
                                                                name="paymentType"
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel>Payment Type</FormLabel>
                                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                                            <FormControl>
                                                                                <SelectTrigger className="h-11">
                                                                                    <SelectValue placeholder="Select" />
                                                                                </SelectTrigger>
                                                                            </FormControl>
                                                                            <SelectContent>
                                                                                <SelectItem value="Advance">Advance</SelectItem>
                                                                                <SelectItem value="Credit">Credit</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                            <FormField
                                                                control={form.control}
                                                                name="advanceAmount"
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel>Advance Amount</FormLabel>
                                                                        <FormControl>
                                                                            <Input type="number" {...field} className="h-11" />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </>
                                                    )}
                                                </div>

                                                <div className="grid md:grid-cols-2 gap-6 mt-4">
                                                    <FormField
                                                        control={form.control}
                                                        name="billRemark"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Bill Remark</FormLabel>
                                                                <FormControl>
                                                                    <Input {...field} className="h-11" placeholder="Add any comments..." />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />

                                                    {typeOfBill === "independent" && (
                                                        <FormField
                                                            control={form.control}
                                                            name="photoOfBill"
                                                            render={({ field: { value, onChange, ...field } }) => (
                                                                <FormItem>
                                                                    <FormLabel>Attachment (Photo/PDF) *</FormLabel>
                                                                    <FormControl>
                                                                        <Input
                                                                            type="file"
                                                                            accept="image/*,.pdf"
                                                                            onChange={(e) => onChange(e.target.files?.[0])}
                                                                            {...field}
                                                                            className="h-11 file:bg-primary/10 file:text-primary file:border-0 file:rounded-md cursor-pointer"
                                                                        />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <DialogFooter className="pt-2">
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>

                                    <Button
                                        type="submit"
                                        disabled={form.formState.isSubmitting}
                                        className="min-w-[120px]"
                                    >
                                        {form.formState.isSubmitting && (
                                            <Loader size={18} className="mr-2" />
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
}
