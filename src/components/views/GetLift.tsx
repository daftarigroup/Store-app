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
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ShoppingCart, X, Truck, FileText, IndianRupee, CreditCard, User, Phone, CheckCircle2, Package, Info, Upload } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate, formatDateTime, parseCustomDate } from '@/lib/utils';
import { filterByFirmAccess } from '@/lib/firmAccess';
import {
    fetchIndentRecords,
    fetchStoreInRecords,
    fetchVendorOptions,
    insertStoreInRecord,
    updateCancelQuantity,
    uploadBillPhoto,
    updateActual5Timestamp,
    updateLiftingStatus,
    updatePendingLiftQty,
    type GetLiftIndentRecord,
    type GetLiftStoreInRecord,
} from '@/services/getLiftService';
import { createFullkittingEntry } from '@/services/fullkittingService';

interface GetPurchaseData {
    indentNo: string;
    firmNameMatch: string;
    firm_id?: number;
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
    // department?: string;
    areaOfUse?: string;
    approvedVendorName?: string;
    liftingStatus?: string;
    products?: string[];
    indentNumbers?: string[];
    expectedDate?: string;
    originalItems?: any[];
}

interface HistoryData {
    indentNo: string;
    firmNameMatch: string;
    firm_id?: number;
    vendorName: string;
    poNumber: string;
    poDate: string;
    deliveryDate: string;
    product?: string;
    photoOfBill?: string;
    quantity?: number;
    liftedQty?: number;
    pendingLiftQty?: number;
    receivedQty?: number;
    pendingPoQty?: number;
    cancelQty?: number;
    timestamp?: string;
    // department?: string;
    areaOfUse?: string;
    approvedVendorName?: string;
    liftingStatus?: string;
    products?: string[];
    indentNumbers?: string[];
    originalItems?: any[];
}

interface AuthUser {
    username?: string;
    firmNameMatch?: string;
    firm_access?: string[];
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
    const [loading, setLoading] = useState(false);
    const [indentRecords, setIndentRecords] = useState<GetLiftIndentRecord[]>([]);
    const [storeInRecords, setStoreInRecords] = useState<GetLiftStoreInRecord[]>([]);

    useEffect(() => {
        const fetchAllData = async () => {
            if (!user?.username) return;
            setLoading(true);
            try {
                const firms = user?.firm_access;
                const [vendors, indents, storeIns] = await Promise.all([
                    fetchVendorOptions(),
                    fetchIndentRecords(firms),
                    fetchStoreInRecords(firms),
                ]);

                setVendorOptions(vendors);
                setIndentRecords(indents);
                setStoreInRecords(storeIns);
            } catch (error) {
                console.error('Failed to fetch data:', error);
                toast.error('Failed to load data');
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, [user?.username]);

    // Process pending table data
    useEffect(() => {
        const filteredByFirm = filterByFirmAccess(indentRecords, user?.firm_access, {
            name: (r) => r.firmNameMatch,
            id: (r) => r.firm_id
        });
        const processedData = filteredByFirm
            .map((sheet) => {
                // Calculate received quantity from STORE IN records
                const receivedQty = (Number(sheet.receivedQuantity) || 0) + storeInRecords
                    .filter(
                        (store) =>
                            store.indentNo === sheet.indentNumber?.toString() &&
                            store.firmNameMatch === sheet.firmNameMatch &&
                            store.productName === sheet.productName
                    )
                    .reduce(
                        (sum, store) =>
                            sum + (Number(store.qty) || 0),
                        0
                    );

                const approvedQtySafe = Number(sheet.approvedQuantity) || Number(sheet.quantity) || 0;
                const cancelQtySafe = Number(sheet.cancelQty) || 0;
                const pendingPoQty = approvedQtySafe - receivedQty - cancelQtySafe;

                return { ...sheet, pendingPoQty, receivedQty, receivedQuantity: sheet.receivedQuantity };
            })
            .filter((item) => {
                // Lifting stage starts once the PO planned date exists
                const hasPlanned5 = item.planned5 && item.planned5.toString().trim() !== '';

                // ✅ Quantity is the single source of truth: keep showing while
                // anything remains to lift. lifting_status/actual5 are derived
                // flags and can drift (stale snapshot, refresh race, bad write) —
                // relying on them made rows vanish while qty was still pending.
                return hasPlanned5 && item.pendingPoQty > 0;
            });

        // Group by PO Number
        const groupedMap = new Map<string, any>();

        processedData.forEach((item) => {
            const key = item.poNumber || `NO_PO_${item.indentNumber}`;
            if (!groupedMap.has(key)) {
                groupedMap.set(key, {
                    indentNo: item.indentNumber?.toString() || '',
                    firmNameMatch: item.firmNameMatch || '',
                    firm_id: item.firm_id,
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
                    quantity: 0,
                    pendingLiftQty: 0,
                    receivedQty: 0,
                    pendingPoQty: 0,
                    approvedRate: item.approvedRate || '',
                    timestamp: item.timestamp || '',
                    // department: item.department || '',
                    areaOfUse: item.areaOfUse || '',
                    approvedVendorName: item.approvedVendorName || '',
                    liftingStatus: item.liftingStatus || '',
                    indentNumbers: [],
                    products: [],
                    expectedDate: item.expectedDate ? formatDate(parseCustomDate(item.expectedDate)) : '',
                    rawExpectedDate: item.expectedDate || null,
                    originalItems: []
                });
            }

            const group = groupedMap.get(key);
            if (!group.poDate && item.actual4) {
                group.poDate = formatDate(parseCustomDate(item.actual4));
            }
            group.quantity += Number(item.approvedQuantity) || 0;
            group.pendingLiftQty += item.pendingPoQty;
            group.receivedQty += item.receivedQty;
            group.pendingPoQty += item.pendingPoQty;
            group.indentNumbers.push(item.indentNumber);
            group.products.push(item.productName);
            group.originalItems.push(item);
        });

        const sortedData = Array.from(groupedMap.values()).sort((a, b) => {
            const timeA = a.timestamp ? parseCustomDate(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? parseCustomDate(b.timestamp).getTime() : 0;
            return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
        });

        setTableData(sortedData);
    }, [indentRecords, storeInRecords, user?.firm_access, user?.firmNameMatch]);

    // Process history data independently
    useEffect(() => {
        const firmIndents = filterByFirmAccess(indentRecords, user?.firm_access, {
            name: (r) => r.firmNameMatch,
            id: (r) => r.firm_id
        });

        const indentMap = new Map(
            firmIndents.map((sheet) => [
                `${sheet.indentNumber?.toString() || ''}_${sheet.firmNameMatch || ''}_${sheet.productName || ''}`,
                sheet
            ])
        );

        const firmStoreIn = filterByFirmAccess(storeInRecords, user?.firm_access, {
            name: (r) => r.firmNameMatch,
            id: (r) => r.firm_id
        })
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // Tracking cumulative totals per indent to show point-in-time history
        const cumulativeTotals = new Map<string, number>();

        const processedHistory = firmStoreIn.map((store) => {
            const key = `${store.indentNo || ''}_${store.firmNameMatch || ''}_${store.productName || ''}`;
            const indentMatch = indentMap.get(key);

            const approvedQty = Number(indentMatch?.approvedQuantity) || Number(indentMatch?.quantity) || 0;
            const currentTotal = (cumulativeTotals.get(key) || 0) + (Number(store.qty) || 0);
            cumulativeTotals.set(key, currentTotal);
            
            // Initial received quantity as a starting point if available
            const initialReceived = Number(indentMatch?.receivedQuantity) || 0;
            const runningReceived = initialReceived + currentTotal;
            // Subtract cancelled qty so History matches the Pending tab math
            const cancelQtySafe = Number(indentMatch?.cancelQty) || 0;
            const pendingAfterThisLift = Math.max(0, approvedQty - runningReceived - cancelQtySafe);

            return {
                indentNo: store.indentNo || '',
                firmNameMatch: store.firmNameMatch || '',
                firm_id: store.firm_id,
                vendorName: store.vendorName || indentMatch?.approvedVendorName || '-',
                poNumber: store.poNumber || indentMatch?.poNumber || '-',
                poDate: indentMatch?.actual4 ? formatDate(parseCustomDate(indentMatch.actual4)) : '-',
                deliveryDate: store.materialDate ? formatDate(parseCustomDate(store.materialDate)) : (indentMatch?.deliveryDate ? formatDate(parseCustomDate(indentMatch.deliveryDate)) : '-'),
                product: store.productName || indentMatch?.productName || '-',
                quantity: approvedQty,
                liftedQty: Number(store.qty) || 0, // NEW: Specific lift quantity
                pendingLiftQty: pendingAfterThisLift, // NEW: Remaining at that time
                receivedQty: runningReceived,
                pendingPoQty: pendingAfterThisLift,
                cancelQty: cancelQtySafe,
                photoOfBill: store.photoOfBill || '',
                timestamp: store.timestamp || '',
                // department: indentMatch?.department || '-',
                areaOfUse: indentMatch?.areaOfUse || '-',
                approvedVendorName: indentMatch?.approvedVendorName || '-',
                liftingStatus: indentMatch?.liftingStatus || 'Pending',
            };
        });

        // Sort by timestamp descending for the UI
        setHistoryData(processedHistory.reverse());
    }, [storeInRecords, indentRecords, user?.firm_access, user?.firmNameMatch]);

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
                                        onClick={() => setSelectedIndent(indent)}
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
            accessorKey: 'poNumber',
            header: 'PO Number',
            cell: ({ getValue }) => <div className="font-bold">{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'firmNameMatch',
            header: 'Project Name',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'vendorName',
            header: 'Approved Vendor Name',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'products',
            header: 'Products',
            cell: ({ row }) => {
                const products = row.original.products || [];
                return (
                    <div className="max-w-[200px] truncate" title={products.join(', ')}>
                        {products.length > 1 ? `${products[0]} (+${products.length - 1})` : products[0]}
                    </div>
                );
            }
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
            accessorKey: 'quantity',
            header: 'PO Qty',
            cell: ({ getValue }) => <div className="font-medium">{(getValue() as number) || 0}</div>,
        },
        {
            accessorKey: 'receivedQty',
            header: 'Lifting Qty',
            cell: ({ getValue }) => <div className="font-semibold text-primary">{(getValue() as number) || 0}</div>,
        },
        {
            accessorKey: 'pendingPoQty',
            header: 'Pending Qty',
            cell: ({ getValue }) => <div className="font-bold text-orange-600">{(getValue() as number) || 0}</div>,
        },
        {
            accessorKey: 'expectedDate',
            header: 'Expected Date',
            cell: ({ getValue }) => <div className="text-gray-900">{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'plannedDate',
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
            header: 'Project Name',
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
            accessorKey: 'product',
            header: 'Product',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'quantity',
            header: 'Approved Qty',
            cell: ({ getValue }) => <div>{(getValue() as number) || 0}</div>,
        },
        {
            accessorKey: 'liftedQty',
            header: 'Lifting Qty',
            cell: ({ getValue }) => <div className="font-semibold text-primary">{(getValue() as number) || 0}</div>,
        },
        {
            accessorKey: 'cancelQty',
            header: 'Cancelled Qty',
            cell: ({ getValue }) => <div className="font-medium text-destructive">{(getValue() as number) || 0}</div>,
        },
        {
            accessorKey: 'pendingLiftQty',
            header: 'Pending Qty',
            cell: ({ getValue }) => <div className="font-medium text-orange-600">{(getValue() as number) || 0}</div>,
        },
    ];

    // Creating form schema
    const formSchema = z.object({
        billStatus: z.string().min(1, 'Bill status is required'),
        deliveryDate: z.string().min(1, 'Delivery date is required'),
        billNo: z.string().optional(),
        qty: z.coerce.number().optional(),
        typeOfBill: z.string().optional(),
        billAmount: z.coerce.number().optional(),
        photoOfBill: z
            .any()
            .optional()
            .refine((file) => {
                if (!file) return true; // Optional field
                if (!(file instanceof File)) return true; // Accept other types (like string URL) if not a new file
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
        items: z.array(z.object({
            indentNo: z.string(),
            product: z.string(),
            poNumber: z.string(),
            firm_id: z.number().nullable().optional(),
            quantity: z.coerce.number(),
            pendingLiftQty: z.coerce.number(),
            receivedQty: z.coerce.number(),
            pendingPoQty: z.coerce.number(),
            approvedRate: z.union([z.string(), z.number()]),
            taxValue: z.coerce.number(),
            withTax: z.string(),
            liftQty: z.coerce.number().min(0, 'Lift quantity cannot be negative'),
            cancelQty: z.coerce.number().min(0, 'Cancel quantity cannot be negative').optional(),
            existingCancelQty: z.coerce.number(),
            uom: z.string().optional(),
        }))
    }).superRefine((data, ctx) => {
        // 1. Validate each item's quantity constraints
        let totalLiftQty = 0;
        let totalCancelQty = 0;

        data.items.forEach((item, index) => {
            const numericLiftQty = Number(item.liftQty) || 0;
            const numericCancelQty = Number(item.cancelQty) || 0;
            totalLiftQty += numericLiftQty;
            totalCancelQty += numericCancelQty;

            const totalChange = numericLiftQty + numericCancelQty;

            if (numericLiftQty > item.pendingLiftQty) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Lift quantity (${numericLiftQty}) cannot exceed pending quantity (${item.pendingLiftQty})`,
                    path: ['items', index, 'liftQty'],
                });
            }

            if (numericCancelQty > item.pendingLiftQty) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Cancel quantity (${numericCancelQty}) cannot exceed pending quantity (${item.pendingLiftQty})`,
                    path: ['items', index, 'cancelQty'],
                });
            }

            if (totalChange > item.pendingLiftQty && numericLiftQty <= item.pendingLiftQty && numericCancelQty <= item.pendingLiftQty) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Total (Lift: ${numericLiftQty} + Cancel: ${numericCancelQty}) cannot exceed Pending: ${item.pendingLiftQty}`,
                    path: ['items', index, 'liftQty'],
                });
            }
        });

        // 2. Ensure at least one item has some lift or cancel quantity
        if (totalLiftQty === 0 && totalCancelQty === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'At least one item must have a lift or cancel quantity greater than 0',
                path: ['items'],
            });
        }

        // 3. Bill / Challan validations
        if (data.billStatus) {
            if (!data.billNo || data.billNo.trim() === '') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: data.billStatus === 'Bill Received' ? 'Bill number is required' : 'Challan number is required',
                    path: ['billNo'],
                });
            }

            const hasFile = data.photoOfBill && (data.photoOfBill instanceof File);

            if (data.billStatus === 'Bill Received') {
                if (data.typeOfBill === 'independent' && !hasFile) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Bill attachment (image/PDF) is required',
                        path: ['photoOfBill'],
                    });
                }
                if (!data.billAmount || Number(data.billAmount) <= 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Bill amount must be greater than 0 when bill is received',
                        path: ['billAmount'],
                    });
                }
            } else if (data.billStatus === 'Bill Not Received') {
                if (!hasFile) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Challan image is required',
                        path: ['photoOfBill'],
                    });
                }
            }
        }

        // 4. Logistics validation
        if (data.typeOfBill === 'independent' && data.transportationInclude === 'Yes') {
            if (!data.transporterName || data.transporterName.trim() === '') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Transporter name is required',
                    path: ['transporterName'],
                });
            }
            if (!data.vehicleNo || data.vehicleNo.trim() === '') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Vehicle number is required',
                    path: ['vehicleNo'],
                });
            }
            if (data.amount === undefined || Number(data.amount) < 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Freight amount cannot be negative',
                    path: ['amount'],
                });
            }
            if (data.driverMobileNo && data.driverMobileNo.trim() !== '') {
                const cleanPhone = data.driverMobileNo.replace(/\D/g, '');
                if (cleanPhone.length < 10 || cleanPhone.length > 15) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Driver mobile number must be between 10 and 15 digits',
                        path: ['driverMobileNo'],
                    });
                }
            }
        }
    });

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any, // Add type assertion here
        mode: 'onChange',
        defaultValues: {
            billStatus: '',
            billNo: '',
            qty: 0,
            typeOfBill: 'independent',
            billAmount: 0,
            billRemark: '',
            vendorName: '',
            transportationInclude: 'Yes',
            transporterName: '',
            vehicleNo: '',
            driverName: '',
            driverMobileNo: '',
            amount: 0,
            cancelPendingQty: 0,
            deliveryDate: '',
            items: [],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items"
    });

    const billStatus = form.watch('billStatus');
    const typeOfBill = form.watch('typeOfBill');

    // Add this useEffect to set form values when selectedIndent changes
    useEffect(() => {
        if (selectedIndent) {
            // Use items from this PO only
            const allIndividualItems = selectedIndent.originalItems || [];

            form.reset({
                billStatus: '',
                deliveryDate: '',
                billNo: '',
                qty: selectedIndent.pendingLiftQty || 0,
                typeOfBill: 'independent',
                billAmount: 0,
                billRemark: '',
                vendorName: selectedIndent.vendorName || '',
                transportationInclude: 'No',
                transporterName: '',
                vehicleNo: '',
                driverName: '',
                driverMobileNo: '',
                amount: 0,
                cancelPendingQty: 0,
                items: allIndividualItems.map(item => ({
                    indentNo: item.indentNumber?.toString() || '',
                    product: item.productName || '',
                    poNumber: item.poNumber || '',
                    firm_id: item.firm_id ?? null,
                    quantity: Number(item.approvedQuantity) || 0,
                    pendingLiftQty: Number(item.pendingPoQty) || 0,
                    receivedQty: Number(item.receivedQty) || 0,
                    pendingPoQty: Number(item.pendingPoQty) || 0,
                    approvedRate: item.approvedRate || '0',
                    taxValue: Number(item.taxValue) || 0,
                    withTax: item.withTax || 'No',
                    liftQty: 0,
                    cancelQty: 0,
                    existingCancelQty: Number(item.cancelQty) || 0,
                    uom: item.uom || '',
                })),
            });

            setVendorSearch('');
        }
    }, [selectedIndent, form, tableData]);

    const typeOfBillWatcher = useWatch({ control: form.control, name: 'typeOfBill' }) || 'independent';
    const itemsWatcher = useWatch({ control: form.control, name: 'items' }) || [];

    const calculateTotalAmount = (items: any[]) => {
        return (items || []).reduce((sum: number, item: any) => {
            const qty = Number(item.liftQty) || 0;
            const rate = parseFloat(String(item.approvedRate).replace(/[^0-9.-]/g, '')) || 0;
            const tax = Number(item.taxValue) || 0;
            const withTax = item.withTax || 'No';
            const effectiveRate = withTax === 'No' ? rate * (1 + tax / 100) : rate;
            return sum + (qty * effectiveRate);
        }, 0);
    };

    const currentCalculatedTotal = calculateTotalAmount(itemsWatcher);

    useEffect(() => {
        form.setValue('billAmount', Number(currentCalculatedTotal.toFixed(2)));
    }, [currentCalculatedTotal, form]);

    const handleOpenChange = (open: boolean) => {
        setOpenDialog(open);
        if (!open) {
            setSelectedIndent(null);
            form.reset();
        }
    };

    async function onSubmit() {
        const values = form.getValues();
        const roundedBillAmount = Number((Number(values.billAmount) || 0).toFixed(2));
        try {
            // Form is already validated by Zod at this stage

            // Handle cancel pending quantity first (independent of bill status)
            // Cancel quantity is now handled per-item in the loop below


            if (values.billStatus && values.items) {
                let photoUrl = '';
                if (values.photoOfBill) {
                    try {
                        photoUrl = await uploadBillPhoto(values.photoOfBill, selectedIndent?.indentNo || '');
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

                // Process each item in the product list
                for (const item of values.items) {
                    const liftQty = Number(item.liftQty) || 0;
                    const cancelQty = Number(item.cancelQty) || 0;

                    const itemFirmId = item.firm_id ?? selectedIndent?.firm_id ?? null;

                    if (cancelQty > 0) {
                        const existingCancelQty = Number(item.existingCancelQty) || 0;
                        await updateCancelQuantity(item.indentNo, item.product, existingCancelQty + cancelQty, itemFirmId);
                    }

                    if (liftQty > 0 && values.billStatus) {
                        const newStoreInRecord = {
                            timestamp: currentDateTime,
                            indentNo: item.indentNo,
                            billNo: values.billNo || '',
                            vendorName: values.vendorName || selectedIndent?.vendorName || '',
                            productName: item.product || '',
                            qty: liftQty,
                            discountAmount: 0,
                            typeOfBill: values.typeOfBill || '',
                            billAmount: roundedBillAmount,
                            paymentType: '',
                            advanceAmountIfAny: 0,
                            photoOfBill: photoUrl,
                            transportationInclude: values.transportationInclude || '',
                            transporterName: values.transporterName || '',
                            amount: Number(values.amount) || 0,
                            billStatus: values.billStatus === 'Bill Not Received' ? 'Not Received' : values.billStatus,
                            quantityAsPerBill: liftQty,
                            poDate: selectedIndent?.poDate || '',
                            poNumber: item.poNumber || '',
                            vendor: values.vendorName || selectedIndent?.vendorName || '',
                            indentNumber: item.indentNo,
                            product: item.product || '',
                            quantity: liftQty,
                            uom: item.uom || '',
                            vehicleNo: values.vehicleNo || '',
                            driverName: values.driverName || '',
                            driverMobileNo: values.driverMobileNo || '',
                            billRemark: values.billRemark || '',
                            firmNameMatch: selectedIndent?.firmNameMatch || user?.firmNameMatch || '',
                            firm_id: selectedIndent?.firm_id || null,
                            rate: String(item.approvedRate || ''),
                            // department: selectedIndent?.department || '',
                            areaOfUse: selectedIndent?.areaOfUse || '',
                            approvedVendorName: selectedIndent?.approvedVendorName || '',
                            liftingStatus: selectedIndent?.liftingStatus || '',
                            notBillReceivedNo: values.billStatus === 'Bill Not Received' ? values.billNo : '',
                            challanNo: values.billStatus === 'Bill Not Received' ? values.billNo : '',
                            challanImage: values.billStatus === 'Bill Not Received' ? photoUrl : '',
                            materialDate: values.deliveryDate || null,
                        };

                        await insertStoreInRecord(newStoreInRecord);
                        await updatePendingLiftQty(item.indentNo, item.product, liftQty, itemFirmId);
                    }

                    // Mark complete only when nothing remains to lift or cancel.
                    // Note: these flags are informational only — the Pending tab
                    // derives visibility from quantities, never from these flags.
                    const remaining = (item.pendingLiftQty) - (liftQty + cancelQty);
                    if (remaining <= 0 && (liftQty > 0 || cancelQty > 0)) {
                        await updateLiftingStatus(item.indentNo, item.product, 'Complete', itemFirmId);
                        await updateActual5Timestamp(item.indentNo, item.product, itemFirmId);
                    }
                }

                // Create one fullkitting entry per lifted product so freight appears in
                // Pending immediately after lifting — and per-product records allow the
                // duplicate check (indent_number + product_name + bill_no) to work correctly.
                if (values.transportationInclude === 'Yes') {
                    const liftedItems = values.items.filter(item => (Number(item.liftQty) || 0) > 0);
                    for (const liftedItem of liftedItems) {
                        await createFullkittingEntry({
                            timestamp: currentDateTime,
                            indent_number: liftedItem.indentNo,
                            vendor_name: values.vendorName || selectedIndent?.vendorName || '',
                            product_name: liftedItem.product,
                            qty: Number(liftedItem.liftQty) || 0,
                            bill_no: values.billNo || '',
                            transporter_name: values.transporterName || '',
                            amount: Number(values.amount) || 0,
                            vehicle_no: values.vehicleNo || '',
                            driver_name: values.driverName || '',
                            driver_mobile_no: values.driverMobileNo || '',
                            firm_name: selectedIndent?.firmNameMatch || '',
                            firm_id: selectedIndent?.firm_id || null,
                        });
                    }
                }

                toast.success(`Created store records for PO: ${selectedIndent?.poNumber}`);
            }

            setOpenDialog(false);
            form.reset();

            setTimeout(async () => {
                const firms = user?.firm_access;
                const [indents, storeIns] = await Promise.all([
                    fetchIndentRecords(firms),
                    fetchStoreInRecords(firms),
                ]);
                setIndentRecords(indents);
                setStoreInRecords(storeIns);
            }, 1500);
        } catch (error) {
            console.error('❌ Error in onSubmit:', error);
            toast.error('Failed to process request. Please try again.');
        }
    }

    function onError(e: any) {
        console.error('Form validation errors:', e);
        
        // Extract field names from errors
        const errorFields = Object.keys(e).map(field => {
            // Make field names more readable
            return field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1');
        });

        if (errorFields.length > 0) {
            toast.error(`Please fill required fields: ${errorFields.join(', ')}`);
        } else {
            toast.error('Please fill all required fields correctly');
        }
    }

    return (
        <div>
            <Dialog open={openDialog} onOpenChange={handleOpenChange}>
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
                        style={{ maxWidth: '95vw', width: '90vw' }}
                    >
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="space-y-6"
                            >
                                <DialogHeader className="space-y-1">
                                    <DialogTitle className="text-xl font-bold flex items-center justify-between w-full border-b pb-3 mb-2">
                                        <div className="flex items-center gap-2 text-primary">
                                            <ShoppingCart size={22} />
                                            <span>Update Purchase Details</span>
                                        </div>
                                    </DialogTitle>
                                </DialogHeader>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-muted/50 p-4 rounded-xl border shadow-sm">
                                    {[
                                        ["Indent Number", selectedIndent.indentNo],
                                        ["PO Number", selectedIndent.poNumber],
                                        ["Approved Vendor Name", selectedIndent.vendorName || "-"],
                                    ].map(([label, value]) => (
                                        <div key={label} className="space-y-1">
                                            <p className="text-xs text-muted-foreground">{label}</p>
                                            <p className="text-sm font-medium">{value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Product List Table */}
                                {(form.formState.errors.items as any)?.message && (
                                    <div className="bg-destructive/10 text-destructive text-sm font-semibold p-3 rounded-lg border border-destructive/20 mb-2 flex items-center gap-2">
                                        <Info size={16} />
                                        <span>{(form.formState.errors.items as any).message}</span>
                                    </div>
                                )}
                                <div className="border rounded-xl overflow-x-auto overflow-y-auto shadow-sm max-h-[400px]">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50 border-b sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold bg-muted">Product</th>
                                                <th className="px-4 py-3 text-right font-semibold bg-muted">Rate</th>
                                                <th className="px-4 py-3 text-right font-semibold bg-muted">Tax %</th>
                                                <th className="px-4 py-3 text-right font-semibold bg-muted">Eff. Rate</th>
                                                <th className="px-4 py-3 text-right font-semibold bg-muted">Pending Qty</th>
                                                <th className="px-4 py-3 text-right font-semibold w-32 bg-muted">Lift Qty</th>
                                                <th className="px-4 py-3 text-right font-semibold w-32 bg-muted">Cancel Qty</th>
                                                <th className="px-4 py-3 text-right font-semibold bg-muted">Amount</th>
                                                <th className="px-4 py-3 text-center font-semibold w-16 bg-muted">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {fields.map((field, index) => {
                                                const rate = parseFloat(String(field.approvedRate).replace(/[^0-9.-]/g, '')) || 0;
                                                const tax = Number(field.taxValue) || 0;
                                                const withTax = field.withTax || 'No';
                                                const effectiveRate = withTax === 'No' ? rate * (1 + tax / 100) : rate;
                                                const liftQty = Number(itemsWatcher?.[index]?.liftQty) || 0;
                                                const amount = effectiveRate * liftQty;
                                                return (
                                                    <tr key={field.id} className="hover:bg-muted/20 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium">{field.product}</div>
                                                            <div className="text-[10px] text-muted-foreground">PO: {field.poNumber} | Indent: {field.indentNo}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                                                            ₹ {rate.toLocaleString()}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-muted-foreground">
                                                            {tax}%
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-primary whitespace-nowrap font-medium">
                                                            ₹ {effectiveRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            {field.pendingLiftQty}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <FormField
                                                                control={form.control}
                                                                name={`items.${index}.liftQty`}
                                                                render={({ field: inputField }) => (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <Input
                                                                                type="number"
                                                                                value={inputField.value ?? ''}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                                                                                    inputField.onChange(val);
                                                                                }}
                                                                                className={`h-9 text-right ${form.formState.errors.items?.[index]?.liftQty ? 'border-destructive' : ''}`}
                                                                                max={field.pendingLiftQty}
                                                                            />
                                                                        </FormControl>
                                                                        <FormMessage className="text-[10px] m-0" />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <FormField
                                                                control={form.control}
                                                                name={`items.${index}.cancelQty`}
                                                                render={({ field: inputField }) => (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <Input
                                                                                type="number"
                                                                                value={inputField.value ?? ''}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                                                                                    inputField.onChange(val);
                                                                                }}
                                                                                className={`h-9 text-right ${form.formState.errors.items?.[index]?.cancelQty ? 'border-destructive' : ''}`}
                                                                                max={field.pendingLiftQty}
                                                                            />
                                                                        </FormControl>
                                                                        <FormMessage className="text-[10px] m-0" />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-primary">
                                                            ₹ {amount.toLocaleString()}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => remove(index)}
                                                            >
                                                                <X size={16} />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-muted/30 font-bold border-t">
                                            <tr>
                                                <td className="px-4 py-3 text-left" colSpan={5}>Totals</td>
                                                <td className="px-4 py-3 text-right border-x">
                                                    {itemsWatcher?.reduce((sum, item) => sum + (Number(item.liftQty) || 0), 0) || 0}
                                                </td>
                                                <td className="px-4 py-3 text-right text-primary" colSpan={2}>
                                                    ₹ {currentCalculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>



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
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="deliveryDate"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Delivery Date *</FormLabel>
                                                    <FormControl>
                                                        <Input type="date" {...field} className="h-11" />
                                                    </FormControl>
                                                    <FormMessage />
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
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        )}

                                        {billStatus === "Bill Not Received" && (
                                            <>
                                                <FormField
                                                    control={form.control}
                                                    name="billNo"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Challan Number *</FormLabel>
                                                            <FormControl>
                                                                <Input {...field} className="h-11" placeholder="Enter challan #" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="photoOfBill"
                                                    render={({ field: { value, onChange, ...field } }) => (
                                                        <FormItem>
                                                            <FormLabel>Challan Image *</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="file"
                                                                    accept="image/*,.pdf"
                                                                    onChange={(e) => onChange(e.target.files?.[0])}
                                                                    {...field}
                                                                    className="h-11 file:bg-primary/10 file:text-primary file:border-0 file:rounded-md cursor-pointer"
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </>
                                        )}

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
                                                                    <FormMessage />
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
                                                                            <FormMessage />
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
                                                                            <FormMessage />
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
                                                                            <FormMessage />
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
                                                                            <FormMessage />
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
                                                                            <FormMessage />
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
                                                                        <Input
                                                                            type="number"
                                                                            step="0.01"
                                                                            {...field}
                                                                            value={field.value || 0}
                                                                            onBlur={(e) => {
                                                                                field.onBlur();
                                                                                const rounded = Number((Number(e.target.value) || 0).toFixed(2));
                                                                                field.onChange(rounded);
                                                                            }}
                                                                            className="h-11 font-semibold"
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
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
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    {typeOfBill === "independent" && billStatus !== "Bill Not Received" && (
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
                                                                    <FormMessage />
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
                                    <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Close</Button>

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
