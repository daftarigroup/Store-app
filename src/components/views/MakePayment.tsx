import { FileText, Building, DollarSign, CheckCircle, AlertCircle, ExternalLink, CheckSquare, XSquare, History } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import type { ColumnDef, Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useAuth } from '@/context/AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { uploadFile } from '@/lib/fetchers';
import { toast } from 'sonner';
import { Checkbox } from '../ui/checkbox';
import { formatDate, formatDateTime as formatTimestamp } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Input } from "../ui/input";
import { uploadPaymentImage } from '@/services/storeInService';

interface PaymentsRecord {
    rowIndex?: number;
    timestamp?: string;
    uniqueNo?: string;
    partyName?: string;
    poNumber?: string;
    totalPoAmount?: string | number;
    internalCode?: string;
    product?: string;
    deliveryDate?: string;
    paymentTerms?: string;
    numberOfDays?: string | number;
    pdf?: string;
    payAmount?: string | number;
    file?: string;
    remark?: string;
    totalPaidAmount?: string | number;
    outstandingAmount?: string | number;
    status?: string;
    planned?: string;
    actual?: string;
    delay?: string;
    status1?: string;
    paymentForm?: string;
    firmNameMatch?: string;
    paymentDone?: boolean;
    billImageStatus?: string;
    billNo?: string;
    rowIds?: number[];
}

interface PaymentHistoryRecord {
    rowIndex?: number;
    timestamp?: string;
    apPaymentNumber?: string;  // Column B (AP-Payment Number)
    status?: string;
    uniqueNumber?: string;
    fmsName?: string;
    payTo?: string;
    amountToBePaid?: string | number;
    remarks?: string;
    anyAttachments?: string;
}

interface DisplayPayment {
    rowIndex: number;
    uniqueNo: string;
    partyName: string;
    poNumber: string;
    totalPoAmount: number;
    internalCode: string;
    product: string;
    deliveryDate: string;
    paymentTerms: string;
    numberOfDays: number;
    pdf: string;
    payAmount: number;
    file: string;
    remark: string;
    totalPaidAmount: number;
    outstandingAmount: number;
    status: string;
    planned: string;
    actual: string;
    delay: string;
    status1: string;
    paymentForm: string;
    firmNameMatch: string;
    billImageStatus?: string;
    billNo?: string;
    rowIds: number[];
}

interface DisplayPaymentHistory {
    rowIndex: number;
    timestamp: string;
    apPaymentNumber: string;
    status: string;
    uniqueNumber: string;
    fmsName: string;
    payTo: string;
    amountToBePaid: number;
    remarks: string;
    anyAttachments: string;
    planned: string;
    paymentTerms: string;
    billImage: string;
    poImage: string;
    billImageStatus?: string;
    indentNo: string;
    poNumber: string;
    vendorName: string;
    productName: string;
    billNo: string;
    timestamp1: string;
}

interface UpdatePayload {
    rowIndex: number;
    actual: string;
    status: string;
    status1: string;
}

export default function MakePayment() {
    const { user } = useAuth();
    const [paymentsLoading, setPaymentsLoading] = useState(false);
    const [paymentsSheet, setPaymentsSheet] = useState<PaymentsRecord[]>([]);
    const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false);
    const [paymentHistorySheet, setPaymentHistorySheet] = useState<PaymentHistoryRecord[]>([]);
    const [reloadKey, setReloadKey] = useState(0);
    const updateAll = () => setReloadKey(k => k + 1);
    const [pendingData, setPendingData] = useState<DisplayPayment[]>([]);
    const [historyData, setHistoryData] = useState<DisplayPaymentHistory[]>([]);
    const [storeInRecords, setStoreInRecords] = useState<any[]>([]); // To store full metadata
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [originalData, setOriginalData] = useState<PaymentsRecord[]>([]);
    const [activeTab, setActiveTab] = useState('pending');
    
    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedPaymentItem, setSelectedPaymentItem] = useState<DisplayPayment | null>(null);
    const [paymentModalStatus, setPaymentModalStatus] = useState('Paid');
    const [paymentModalRemark, setPaymentModalRemark] = useState('');
    const [paymentModalAmount, setPaymentModalAmount] = useState<number | string>('');
    const [paymentModalFile, setPaymentModalFile] = useState<File | null>(null);

    const [stats, setStats] = useState({
        total: 0,
        totalAmount: 0,
        pendingCount: 0,
        historyCount: 0
    });

    const parseDateHelper = (dateString: string): Date => {
        if (!dateString) return new Date(0);
        try {
            // Try Standard Parsing
            let date = new Date(dateString);
            if (!isNaN(date.getTime())) return date;

            // Try DD/MM/YYYY
            const parts = dateString.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
                date = new Date(year, month, day);
                if (!isNaN(date.getTime())) return date;
            }

            // Try YYYY-MM-DD
            date = new Date(dateString.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));
            if (!isNaN(date.getTime())) return date;

            return new Date(0);
        } catch {
            return new Date(0);
        }
    };

    useEffect(() => {
        // fetch payments and payment_history from Supabase
        const fetchData = async () => {
            try {
                setPaymentsLoading(true);
                setPaymentHistoryLoading(true);

                const { data: paymentsData, error: paymentsError } = await supabase
                    .from('payments')
                    .select('*')
                    .order('id', { ascending: false });

                const { data: storeInData, error: storeInError } = await supabase
                    .from('store_in')
                    .select('*')
                    .order('indent_no', { ascending: false }); // Get all columns for history insertion

                const { data: historyDbData, error: historyDbError } = await supabase
                    .from('payment_history')
                    .select('*')
                    .order('id', { ascending: false });

                if (paymentsError) {
                    console.error('Error fetching payments:', paymentsError);
                }

                const storeInMap = new Map();
                if (storeInData) {
                    setStoreInRecords(storeInData);
                    storeInData.forEach((item: any) => {
                        const indentKey = item.indent_no || item.indent_number || '';
                        if (indentKey) {
                            storeInMap.set(indentKey, {
                                billImageStatus: item.bill_image_status || '',
                                billNo: item.bill_no || ''
                            });
                        }
                    });
                }

                const allPaymentsData = Array.isArray(paymentsData) ? paymentsData : [];

                const mappedPayments: PaymentsRecord[] = allPaymentsData.map((r: any) => ({
                    rowIndex: r.id,
                    timestamp: r.timestamp,
                    uniqueNo: r.unique_no,
                    partyName: r.party_name,
                    poNumber: r.po_number,
                    totalPoAmount: r.total_po_amount,
                    internalCode: r.internal_code,
                    product: r.product,
                    deliveryDate: r.delivery_date,
                    paymentTerms: r.payment_terms,
                    numberOfDays: r.number_of_days,
                    pdf: r.pdf,
                    payAmount: r.pay_amount,
                    file: r.file,
                    remark: r.remark,
                    totalPaidAmount: r.total_paid_amount,
                    outstandingAmount: r.outstanding_amount,
                    status: r.status,
                    planned: r.planned,
                    actual: r.actual,
                    delay: r.delay,
                    paymentForm: r.payment_form,
                    firmNameMatch: r.firm_name,
                    paymentDone: r.payment_done || false,
                    billImageStatus: storeInMap.get(r.internal_code)?.billImageStatus || '',
                    billNo: storeInMap.get(r.internal_code)?.billNo || '',
                    rowIds: [r.id],
                }));

                setOriginalData(mappedPayments);
                setPaymentsSheet(mappedPayments);

                const permittedFirms = (user?.firm_access || []).map((f: string) => f.trim().toLowerCase());
                const hasAllAccess = permittedFirms.includes('all');

                // Filter Pending: Has planned date, status is not 'Completed', and firm access matches
                const pendingBasic = mappedPayments
                    .filter((sheet: PaymentsRecord) => {
                        // Firm Access Filter
                        const itemFirm = (sheet.firmNameMatch || '').trim().toLowerCase();
                        const hasFirmAccess = hasAllAccess || permittedFirms.includes(itemFirm);
                        if (!hasFirmAccess) return false;
                        const status = String(sheet?.status || '').toLowerCase();
                        const isCompleted = status === 'completed';

                        // Check payment terms: Show if term contains advance or PI (any variant)
                        const terms = String(sheet?.paymentTerms || '').toLowerCase();
                        const isAdvanceTerm = terms.includes('advance') || terms.includes('pi');

                        // Check linked Store In for HOD status: Only show if Approved
                        const linkedStoreIn = (storeInData || []).find((s: any) =>
                            (s.indent_no || s.indent_number) === (sheet.internalCode)
                        );
                        if (linkedStoreIn && (linkedStoreIn.hod_status || linkedStoreIn.hodStatus) !== 'Approved') {
                             return false;
                        }

                        return !isCompleted;
                    });

                // Filter to show only the latest record for each Indent Number and Product
                const seenPending = new Set();
                const latestPending = [];
                for (const record of pendingBasic) {
                    const key = `${record.internalCode}-${record.product}`;
                    if (!seenPending.has(key)) {
                        seenPending.add(key);
                        latestPending.push(record);
                    }
                }

                const pendingItems: DisplayPayment[] = latestPending.map((sheet: PaymentsRecord, index) => ({
                    rowIndex: sheet?.rowIndex || index,
                    uniqueNo: sheet?.uniqueNo || '',
                    partyName: sheet?.partyName || '',
                    poNumber: sheet?.poNumber || '',
                    totalPoAmount: Number(sheet?.totalPoAmount || 0),
                    internalCode: sheet?.internalCode || '',
                    product: sheet?.product || '',
                    deliveryDate: sheet?.deliveryDate || '',
                    paymentTerms: sheet?.paymentTerms || '',
                    numberOfDays: Number(sheet?.numberOfDays || 0),
                    pdf: sheet?.pdf || '',
                    payAmount: Number(sheet?.payAmount || 0),
                    file: sheet?.file || '',
                    remark: sheet?.remark || '',
                    totalPaidAmount: Number(sheet?.totalPaidAmount || 0),
                    outstandingAmount: Number(sheet?.outstandingAmount || 0),
                    status: sheet?.status || 'Pending',
                    planned: sheet?.planned || '',
                    actual: sheet?.actual || '',
                    delay: sheet?.delay || '',
                    status1: sheet?.status1 || '',
                    paymentForm: sheet?.paymentForm || '',
                    firmNameMatch: sheet?.firmNameMatch || '',
                    billImageStatus: sheet?.billImageStatus || '',
                    billNo: sheet?.billNo || '',
                    rowIds: sheet?.rowIds || [],
                }));

                // Group by Bill No + Party Name
                const groupedPendingMap = new Map<string, DisplayPayment>();
                pendingItems.forEach(item => {
                    const billKey = item.billNo || 'NoBill';
                    const uniqueKey = `${item.partyName || 'NoVendor'}-${billKey}`;

                    if (!groupedPendingMap.has(uniqueKey)) {
                        groupedPendingMap.set(uniqueKey, { ...item });
                    } else {
                        const existing = groupedPendingMap.get(uniqueKey)!;
                        // Add rowIds
                        existing.rowIds = [...existing.rowIds, ...item.rowIds];

                        // Concatenate products
                        const existingProducts = existing.product.split(', ').map(p => p.trim());
                        if (item.product && !existingProducts.includes(item.product.trim())) {
                            existing.product = [...existingProducts, item.product.trim()].join(', ');
                        }

                        // Sum Amounts
                        existing.payAmount += item.payAmount;
                        existing.outstandingAmount += item.outstandingAmount;
                        existing.totalPaidAmount += item.totalPaidAmount;
                    }
                });

                const sortedPending = Array.from(groupedPendingMap.values()).sort((a, b) => b.rowIndex - a.rowIndex);
                setPendingData(sortedPending);

                // 2. Fetch History directly from payment_history table
                const historyItemsFromDb = (historyDbData || [])
                    .filter((r: any) => {
                        const itemFirm = (r.fms_name || '').trim().toLowerCase();
                        // If user has all access, show everything (even empty firms)
                        if (hasAllAccess) return true;
                        return permittedFirms.includes(itemFirm);
                    })
                    .map((r: any, index: number) => ({
                        rowIndex: r.id || index,
                        timestamp: r.timestamp || '',
                        apPaymentNumber: r.ap_payment_number || '',
                        status: r.status || '',
                        uniqueNumber: r.unique_number || '',
                        fmsName: r.fms_name || '',
                        payTo: r.pay_to || '',
                        amountToBePaid: Number(r.amount_to_be_paid) || 0,
                        remarks: r.remarks || '',
                        anyAttachments: r.any_attachments || '',
                        planned: r.planned || '',
                        paymentTerms: r.payment_terms || r.paymentTerms || '',
                        billImage: r.photo_of_bill || r.any_attachments || '',
                        poImage: r.any_attachments || '',
                        billImageStatus: r.bill_status || '',
                        indentNo: r.indent_no || '',
                        poNumber: r.po_number || '',
                        vendorName: r.vendor_name || '',
                        productName: r.product_name || '',
                        billNo: r.bill_no || '',
                        timestamp1: r.timestamp1 || '',
                    }));

                // 3. Merge History: items from payment_history table + completed items from payments table
                const completedPaymentsFromTable = mappedPayments
                    .filter(p => p.paymentDone)
                    .map((p, index) => ({
                        rowIndex: p.rowIndex,
                        timestamp: p.actual || p.timestamp || '',
                        apPaymentNumber: `AP-AUTO-${p.rowIndex}`,
                        status: 'Paid',
                        uniqueNumber: p.uniqueNo,
                        fmsName: p.firmNameMatch,
                        payTo: p.partyName,
                        amountToBePaid: p.payAmount,
                        remarks: p.remark || 'Payment Completed',
                        anyAttachments: p.file || p.pdf || '',
                        planned: p.planned || '',
                        paymentTerms: p.paymentTerms || '',
                        billImage: p.file || p.pdf || '',
                        poImage: p.pdf || '',
                        billImageStatus: p.billImageStatus || '',
                        liftNumber: '',
                        indentNo: p.internalCode,
                        poNumber: p.poNumber,
                        vendorName: p.partyName,
                        productName: p.product,
                        billNo: p.billNo,
                        qty: '',
                        typeOfBill: '',
                        billAmount: String(p.payAmount),
                        discountAmount: '',
                        paymentType: '',
                        advanceAmountIfAny: '',
                        transportationInclude: '',
                        transporterName: '',
                        amount: String(p.payAmount),
                        billRemark: p.remark || '',
                        timestamp1: p.actual || '',
                        vehicle_no: '',
                        driver_name: '',
                        driver_mobile_no: '',
                    }));

                // Combine and deduplicate by uniqueNumber + amount
                const combinedHistory = [...historyItemsFromDb];
                const seenHistoryKeys = new Set(historyItemsFromDb.map(h => `${h.uniqueNumber}-${h.amountToBePaid}`));
                
                completedPaymentsFromTable.forEach(p => {
                    const key = `${p.uniqueNumber}-${p.amountToBePaid}`;
                    if (!seenHistoryKeys.has(key)) {
                        combinedHistory.push(p);
                        seenHistoryKeys.add(key);
                    }
                });

                // Sort by timestamp descending
                combinedHistory.sort((a, b) => {
                    const dateA = new Date(a.timestamp).getTime();
                    const dateB = new Date(b.timestamp).getTime();
                    return dateB - dateA;
                });

                setHistoryData(combinedHistory);

                const totalAmount = sortedPending.reduce((sum, item) => sum + item.outstandingAmount, 0);
                setStats({
                    total: sortedPending.length,
                    totalAmount,
                    pendingCount: sortedPending.length,
                    historyCount: combinedHistory.length
                });

                setSelectedRows(new Set());

            } catch (error) {
                console.error('❌ Error in Make Payment fetchData:', error);
                setPendingData([]);
                setHistoryData([]);
            } finally {
                setPaymentsLoading(false);
                setPaymentHistoryLoading(false);
            }
        };

        fetchData();
    }, [reloadKey, user?.username, user?.firm_access]);

    const handleSelectAll = () => {
        if (selectedRows.size === pendingData.length) {
            setSelectedRows(new Set());
        } else {
            const allRowIndices = pendingData.map((_, index) => index);
            setSelectedRows(new Set(allRowIndices));
        }
    };

    const handleSelectRow = (rowIndex: number) => {
        const newSelected = new Set(selectedRows);
        if (newSelected.has(rowIndex)) {
            newSelected.delete(rowIndex);
        } else {
            newSelected.add(rowIndex);
        }
        setSelectedRows(newSelected);
    };

    const handleSubmitSelected = async () => {
        if (selectedRows.size === 0) {
            toast.error('Please select at least one payment to mark as completed');
            return;
        }

        setIsSubmitting(true);
        const isoNow = new Date().toISOString();
        const currentDateOnly = isoNow.split('T')[0];

        try {
            const selectedItems = Array.from(selectedRows).map(index => pendingData[index]);
            const ids = selectedItems.flatMap(item => item.rowIds).filter(Boolean);
            
            if (ids.length === 0) {
                toast.error('Could not find matching records to update');
                setIsSubmitting(false);
                return;
            }

            const { error: updateError } = await supabase
                .from('payments')
                .update({
                    actual: currentDateOnly,
                    status: 'Completed',
                    status1: 'ok',
                    payment_done: true
                })
                .in('id', ids);

            if (updateError) throw updateError;

            const historyRows = selectedItems.map(item => {
                const storeIn = storeInRecords.find(si =>
                    si.po_number === item.poNumber &&
                    (si.indent_no === item.internalCode || si.indent_number === item.internalCode)
                );
                const apPaymentNumber = `AP-${Math.floor(1000 + Math.random() * 9000)}`;

                return {
                    timestamp: isoNow,
                    ap_payment_number: apPaymentNumber,
                    status: 'Paid',
                    unique_number: item.uniqueNo,
                    fms_name: item.firmNameMatch,
                    pay_to: item.partyName,
                    amount_to_be_paid: String(item.payAmount),
                    remarks: item.remark || `Payment completed for ${item.uniqueNo}`,
                    any_attachments: item.file || item.pdf || '',
                    timestamp1: isoNow,
                    planned: item.planned || '',
                    payment_terms: item.paymentTerms || '',
                    indent_no: item.internalCode,
                    po_number: item.poNumber,
                    product_name: item.product,
                    bill_no: item.billNo || '',
                };
            });

            const { error: historyError } = await supabase
                .from('payment_history')
                .insert(historyRows);

            if (historyError) console.warn('⚠️ Error inserting into payment_history:', historyError);

            toast.success(`Successfully updated ${ids.length} payment(s)`);
            setTimeout(() => updateAll(), 800);
            setSelectedRows(new Set());
        } catch (error) {
            console.error('❌ Error submitting payments:', error);
            toast.error('Error updating payments.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSinglePaymentSubmit = async () => {
        if (!selectedPaymentItem) return;

        setIsSubmitting(true);
        const isoNow = new Date().toISOString();
        const currentDateOnly = isoNow.split('T')[0];

        try {
            let attachmentUrl = selectedPaymentItem.file || selectedPaymentItem.pdf || '';
            if (paymentModalFile) {
                attachmentUrl = await uploadPaymentImage(paymentModalFile, selectedPaymentItem.uniqueNo);
            }

            const ids = selectedPaymentItem.rowIds || [selectedPaymentItem.rowIndex];
            
            const { error: updateError } = await supabase
                .from('payments')
                .update({
                    actual: currentDateOnly,
                    status: paymentModalStatus === 'Complete' ? 'Completed' : paymentModalStatus,
                    status1: 'ok',
                    payment_done: paymentModalStatus === 'Complete',
                    pay_amount: paymentModalAmount
                })
                .in('id', ids);

            if (updateError) throw updateError;

            const storeIn = storeInRecords.find(si =>
                si.po_number === selectedPaymentItem.poNumber &&
                (si.indent_no === selectedPaymentItem.internalCode || si.indent_number === selectedPaymentItem.internalCode)
            );

            const apPaymentNumber = `AP-${Math.floor(1000 + Math.random() * 9000)}`;

            const historyRow = {
                timestamp: isoNow,
                ap_payment_number: apPaymentNumber,
                status: paymentModalStatus,
                unique_number: selectedPaymentItem.uniqueNo,
                fms_name: selectedPaymentItem.firmNameMatch,
                pay_to: selectedPaymentItem.partyName,
                amount_to_be_paid: String(paymentModalAmount),
                remarks: paymentModalRemark || `Payment completed for ${selectedPaymentItem.uniqueNo}`,
                any_attachments: attachmentUrl,
                timestamp1: isoNow,
                planned: selectedPaymentItem.planned || '',
                payment_terms: selectedPaymentItem.paymentTerms || '',
                indent_no: selectedPaymentItem.internalCode,
                po_number: selectedPaymentItem.poNumber,
                product_name: selectedPaymentItem.product,
                lift_number: storeIn?.lift_number || '',
                bill_status: storeIn?.bill_status || '',
                bill_no: String(storeIn?.bill_no || ''),
                qty: String(storeIn?.qty || ''),
                vendor_name: storeIn?.vendor_name || selectedPaymentItem.partyName,
                type_of_bill: storeIn?.type_of_bill || '',
                bill_amount: String(storeIn?.bill_amount || ''),
                discount_amount: String(storeIn?.discount_amount || ''),
                payment_type: storeIn?.payment_type || '',
                advance_amount_if_any: String(storeIn?.advance_amount_if_any || ''),
                photo_of_bill: storeIn?.photo_of_bill || selectedPaymentItem.file || '',
                transportation_include: storeIn?.transportation_include || '',
                transporter_name: storeIn?.transporter_name || '',
                amount: String(storeIn?.amount || ''),
                vehicle_no: storeIn?.vehicle_no || '',
                driver_name: storeIn?.driver_name || '',
                driver_mobile_no: storeIn?.driver_mobile_no || '',
                bill_remark: storeIn?.bill_remark || paymentModalRemark || '',
            };

            const { error: historyError } = await supabase
                .from('payment_history')
                .insert([historyRow]);

            if (historyError) console.warn('⚠️ Error inserting into payment_history:', historyError);

            toast.success(`Successfully recorded payment`);
            setIsPaymentModalOpen(false);
            setPaymentModalFile(null);
            setTimeout(() => updateAll(), 800);
            
        } catch (error) {
            console.error('❌ Error submitting payment:', error);
            toast.error('Error updating payment.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const pendingColumns: ColumnDef<DisplayPayment>[] = [
        {
            id: 'select',
            header: () => (
                <div className="flex items-center">
                    <Checkbox
                        checked={selectedRows.size === pendingData.length && pendingData.length > 0}
                        onCheckedChange={handleSelectAll}
                        className="mr-2"
                    />
                    Select
                </div>
            ),
            cell: ({ row }: { row: Row<DisplayPayment> }) => {
                const isSelected = selectedRows.has(row.index);
                return (
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleSelectRow(row.index)}
                        className="mr-2"
                    />
                );
            },
        },
        {
            id: 'action',
            header: 'Action',
            cell: ({ row }: { row: Row<DisplayPayment> }) => {
                const item = row.original;
                const hasPaymentForm = item.paymentForm?.trim() !== '';

                return (
                    <div className="flex gap-2">
                        {hasPaymentForm ? (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                    setSelectedPaymentItem(item);
                                    setPaymentModalRemark(item.remark || '');
                                    setPaymentModalStatus('Complete');
                                    setPaymentModalAmount(item.payAmount || '');
                                    setPaymentModalFile(null);
                                    setIsPaymentModalOpen(true);
                                }}
                                className="bg-green-600 hover:bg-green-700 shadow-sm"
                            >
                                <DollarSign className="mr-2 h-3 w-3" />
                                Make Payment
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="text-gray-400"
                            >
                                No Form Link
                            </Button>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'firmNameMatch',
            header: 'Project Name',
            cell: ({ row }) => (
                <span className="font-medium text-blue-700">{row.original.firmNameMatch || '-'}</span>
            )
        },
        {
            accessorKey: 'planned',
            header: 'Planned Date',
            cell: ({ row }) => (
                <span className="text-sm font-medium text-blue-600">
                    {formatDate(row.original.planned) || '-'}
                </span>
            )
        },
        {
            accessorKey: 'uniqueNo',
            header: 'Payment No.',
            cell: ({ row }) => (
                <div className="bg-gray-50 py-1 px-3 rounded-md inline-block border">
                    {row.original.uniqueNo || '-'}
                </div>
            )
        },
        {
            accessorKey: 'poNumber',
            header: 'PO Number',
            cell: ({ row }) => (
                <div className="font-medium text-purple-700">
                    <div>{row.original.poNumber || '-'}</div>
                </div>
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
            accessorKey: 'paymentTerms',
            header: 'Payment Terms',
            cell: ({ row }) => (
                <span className="text-sm italic text-gray-600">{row.original.paymentTerms || '-'}</span>
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
            header: 'Total Amount',
            cell: ({ row }) => (
                <span className="font-bold text-purple-600">₹{row.original.totalPoAmount?.toLocaleString('en-IN')}</span>
            )
        },
        {
            accessorKey: 'payAmount',
            header: 'Pay Amount',
            cell: ({ row }) => (
                <span className="font-bold text-emerald-600">
                    ₹{row.original.payAmount?.toLocaleString('en-IN')}
                </span>
            )
        },
        {
            accessorKey: 'outstandingAmount',
            header: 'Pending',
            cell: ({ row }) => {
                const total = Number(row.original.totalPoAmount) || 0;
                const paid = Number(row.original.payAmount) || 0;
                const pending = total - paid;
                return (
                    <span className="font-semibold text-red-600">
                        ₹{pending.toLocaleString('en-IN')}
                    </span>
                );
            }
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status?.toLowerCase() || '';
                const isPending = status === 'pending' || status === '';
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
            accessorKey: 'remark',
            header: 'Remark',
            cell: ({ row }) => (
                <span className="text-xs text-gray-500 truncate max-w-[150px] inline-block">
                    {row.original.remark || '-'}
                </span>
            )
        }
    ];

    const historyColumns: ColumnDef<DisplayPaymentHistory>[] = [
        {
            accessorKey: 'timestamp',
            header: 'Date',
            cell: ({ getValue }) => (
                <span className="text-xs">{formatTimestamp(getValue() as string) || '-'}</span>
            )
        },
        {
            accessorKey: 'apPaymentNumber',
            header: 'AP No.',
            cell: ({ row }) => (
                <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                    {row.original.apPaymentNumber || '-'}
                </span>
            )
        },
        {
            accessorKey: 'uniqueNumber',
            header: 'Payment No.',
            cell: ({ row }) => (
                <span className="text-xs font-medium">{row.original.uniqueNumber || '-'}</span>
            )
        },
        {
            accessorKey: 'fmsName',
            header: 'Project Name',
            cell: ({ row }) => (
                <span className="text-xs font-medium text-slate-700">{row.original.fmsName || '-'}</span>
            )
        },
        {
            accessorKey: 'payTo',
            header: 'Paid To',
            cell: ({ row }) => (
                <span className="text-xs font-semibold text-slate-800">{row.original.payTo || '-'}</span>
            )
        },
        {
            accessorKey: 'productName',
            header: 'Product',
            cell: ({ row }) => (
                <span className="text-xs text-slate-600 truncate max-w-[120px] inline-block">
                    {row.original.productName || '-'}
                </span>
            )
        },
        {
            accessorKey: 'amountToBePaid',
            header: 'Amount Paid',
            cell: ({ row }) => (
                <span className="font-bold text-emerald-700">₹{row.original.amountToBePaid?.toLocaleString('en-IN')}</span>
            )
        },
        {
            accessorKey: 'remarks',
            header: 'Remarks',
            cell: ({ row }) => (
                <span className="text-xs italic text-slate-500 truncate max-w-[150px] inline-block">
                    {row.original.remarks || '-'}
                </span>
            )
        },
        {
            id: 'attachments',
            header: 'Attachments',
            cell: ({ row }) => {
                const attachments = row.original.anyAttachments;
                const bill = row.original.billImage;
                return (
                    <div className="flex gap-2">
                        {attachments && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" asChild>
                                <a href={attachments} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            </Button>
                        )}
                        {bill && bill !== attachments && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-purple-600" asChild title="View Bill">
                                <a href={bill} target="_blank" rel="noopener noreferrer">
                                    <FileText className="h-3.5 w-3.5" />
                                </a>
                            </Button>
                        )}
                    </div>
                );
            }
        }
    ];

    return (
        <div className="container mx-auto py-6 space-y-6 max-w-7xl">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-3 rounded-full">
                        <DollarSign size={32} className="text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Make Payment</h1>
                        <p className="text-slate-500 text-sm">Schedule and confirm vendor transactions</p>
                    </div>
                </div>
                <div className="flex gap-6">
                    <Card className="shadow-none border-none bg-emerald-50/50">
                        <CardContent className="p-3 flex flex-col items-center">
                            <span className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">Total Pending</span>
                            <span className="text-2xl font-bold text-emerald-700">₹{stats.totalAmount.toLocaleString('en-IN')}</span>
                        </CardContent>
                    </Card>
                    <Card className="shadow-none border-none bg-blue-50/50">
                        <CardContent className="p-3 flex flex-col items-center">
                            <span className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Pending Tasks</span>
                            <span className="text-2xl font-bold text-blue-700">{stats.pendingCount}</span>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Tabs defaultValue="pending" className="w-full" onValueChange={setActiveTab}>
                <div className="flex justify-between items-center mb-4">
                    <TabsList className="bg-slate-100/50 p-1">
                        <TabsTrigger value="pending" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <DollarSign className="w-4 h-4 mr-2" />
                            Pending Payments
                        </TabsTrigger>
                        <TabsTrigger value="history" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <History className="w-4 h-4 mr-2" />
                            Payment History
                        </TabsTrigger>
                    </TabsList>

                    {activeTab === 'pending' && selectedRows.size > 0 && (
                        <Button 
                            onClick={handleSubmitSelected} 
                            disabled={isSubmitting}
                            className="bg-primary hover:bg-primary/90 shadow-md"
                        >
                            {isSubmitting ? 'Updating...' : `Mark ${selectedRows.size} as Paid`}
                        </Button>
                    )}
                </div>

                <TabsContent value="pending">
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <CardContent className="p-0">
                            <DataTable
                                columns={pendingColumns}
                                data={pendingData}
                                dataLoading={paymentsLoading}
                                searchFields={['partyName', 'uniqueNo', 'poNumber', 'internalCode', 'firmNameMatch']}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history">
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <CardContent className="p-0">
                            <DataTable
                                columns={historyColumns}
                                data={historyData}
                                dataLoading={paymentHistoryLoading}
                                searchFields={['payTo', 'uniqueNumber', 'apPaymentNumber', 'fmsName']}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Payment Confirmation Modal */}
            <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Confirm Payment</DialogTitle>
                        <DialogDescription>
                            Enter details for payment <span className="font-bold text-primary">{selectedPaymentItem?.uniqueNo}</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-600">Vendor</Label>
                                <div className="text-sm font-semibold p-2 bg-slate-50 rounded border">{selectedPaymentItem?.partyName}</div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-600">PO Number</Label>
                                <div className="text-sm font-semibold p-2 bg-slate-50 rounded border">{selectedPaymentItem?.poNumber}</div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="amount">Payment Amount (₹)</Label>
                            <Input
                                id="amount"
                                type="number"
                                value={paymentModalAmount}
                                onChange={(e) => setPaymentModalAmount(e.target.value)}
                                placeholder="Enter amount paid"
                                className="text-lg font-bold text-emerald-700"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="status">Status</Label>
                                <Select value={paymentModalStatus} onValueChange={setPaymentModalStatus}>
                                    <SelectTrigger id="status">
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Complete">Complete (Paid)</SelectItem>
                                        <SelectItem value="Partial">Partial Payment</SelectItem>
                                        <SelectItem value="Scheduled">Scheduled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="file">Attachment (Proof)</Label>
                                <Input
                                    id="file"
                                    type="file"
                                    onChange={(e) => setPaymentModalFile(e.target.files?.[0] || null)}
                                    className="cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="remark">Remarks</Label>
                            <Textarea
                                id="remark"
                                value={paymentModalRemark}
                                onChange={(e) => setPaymentModalRemark(e.target.value)}
                                placeholder="Add internal payment notes..."
                                className="resize-none"
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)}>Cancel</Button>
                        <Button 
                            onClick={handleSinglePaymentSubmit} 
                            disabled={isSubmitting || !paymentModalAmount}
                            className="bg-primary hover:bg-primary/90 shadow-md min-w-[120px]"
                        >
                            {isSubmitting ? 'Processing...' : 'Confirm Payment'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
