import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    fetchStoreInRecords,
    fetchDirectRecords,
    updateStoreInHodApproval,
    createPaymentEntry,
    type StoreInRecord,
} from '@/services/storeInService';
import { supabase } from '@/lib/supabase';
import { createTallyEntryRecord } from '@/services/tallyEntryService';
import { useSheets } from '@/context/SheetsContext';

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
import { UserCheck, X, Package2, FileCheck, CheckCircle2, XCircle, AlertCircle, Gavel, CheckSquare, Truck } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDateTime, parseCustomDate } from '@/lib/utils';
import { Pill } from '../ui/pill';

interface HodPendingData {
    liftNumber: string;
    indentNo: string;
    vendorName: string;
    productName: string;
    qty: number;
    receivingStatus: string;
    receivedQuantity: number;
    damageOrder: string;
    quantityAsPerBill: string;
    priceAsPerPoCheck: string;
    remark: string;
    plannedHod: string;
    timestamp: string;
    firmNameMatch: string;
    poNumber: string;
    billAmount: number;
    photoOfBill: string;
    typeOfBill: string;
    transportationInclude: string;
    billNo?: string;
    paymentTerms: string;
    uom: string;
    vehicleNo: string;
    driverName: string;
    driverMobileNo: string;
    receiverName: string;
    challanNo: string;
    challanImage: string;
    billRemark: string;
    transporterName: string;
    freightAmount: number;
}

interface HodHistoryData {
    liftNumber: string;
    indentNo: string;
    vendorName: string;
    productName: string;
    qty: number;
    hodStatus: string;
    hodRemark: string;
    hodDate: string;
    firmNameMatch: string;
}

const schema = z.object({
    status: z.enum(['Approved', 'Rejected']),
    remark: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default () => {
    const { user } = useAuth();
    const { updateAll } = useSheets();
    const [storeInRecords, setStoreInRecords] = useState<StoreInRecord[]>([]);
    const [dataLoading, setDataLoading] = useState(false);
    const [pendingData, setPendingData] = useState<HodPendingData[]>([]);
    const [historyData, setHistoryData] = useState<HodHistoryData[]>([]);
    const [selectedItem, setSelectedItem] = useState<HodPendingData | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            status: undefined,
            remark: '',
        },
    });

    const fetchAllData = async () => {
        setDataLoading(true);
        try {
            const records = await fetchStoreInRecords();
            setStoreInRecords(records);
        } catch (error) {
            console.error('Failed to fetch store-in records:', error);
            toast.error('Failed to load data');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    useEffect(() => {
        const filteredByFirm = storeInRecords.filter((item) =>
            (user.firmNameMatch || '').trim().toLowerCase() === "all" || (item.firmNameMatch || '').trim() === (user.firmNameMatch || '').trim()
        );

        setPendingData(
            filteredByFirm
                .filter((i) => i.plannedHod !== '' && i.actualHod === '')
                .map((i) => ({
                    liftNumber: i.liftNumber || '',
                    indentNo: i.indentNo || '',
                    vendorName: i.vendorName || '',
                    productName: i.productName || '',
                    qty: Number(i.qty) || 0,
                    receivingStatus: i.receivingStatus || '',
                    receivedQuantity: Number(i.receivedQuantity) || 0,
                    damageOrder: i.damageOrder || '',
                    quantityAsPerBill: i.quantityAsPerBill || '',
                    priceAsPerPoCheck: i.priceAsPerPoCheck || '',
                    remark: i.remark || '',
                    plannedHod: i.plannedHod || '',
                    timestamp: i.timestamp || '',
                    firmNameMatch: i.firmNameMatch || '',
                    poNumber: i.poNumber || '',
                    billAmount: Number(i.billAmount) || 0,
                    photoOfBill: i.photoOfBill || '',
                    typeOfBill: i.typeOfBill || '',
                    transportationInclude: i.transportationInclude || '',
                    billNo: i.billNo || '',
                    paymentTerms: i.paymentTerms || '',
                    uom: i.unitOfMeasurement || '',
                    vehicleNo: i.vehicleNo || '',
                    driverName: i.driverName || '',
                    driverMobileNo: i.driverMobileNo || '',
                    receiverName: i.receiverName || '',
                    challanNo: i.challanNo || '',
                    challanImage: i.challanImage || '',
                    billRemark: i.billRemark || '',
                    transporterName: i.transporterName || '',
                    freightAmount: Number(i.amount) || 0,
                }))
        );

        setHistoryData(
            filteredByFirm
                .filter((i) => i.plannedHod !== '' && i.actualHod !== '')
                .map((i) => ({
                    liftNumber: i.liftNumber || '',
                    indentNo: i.indentNo || '',
                    vendorName: i.vendorName || '',
                    productName: i.productName || '',
                    qty: Number(i.qty) || 0,
                    hodStatus: i.hodStatus || '',
                    hodRemark: i.hodRemark || '',
                    hodDate: i.actualHod ? formatDateTime(new Date(i.actualHod)) : '',
                    firmNameMatch: i.firmNameMatch || '',
                }))
        );
    }, [storeInRecords, user.firmNameMatch]);

    async function onSubmit(values: FormValues) {
        if (!selectedItem || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const currentDateTime = new Date().toISOString();

            const triggerStage7 = values.status === 'Rejected';

            // Update standard store_in table
            await updateStoreInHodApproval(selectedItem.liftNumber, {
                actualHod: currentDateTime,
                hodStatus: values.status,
                hodRemark: values.remark || '',
                triggerStage7: triggerStage7
            });

            // ✅ Create Payment Entry ONLY if HOD approves
            if (values.status === 'Approved' && !triggerStage7) {
                // ✅ ONLY Insert into Payments if term is Advance-related
                const terms = (selectedItem.paymentTerms || '').toString().toLowerCase();
                const isAdvanceTerm = terms.includes('advance') || terms.includes('pi');

                if (isAdvanceTerm && selectedItem.transportationInclude !== 'Yes' && selectedItem.typeOfBill !== 'common') {
                    console.log('✅ Advance payment detected. Creating payment entry...');
                    await createPaymentEntry({
                        indent_number: selectedItem.indentNo,
                        vendor_name: selectedItem.vendorName || '',
                        po_number: selectedItem.poNumber || '',
                        bill_amount: selectedItem.billAmount || 0,
                        photo_of_bill: selectedItem.photoOfBill || '',
                        product_name: selectedItem.productName,
                        firm_name_match: selectedItem.firmNameMatch,
                        payment_terms: selectedItem.paymentTerms,
                    });
                }

                // ✅ ALSO: Create entry in Tally Entry (Audit Data) table
                try {
                    console.log('📝 Creating Audit Data entry from HOD Approval...');
                    const formattedDateOnly = currentDateTime.split('T')[0];
                    await createTallyEntryRecord({
                        timestamp: currentDateTime,
                        lift_number: selectedItem.liftNumber || '',
                        indent_number: selectedItem.indentNo || '',
                        po_number: selectedItem.poNumber || '',
                        material_in_date: formattedDateOnly,
                        product_name: selectedItem.productName || '',
                        bill_status: 'Bill Received',
                        qty: Number(selectedItem.receivedQuantity || selectedItem.qty || 0),
                        party_name: selectedItem.vendorName || '',
                        bill_amt: Number(selectedItem.billAmount || 0),
                        bill_image: selectedItem.photoOfBill || '',
                        bill_no: selectedItem.billNo || '',
                        planned1: formattedDateOnly, // Start Audit stage
                        firm_name_match: selectedItem.firmNameMatch || user?.firmNameMatch || '',
                    } as any);
                } catch (auditError) {
                    console.error('Failed to create audit entry during HOD Approval:', auditError);
                }
            }

            toast.success(`HOD ${values.status} for ${selectedItem.liftNumber}`);
            setOpenDialog(false);
            fetchAllData();
            updateAll(); // Refresh global sheets data to update Payment Status section
        } catch (error) {
            console.error('Error in onSubmit:', error);
            toast.error('Failed to update HOD approval');
        } finally {
            setIsSubmitting(false);
        }
    }

    const pendingColumns: ColumnDef<HodPendingData>[] = [
        {
            header: 'Action',
            cell: ({ row }) => (
                <DialogTrigger asChild>
                    <Button variant="outline" onClick={() => setSelectedItem(row.original)}>
                        Check
                    </Button>
                </DialogTrigger>
            ),
        },
        { accessorKey: 'liftNumber', header: 'Lift No.' },
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'billNo', header: 'Bill No.' },
        { accessorKey: 'productName', header: 'Product' },
        { accessorKey: 'vendorName', header: 'Vendor' },
        { accessorKey: 'qty', header: 'Lift Qty' },
        { accessorKey: 'receivedQuantity', header: 'Rec. Qty' },
        { accessorKey: 'vehicleNo', header: 'Vehicle No.' },
        { accessorKey: 'receiverName', header: 'Receiver' },
        {
            accessorKey: 'damageOrder',
            header: 'Physical Good?',
            cell: ({ getValue }) => {
                const val = getValue() as string;
                return (
                    <Pill variant={val === 'Yes' ? 'default' : 'reject'}>
                        {val || 'N/A'}
                    </Pill>
                );
            }
        },
    ];

    const historyColumns: ColumnDef<HodHistoryData>[] = [
        { accessorKey: 'liftNumber', header: 'Lift No.' },
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'productName', header: 'Product' },
        {
            accessorKey: 'hodStatus', header: 'HOD Status',
            cell: ({ getValue }) => {
                const val = (getValue() || '') as string;
                return (
                    <Pill variant={val === 'Approved' ? 'default' : 'reject'}>
                        {val}
                    </Pill>
                );
            }
        },
        { accessorKey: 'hodRemark', header: 'Remark' },
        { accessorKey: 'hodDate', header: 'Date' },
    ];

    return (
        <div>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending">
                    <Heading
                        heading="HOD Check"
                        subtext="Validate store receiving results"
                        tabs
                        pendingCount={pendingData.length}
                        historyCount={historyData.length}
                    >
                        <UserCheck size={50} className="text-primary" />
                    </Heading>

                    <TabsContent value="pending">
                        <DataTable data={pendingData} columns={pendingColumns} searchFields={['liftNumber', 'indentNo', 'productName']} dataLoading={dataLoading} />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable data={historyData} columns={historyColumns} searchFields={['liftNumber', 'indentNo', 'productName']} dataLoading={dataLoading} />
                    </TabsContent>
                </Tabs>

                {selectedItem && (
                    <DialogContent className="sm:max-w-2xl">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <DialogHeader className="border-b pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <UserCheck className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <DialogTitle className="text-xl font-black">HOD Approval Request</DialogTitle>
                                            <DialogDescription className="text-xs font-medium">Verify store receiving results for Lift #{selectedItem.liftNumber}</DialogDescription>
                                        </div>
                                    </div>
                                </DialogHeader>

                                <div className="space-y-6 py-4">
                                    {/* Record Information Section */}
                                    <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-4 shadow-sm">
                                        <div className="flex items-center gap-2 mb-4 border-b border-slate-200/50 pb-2">
                                            <Package2 className="w-4 h-4 text-slate-400" />
                                            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Record Information</h4>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Product Name</p>
                                                <p className="text-xs font-bold text-slate-900 line-clamp-1" title={selectedItem.productName}>{selectedItem.productName}</p>
                                                <p className="text-[9px] text-slate-500 font-medium">{selectedItem.uom}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Vendor Name</p>
                                                <p className="text-xs font-bold text-slate-900 line-clamp-1" title={selectedItem.vendorName}>{selectedItem.vendorName}</p>
                                            </div>
                                            <div className="space-y-1 text-right">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">PO & Bill No.</p>
                                                <p className="text-xs font-black text-primary">{selectedItem.poNumber}</p>
                                                <p className="text-[10px] font-bold text-slate-600">{selectedItem.billNo || 'No Bill'}</p>
                                            </div>
                                            <div className="space-y-1 text-right">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Bill Amount</p>
                                                <p className="text-sm font-black text-emerald-600">₹{selectedItem.billAmount.toLocaleString()}</p>
                                                {selectedItem.freightAmount > 0 && (
                                                    <p className="text-[9px] text-amber-600 font-bold">Freight: ₹{selectedItem.freightAmount.toLocaleString()}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Backstage Details Section */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Truck className="w-3 h-3 text-blue-500" />
                                                <h4 className="text-[9px] font-extrabold uppercase tracking-widest text-blue-600">Transport Details</h4>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-bold text-slate-400">Vehicle No.</span>
                                                    <span className="text-[10px] font-black text-slate-700">{selectedItem.vehicleNo || '-'}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-bold text-slate-400">Driver</span>
                                                    <span className="text-[10px] font-black text-slate-700">{selectedItem.driverName || '-'}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-bold text-slate-400">Driver Mob.</span>
                                                    <span className="text-[10px] font-black text-slate-700">{selectedItem.driverMobileNo || '-'}</span>
                                                </div>
                                                {selectedItem.transporterName && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[9px] font-bold text-slate-400">Transporter</span>
                                                        <span className="text-[10px] font-black text-slate-700">{selectedItem.transporterName}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bg-indigo-50/50 rounded-xl border border-indigo-100 p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <UserCheck className="w-3 h-3 text-indigo-500" />
                                                <h4 className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-600">Receiving Info</h4>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-bold text-slate-400">Receiver</span>
                                                    <span className="text-[10px] font-black text-slate-700">{selectedItem.receiverName || '-'}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-bold text-slate-400">Challan No.</span>
                                                    <span className="text-[10px] font-black text-slate-700">{selectedItem.challanNo || '-'}</span>
                                                </div>
                                                {selectedItem.challanImage && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[9px] font-bold text-slate-400">Challan</span>
                                                        <a href={selectedItem.challanImage} target="_blank" rel="noopener noreferrer" className="text-[9px] font-black text-blue-600 underline">View Image</a>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-bold text-slate-400">Bill Remark</span>
                                                    <span className="text-[9px] font-medium text-slate-600 italic line-clamp-1" title={selectedItem.billRemark}>{selectedItem.billRemark || '-'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Store Verification Section */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 px-1">
                                            <FileCheck className="w-4 h-4 text-amber-500" />
                                            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Store Verification Results</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div className={`p-3 rounded-xl border flex flex-col gap-1 ${selectedItem.damageOrder === 'No' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Physical Check</span>
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-xs font-black ${selectedItem.damageOrder === 'No' ? 'text-red-700' : 'text-slate-700'}`}>
                                                        {selectedItem.damageOrder === 'No' ? 'Damaged' : 'Good'}
                                                    </span>
                                                    {selectedItem.damageOrder === 'No' ? <XCircle className="w-3 h-3 text-red-500" /> : <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                                                </div>
                                            </div>
                                            <div className={`p-3 rounded-xl border flex flex-col gap-1 ${selectedItem.quantityAsPerBill === 'No' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Qty Matching</span>
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-xs font-black ${selectedItem.quantityAsPerBill === 'No' ? 'text-red-700' : 'text-slate-700'}`}>
                                                        {selectedItem.quantityAsPerBill === 'No' ? 'Mismatch' : 'Matches'}
                                                    </span>
                                                    {selectedItem.quantityAsPerBill === 'No' ? <XCircle className="w-3 h-3 text-red-500" /> : <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                                                </div>
                                            </div>
                                            <div className={`p-3 rounded-xl border flex flex-col gap-1 ${selectedItem.priceAsPerPoCheck === 'No' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Price Matching</span>
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-xs font-black ${selectedItem.priceAsPerPoCheck === 'No' ? 'text-red-700' : 'text-slate-700'}`}>
                                                        {selectedItem.priceAsPerPoCheck === 'No' ? 'Mismatch' : 'Matches'}
                                                    </span>
                                                    {selectedItem.priceAsPerPoCheck === 'No' ? <XCircle className="w-3 h-3 text-red-500" /> : <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-amber-50/50 rounded-xl border border-amber-100/50 p-3 mt-2">
                                            <div className="flex items-start gap-3">
                                                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Store Inspector Remarks</p>
                                                    <p className="text-xs text-amber-900 font-medium italic">"{selectedItem.remark || 'No specific remarks from store.'}"</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Section */}
                                    <div className="bg-white rounded-xl border p-4 space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Gavel className="w-4 h-4 text-primary" />
                                            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Your Decision</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="status"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-1">
                                                        <FormLabel className="text-[10px] font-bold uppercase text-slate-400 pl-1">Approval Decision</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="h-10 border-slate-200">
                                                                    <SelectValue placeholder="Select decision" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="Approved" className="text-emerald-600 font-bold">Approve</SelectItem>
                                                                <SelectItem value="Rejected" className="text-red-600 font-bold">Reject</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="remark"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-1">
                                                        <FormLabel className="text-[10px] font-bold uppercase text-slate-400 pl-1">Remarks</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Add your audit notes..." {...field} className="h-10 border-slate-200" />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <DialogFooter className="border-t pt-4">
                                    <DialogClose asChild>
                                        <Button variant="ghost" className="h-10 text-slate-500 font-semibold" disabled={isSubmitting}>Cancel</Button>
                                    </DialogClose>
                                    <Button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className={`h-10 px-8 font-black font-semibold transition-all shadow-md ${form.watch('status') === 'Rejected' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'}`}
                                    >
                                        {isSubmitting ? <Loader size={16} color="white" className="mr-2" /> : <CheckSquare className="w-4 h-4 mr-2" />}
                                        Finalize Approval
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
