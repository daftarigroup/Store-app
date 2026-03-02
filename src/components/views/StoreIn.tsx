import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Truck, Search } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate, formatDateTime, parseCustomDate } from '@/lib/utils';
import { Pill } from '../ui/pill';
import {
    fetchStoreInRecords,
    fetchLocationOptions,
    updateStoreInReceiving,
    uploadProductPhoto,
    createPaymentEntry,
    type StoreInRecord,
} from '@/services/storeInService';

interface StoreInPendingData {
    liftNumber: string;
    indentNo: string;
    billNo: string;
    vendorName: string;
    productName: string;
    typeOfBill: string;
    billAmount: number;
    paymentType: string;
    advanceAmountIfAny: number;
    photoOfBill: string;
    transportationInclude: string;
    transporterName: string;
    amount: number;
    poDate: string;
    poNumber: string;
    vendor: string;
    indentNumber: string;
    product: string;
    uom: string;
    qty: number;
    poCopy: string;
    billStatus: string;
    leadTimeToLiftMaterial: number;
    discountAmount: number;
    firmNameMatch: string;
    planned6Date: string;
    timestamp: string;
}

interface StoreInHistoryData {
    liftNumber: string;
    indentNo: string;
    billNo: string;
    vendorName: string;
    productName: string;
    qty: number;
    typeOfBill: string;
    billAmount: number;
    paymentType: string;
    advanceAmountIfAny: number;
    photoOfBill: string;
    transportationInclude: string;
    transporterName: string;
    amount: number;
    billStatus: string;
    photoOfProduct: string;
    unitOfMeasurement: string;
    damageOrder: string;
    quantityAsPerBill: number;
    priceAsPerPo: number;
    remark: string;
    poDate: string;
    poNumber: string;
    receiveStatus: string;
    vendor: string;
    product: string;
    orderQuantity: number;
    receivedDate: string;
    warrantyStatus: string;
    warrantyEndDate: string;
    billNumber: string;
    anyTransport: string;
    transportingAmount: number;
    timestamp: string;
    leadTimeToLiftMaterial: number;
    discountAmount: number;
    billReceived: string;
    billImage: string;
    firmNameMatch: string;
    planned6Date: string;
}

type RecieveItemsData = StoreInPendingData;
type HistoryData = StoreInHistoryData;

interface StoreInSheetItem {
    liftNumber?: string;
    indentNo?: string;
    billNo?: string;
    vendorName?: string;
    productName?: string;
    qty?: number;
    typeOfBill?: string;
    billAmount?: number;
    paymentType?: string;
    advanceAmountIfAny?: number | string;
    photoOfBill?: string;
    transportationInclude?: string;
    transporterName?: string;
    amount?: number;
    planned6?: string;
    actual6?: string;
    status?: string;
    billCopyAttached?: string;
    debitNote?: string;
    reason?: string;
    damageOrder?: string;
    quantityAsPerBill?: number;
    priceAsPerPo?: number;
    remark?: string;
    firmNameMatch?: string;
    rowIndex?: number;
    poDate?: string;
    poNumber?: string;
    vendor?: string;
    indentNumber?: string;
    product?: string;
    uom?: string;
    poCopy?: string;
    billStatus?: string;
    leadTimeToLiftMaterial?: number;
    discountAmount?: number;
    receivedQuantity?: number;
    photoOfProduct?: string;
    unitOfMeasurement?: string;
    timestamp?: string;
    billNumber?: string;
    anyTransport?: string;
    transportingAmount?: number;
    receivingStatus?: string;
}

// Safe date formatter for Planned Date
const formatPlannedDate = (dateString: string) => {
    if (!dateString || dateString.trim() === '') return '';
    try {
        // If it's already in dd/mm/yyyy format, return as is
        if (dateString.includes('/')) {
            return dateString;
        }

        // If it's a date string that can be parsed
        const dateObj = new Date(dateString);
        if (isNaN(dateObj.getTime())) return dateString;

        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = String(dateObj.getFullYear()).slice(-2);
        return `${day}/${month}/${year}`;
    } catch {
        return dateString;
    }
};

export default () => {
    const { user } = useAuth();

    const [tableData, setTableData] = useState<StoreInPendingData[]>([]);
    const [historyData, setHistoryData] = useState<StoreInHistoryData[]>([]);
    const [selectedIndent, setSelectedIndent] = useState<StoreInPendingData | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [searchTermLocation, setSearchTermLocation] = useState('');
    const [indentLoading, setIndentLoading] = useState(false);
    const [receivedLoading, setReceivedLoading] = useState(false);
    const [storeInRecords, setStoreInRecords] = useState<StoreInRecord[]>([]);
    const [locationOptions, setLocationOptions] = useState<string[]>(["store"]);

    // Fetch all data from Supabase
    useEffect(() => {
        const fetchAllData = async () => {
            setIndentLoading(true);
            setReceivedLoading(true);
            try {
                const [storeIns, locations] = await Promise.all([
                    fetchStoreInRecords(),
                    fetchLocationOptions(),
                ]);

                setStoreInRecords(storeIns);
                setLocationOptions(locations);
            } catch (error) {
                console.error('Failed to fetch data:', error);
                toast.error('Failed to load data');
            } finally {
                setIndentLoading(false);
                setReceivedLoading(false);
            }
        };

        fetchAllData();
    }, []);

    // Process pending table data
    useEffect(() => {
        const filteredByFirm = storeInRecords.filter((item) =>
            user.firmNameMatch.toLowerCase() === "all" || item.firmNameMatch === user.firmNameMatch
        );

        setTableData(
            filteredByFirm
                .filter((i) => i.planned6 !== '' && i.actual6 === '' && i.billStatus === 'Bill Received')
                .map((i) => ({
                    liftNumber: i.liftNumber || '',
                    indentNo: i.indentNo || '',
                    billNo: String(i.billNo) || '',
                    vendorName: i.vendorName || '',
                    productName: i.productName || '',
                    qty: i.qty || 0,
                    typeOfBill: i.typeOfBill || '',
                    billAmount: i.billAmount || 0,
                    amount: i.amount || 0,
                    paymentType: i.paymentType || '',
                    advanceAmountIfAny: Number(i.advanceAmountIfAny) || 0,
                    photoOfBill: i.photoOfBill || '',
                    transportationInclude: i.transportationInclude || '',
                    transporterName: i.transporterName || '',
                    poDate: i.poDate || '',
                    poNumber: i.poNumber || '',
                    vendor: i.vendor || '',
                    indentNumber: i.indentNumber || '',
                    product: i.product || '',
                    uom: i.uom || '',
                    poCopy: i.poCopy || '',
                    billStatus: i.billStatus || '',
                    leadTimeToLiftMaterial: i.leadTimeToLiftMaterial || 0,
                    discountAmount: i.discountAmount || 0,
                    firmNameMatch: i.firmNameMatch || '',
                    planned6Date: i.planned6 || '',
                    timestamp: i.timestamp || '',
                }))
        );
    }, [storeInRecords, user.firmNameMatch]);

    // Process history data
    useEffect(() => {
        const filteredByFirm = storeInRecords.filter((item) =>
            user.firmNameMatch.toLowerCase() === "all" || item.firmNameMatch === user.firmNameMatch
        );

        setHistoryData(
            filteredByFirm
                .filter((i) => i.actual6 !== '')
                .map((i) => ({
                    liftNumber: i.liftNumber || '',
                    indentNo: i.indentNo || '',
                    billNo: String(i.billNo) || '',
                    vendorName: i.vendorName || '',
                    productName: i.productName || '',
                    qty: i.qty || 0,
                    typeOfBill: i.typeOfBill || '',
                    billAmount: i.billAmount || 0,
                    paymentType: i.paymentType || '',
                    advanceAmountIfAny: Number(i.advanceAmountIfAny) || 0,
                    photoOfBill: i.photoOfBill || '',
                    transportationInclude: i.transportationInclude || '',
                    transporterName: i.transporterName || '',
                    amount: i.amount || 0,
                    billStatus: i.billStatus || '',
                    receivedQuantity: i.receivedQuantity || 0,
                    photoOfProduct: i.photoOfProduct || '',
                    unitOfMeasurement: i.unitOfMeasurement || '',
                    damageOrder: i.damageOrder || '',
                    quantityAsPerBill: Number(i.quantityAsPerBill) || 0,
                    priceAsPerPo: i.priceAsPerPo || 0,
                    remark: i.remark || '',
                    poDate: i.poDate || '',
                    poNumber: i.poNumber || '',
                    receiveStatus: i.receivingStatus || '',
                    vendor: i.vendorName || '',
                    product: i.productName || '',
                    orderQuantity: i.qty || 0,
                    receivedDate: i.timestamp ? formatDateTime(parseCustomDate(i.timestamp)) : '',
                    warrantyStatus: '',
                    warrantyEndDate: '',
                    billNumber: i.billNumber || String(i.billNo) || '',
                    anyTransport: i.transportationInclude || '',
                    transportingAmount: i.amount || 0,
                    timestamp: i.timestamp ? formatDateTime(parseCustomDate(i.timestamp)) : '',
                    leadTimeToLiftMaterial: i.leadTimeToLiftMaterial || 0,
                    discountAmount: i.discountAmount || 0,
                    billReceived: i.billStatus || '',
                    billImage: i.photoOfBill || '',
                    firmNameMatch: i.firmNameMatch || '',
                    planned6Date: i.planned6 || '',
                }))
        );
    }, [storeInRecords, user.firmNameMatch]);

    const columns: ColumnDef<RecieveItemsData>[] = [
        ...(user.receiveItemView
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<RecieveItemsData> }) => {
                        const indent = row.original;
                        return (
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedIndent(indent);
                                    }}
                                >
                                    Store In
                                </Button>
                            </DialogTrigger>
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
        { accessorKey: 'liftNumber', header: 'Lift Number' },
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'poNumber', header: 'PO Number' },
        { accessorKey: 'vendorName', header: 'Vendor Name' },
        { accessorKey: 'productName', header: 'Product Name' },
        { accessorKey: 'firmNameMatch', header: 'Firm Name' },
        { accessorKey: 'billStatus', header: 'Bill Status' },
        { accessorKey: 'billNo', header: 'Bill No.' },
        { accessorKey: 'amount', header: 'Amount' },
        { accessorKey: 'billAmount', header: 'Bill Amount' },
        { accessorKey: 'discountAmount', header: 'Discount Amount' },
        { accessorKey: 'qty', header: 'Qty' },
        { accessorKey: 'leadTimeToLiftMaterial', header: 'Lead Time To Lift Material' },
        { accessorKey: 'typeOfBill', header: 'Type Of Bill' },
        { accessorKey: 'paymentType', header: 'Payment Type' },
        { accessorKey: 'advanceAmountIfAny', header: 'Advance Amount If Any' },
        {
            accessorKey: 'photoOfBill',
            header: 'Photo Of Bill',
            cell: ({ row }) => {
                const photo = row.original.photoOfBill;
                return photo ? (
                    <a href={photo} target="_blank" rel="noopener noreferrer">
                        View
                    </a>
                ) : null;
            },
        },
        { accessorKey: 'transportationInclude', header: 'Transportation Include' },
        { accessorKey: 'transporterName', header: 'Transporter Name' },
        {
            accessorKey: 'planned6Date',
            header: 'Planned Date',
            cell: ({ row }) => formatPlannedDate(row.original.planned6Date)
        },
    ];

    const historyColumns: ColumnDef<HistoryData>[] = [
        { accessorKey: 'timestamp', header: 'Timestamp' },
        { accessorKey: 'liftNumber', header: 'Lift Number' },
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'poNumber', header: 'PO Number' },
        { accessorKey: 'firmNameMatch', header: 'Firm Name' },
        { accessorKey: 'vendorName', header: 'Vendor Name' },
        { accessorKey: 'productName', header: 'Product Name' },
        { accessorKey: 'billStatus', header: 'Bill Status' },
        { accessorKey: 'billNo', header: 'Bill No.' },
        { accessorKey: 'qty', header: 'Qty' },
        { accessorKey: 'leadTimeToLiftMaterial', header: 'Lead Time To Lift Material' },
        { accessorKey: 'typeOfBill', header: 'Type Of Bill' },
        { accessorKey: 'billAmount', header: 'Bill Amount' },
        { accessorKey: 'discountAmount', header: 'Discount Amount' },
        { accessorKey: 'paymentType', header: 'Payment Type' },
        { accessorKey: 'advanceAmountIfAny', header: 'Advance Amount If Any' },
        {
            accessorKey: 'photoOfBill',
            header: 'Photo Of Bill',
            cell: ({ row }) => {
                const photo = row.original.photoOfBill;
                return photo ? (
                    <a href={photo} target="_blank" rel="noopener noreferrer">
                        View
                    </a>
                ) : null;
            },
        },
        { accessorKey: 'transportationInclude', header: 'Transportation Include' },
        { accessorKey: 'transporterName', header: 'Transporter Name' },
        { accessorKey: 'amount', header: 'Amount' },
        { accessorKey: 'receiveStatus', header: 'Receiving Status' },
        { accessorKey: 'receivedQuantity', header: 'Received Quantity' },
        {
            accessorKey: 'photoOfProduct',
            header: 'Photo Of Product',
            cell: ({ row }) => {
                const photo = row.original.photoOfProduct;
                return photo ? (
                    <a href={photo} target="_blank" rel="noopener noreferrer">
                        View
                    </a>
                ) : null;
            },
        },
        { accessorKey: 'warrantyStatus', header: 'Warranty' },
        { accessorKey: 'warrantyEndDate', header: 'End Date Warranty' },
        { accessorKey: 'billReceived', header: 'Bill Received' },
        { accessorKey: 'billNumber', header: 'Bill Number' },
        { accessorKey: 'billAmount', header: 'Bill Amount' },
        {
            accessorKey: 'billImage',
            header: 'Bill Image',
            cell: ({ row }) => {
                const photo = row.original.photoOfBill;
                return photo ? (
                    <a href={photo} target="_blank" rel="noopener noreferrer">
                        View
                    </a>
                ) : null;
            },
        },
        { accessorKey: 'damageOrder', header: 'Damage Order' },
        { accessorKey: 'quantityAsPerBill', header: 'Quantity As Per Bill' },
        { accessorKey: 'priceAsPerPo', header: 'Price As Per Po' },
        { accessorKey: 'remark', header: 'Remark' },
        {
            accessorKey: 'planned6Date',
            header: 'Planned Date',
            cell: ({ row }) => formatPlannedDate(row.original.planned6Date)
        },
    ];

    const schema = z.object({
        status: z.enum(['Received']),
        qty: z.coerce.number().min(1, 'Quantity is required'),
        photoOfProduct: z.instanceof(File, {
            message: "Photo of product is required"
        }),
        damageOrder: z.enum(['Yes', 'No']),
        quantityAsPerBill: z.enum(['Yes', 'No']),
        remark: z.string().optional(),
        location: z.string().optional(), // ✅ Location is now optional


    });

    type FormValues = z.infer<typeof schema>;

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            status: 'Received',
            qty: 0,
            photoOfProduct: undefined,
            damageOrder: undefined,
            quantityAsPerBill: undefined,
            remark: '',
            location: '', // ✅ Location in default values

        },
    });

    const status = form.watch('status');

    useEffect(() => {
        if (!openDialog) {
            form.reset({
                status: 'Received',
                qty: 0,
                photoOfProduct: undefined,
                damageOrder: undefined,
                quantityAsPerBill: undefined,
                remark: '',
                location: '', // ✅ Reset location field
            });
        }
    }, [openDialog, form]);

    async function onSubmit(values: FormValues) {
        try {
            let photoUrl = '';

            if (values.photoOfProduct) {
                photoUrl = await uploadProductPhoto(
                    values.photoOfProduct,
                    selectedIndent?.indentNo || ''
                );
                console.log('✅ Photo uploaded:', photoUrl);
            }

            const currentDateTime = new Date().toISOString();

            if (!selectedIndent?.liftNumber) {
                toast.error('No lift number found');
                return;
            }

            await updateStoreInReceiving(selectedIndent.liftNumber, {
                actual6: currentDateTime,
                receivingStatus: values.status,
                receivedQuantity: values.qty,
                photoOfProduct: photoUrl,
                damageOrder: values.damageOrder || '',
                quantityAsPerBill: values.quantityAsPerBill || '',
                remark: values.remark || '',
                location: values.location || '',
            });

            // ✅ FETCH STORE IN RECORD TO CHECK TRANSPORTATION
            try {
                const { data: storeInRecord, error: storeInError } = await supabase
                    .from('store_in')
                    .select('*')
                    .eq('lift_number', selectedIndent.liftNumber)
                    .maybeSingle();

                if (storeInError) console.warn('Error fetching store_in record:', storeInError);

                // ✅ IF TRANSPORTATION IS NOT INCLUDED ("No"), CREATE PAYMENT ENTRY
                // AND BILL TYPE IS NOT "common"
                if (storeInRecord && storeInRecord.transportation_include !== 'Yes' && storeInRecord.type_of_bill !== 'common') {
                    console.log('📝 Creating payment entry for Store In...');

                    // Fetch indent data to get PO info
                    const { data: indentData, error: indentError } = await supabase
                        .from('indent')
                        .select('po_number,approved_vendor_name,vendor_name,product_name')
                        .eq('indent_number', selectedIndent.indentNo)
                        .maybeSingle();

                    if (indentError) console.warn('Error fetching indent data:', indentError);

                    const poNumber = indentData?.po_number || selectedIndent.indentNo;
                    const vendorName = indentData?.approved_vendor_name || indentData?.vendor_name || selectedIndent.vendorName;
                    const productName = indentData?.product_name || selectedIndent.productName;

                    // Create payment entry
                    await createPaymentEntry({
                        indent_number: selectedIndent.indentNo,
                        vendor_name: vendorName,
                        po_number: poNumber,
                        bill_amount: storeInRecord.bill_amount || 0,
                        photo_of_bill: storeInRecord.photo_of_bill || '',
                        product_name: productName,
                        firm_name_match: user.firmNameMatch,
                    }, photoUrl);

                    toast.success('✅ Payment entry created for HOD approval');
                }
            } catch (paymentErr) {
                console.warn('⚠️ Error creating payment entry:', paymentErr);
                // Don't block the main operation if payment creation fails
            }

            toast.success(`Stored in successfully`);
            setOpenDialog(false);

            // Refresh data
            setTimeout(async () => {
                const storeIns = await fetchStoreInRecords();
                setStoreInRecords(storeIns);
            }, 1000);
        } catch (error) {
            console.error('Error in onSubmit:', error);
            toast.error('Failed to store in');
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
                        heading="Receive Items"
                        subtext="Receive items from purchase orders"
                        tabs
                    >
                        <Truck size={50} className="text-primary" />
                    </Heading>

                    <TabsContent value="pending">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={['productName', 'billNo', 'indentNo']}
                            dataLoading={indentLoading}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['productName', 'billNo', 'indentNo', 'vendorName']}
                            dataLoading={receivedLoading}
                        />
                    </TabsContent>
                </Tabs>

                {selectedIndent && (
                    <DialogContent className="sm:max-w-3xl">
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="space-y-5"
                            >
                                <DialogHeader className="space-y-1">
                                    <DialogTitle>Store In</DialogTitle>
                                    <DialogDescription>
                                        Store In from indent{' '}
                                        <span className="font-medium">
                                            {selectedIndent.indentNo}
                                        </span>
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="bg-muted p-4 rounded-md grid gap-3">
                                    <h3 className="text-lg font-bold">Item Details</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 bg-muted rounded-md gap-3 ">
                                        <div className="space-y-1">
                                            <p className="font-medium text-nowrap">Indent Number</p>
                                            <p className="text-sm font-light">
                                                {selectedIndent.indentNo}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Item Name</p>
                                            <p className="text-sm font-light">
                                                {selectedIndent.productName}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium text-nowrap">
                                                Lifiting Quantity
                                            </p>
                                            <p className="text-sm font-light">
                                                {selectedIndent.qty}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium text-nowrap">UOM</p>
                                            <p className="text-sm font-light">
                                                {selectedIndent.uom}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Receiving Status</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="text"

                                                        disabled={true}
                                                        readOnly
                                                        className="bg-gray-100 cursor-not-allowed"
                                                        {...field}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="qty"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Received Quantity</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="Enter received quantity"
                                                        disabled={status !== 'Received'}
                                                        {...field}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="photoOfProduct"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Photo of Product</FormLabel>
                                            <span className="text-destructive">*</span>
                                            <FormControl>
                                                <Input
                                                    type="file"
                                                    disabled={status !== 'Received'}
                                                    onChange={(e) =>
                                                        field.onChange(e.target.files?.[0])
                                                    }
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <div className="grid md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="damageOrder"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Damage Order</FormLabel>
                                                <FormControl>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Select" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Yes">Yes</SelectItem>
                                                            <SelectItem value="No">No</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="quantityAsPerBill"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Quantity As Per Bill</FormLabel>
                                                <FormControl>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Select" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Yes">Yes</SelectItem>
                                                            <SelectItem value="No">No</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {/* ✅ ADD DYNAMIC LOCATION DROPDOWN FROM MASTER SHEET */}
                                    <FormField
                                        control={form.control}
                                        name="location"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    Location
                                                </FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Select location" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {/* 🔍 Search Box for Locations */}
                                                        <div className="flex items-center border-b px-3 pb-3">
                                                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                            <input
                                                                placeholder="Search locations..."
                                                                value={searchTermLocation}
                                                                onChange={(e) => setSearchTermLocation(e.target.value)}
                                                                onKeyDown={(e) => e.stopPropagation()}
                                                                className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                            />
                                                        </div>
                                                        {/* ✅ Dynamic locations from Master sheet */}
                                                        {locationOptions
                                                            .filter((location: string) =>
                                                                location.toLowerCase().includes(searchTermLocation.toLowerCase())
                                                            )
                                                            .map((location, i) => (
                                                                <SelectItem key={i} value={location}>
                                                                    {location}
                                                                </SelectItem>
                                                            ))}
                                                        {/* Fallback if no locations */}
                                                        {locationOptions.length === 0 && (
                                                            <SelectItem value="no-locations" disabled>
                                                                No locations available
                                                            </SelectItem>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />


                                    <FormField
                                        control={form.control}
                                        name="remark"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Remark</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        className="w-full"
                                                        rows={3}
                                                        placeholder="Enter remark"
                                                        {...field}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>

                                    <Button type="submit" disabled={form.formState.isSubmitting}>
                                        {form.formState.isSubmitting && (
                                            <Loader
                                                size={20}
                                                color="white"
                                                aria-label="Loading Spinner"
                                            />
                                        )}
                                        Store In
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