import { ChevronsRightLeft, FilePlus2, Pencil, Save, Trash, Eye, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { z } from 'zod';
import { Button } from '../ui/button';
import { SidebarTrigger } from '../ui/sidebar';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import type { PoMasterSheet } from '@/types';
import { uploadFile } from '@/lib/fetchers';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
    calculateGrandTotal,
    calculateSubtotal,
    calculateTotal,
    calculateTotalGst,
    cn,
    formatDate,
} from '@/lib/utils';
import { toast } from 'sonner';
import { ClipLoader as Loader } from 'react-spinners';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '../ui/textarea';
import { pdf } from '@react-pdf/renderer';
import POPdf, { type POPdfProps } from '../element/POPdf';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { PDFViewer } from '@react-pdf/renderer';
import { supabase, supabaseEnabled } from '@/lib/supabase';
import { fetchIndents, fetchPoMaster, fetchMasterData, insertPoRecords, updateIndentsAfterPoCreation } from '@/services/poService';

function generatePoNumber(poNumbers: string[]): string {
    const prefix = 'STORE-PO-25-26-';

    console.log("🔍 All PO numbers received:", poNumbers);


    if (!poNumbers || poNumbers.length === 0) {
        console.log("⚠️ No existing PO numbers, starting from 1");
        return `${prefix}1`;
    }

    // Extract all numbers for this prefix
    const existingNumbers = poNumbers
        .filter(po => po && typeof po === 'string' && po.trim() !== '')
        .map(po => {
            const poStr = po.trim();

            // Check if it matches our prefix pattern exactly
            if (poStr.startsWith(prefix)) {
                const numberStr = poStr.replace(prefix, '').trim();
                const num = parseInt(numberStr, 10);
                console.log(`📝 PO: ${poStr} → Number: ${num}`);
                return isNaN(num) ? 0 : num;
            }

            return 0;
        })
        .filter(n => n > 0);

    console.log("📊 Valid numbers found:", existingNumbers);

    // Find highest number and add 1
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;

    console.log(`✅ Max: ${maxNumber}, Next: ${nextNumber}, New PO: ${prefix}${nextNumber}`);

    return `${prefix}${nextNumber}`;
}

function incrementPoRevision(poNumber: string, allPOs: any[]): string {
    // Extract the base prefix and find the highest number
    const prefix = 'STORE-PO-25-26-';

    // For existing PO numbers, we need to find the highest number in the entire system
    const allPoNumbers = allPOs
        .filter((po: any) => po.poNumber && typeof po.poNumber === 'string' && po.poNumber.trim() !== '')
        .map((po: any) => po.poNumber.trim());

    // Also include the current PO number we're revising
    allPoNumbers.push(poNumber);

    console.log("🔍 All PO numbers for revision check:", allPoNumbers);

    // Extract numbers from all PO numbers with the same prefix
    const existingNumbers = allPoNumbers
        .filter(po => po.startsWith(prefix))
        .map(po => {
            const numberStr = po.replace(prefix, '').trim();
            const num = parseInt(numberStr, 10);
            console.log(`📝 PO: ${po} → Number: ${num}`);
            return isNaN(num) ? 0 : num;
        })
        .filter(n => n > 0);

    console.log("📊 Valid numbers found for revision:", existingNumbers);

    // Find highest number and add 1
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;

    const newPoNumber = `${prefix}${nextNumber}`;
    console.log(`✅ Next PO number for revision: ${newPoNumber}`);

    return newPoNumber;
}

function filterUniquePoNumbers(data: any[]): any[] {
    const seen = new Set<string>();
    const result: any[] = [];

    for (const po of data) {
        if (!seen.has(po.poNumber)) {
            seen.add(po.poNumber);
            result.push(po);
        }
    }

    return result;
}

interface IndentSheetItem {
    planned4?: string;
    actual4?: string;
    approvedVendorName?: string | number; // ✅ Allow both string and number
    firmName?: string;
    firmNameMatch?: string;
    indentNumber?: string;
    productName?: string;
    specifications?: string;
    taxValue1?: string | number;
    taxValue4?: string | number;
    approvedQuantity?: number;
    uom?: string;
    approvedRate?: number;
}

interface MasterDetails {
    destinationAddress?: string;
    defaultTerms?: string[];
    vendors?: Array<{
        vendorName?: string;
        address?: string;
        gstin?: string;
        vendorEmail?: string;
        email?: string;
    }>;
    firmCompanyMap?: Record<string, {
        companyName?: string;
        companyAddress?: string;
        destinationAddress?: string;
    }>;
    companyName?: string;
    companyPhone?: string;
    companyGstin?: string;
    companyPan?: string;
    companyAddress?: string;
    billingAddress?: string;
}



function parseCustomDate(dateStr: any): Date {
    if (!dateStr) return new Date();
    if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? new Date() : dateStr;

    // Try standard parsing first (handles ISO strings)
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;

    // Handle DD/MM/YY HH:mm:ss or DD/MM/YYYY
    if (typeof dateStr === 'string') {
        const cleanStr = dateStr.trim();
        // Regex for DD/MM/YY or DD/MM/YYYY with optional time
        const match = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);

        if (match) {
            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1; // 0-based
            let year = parseInt(match[3], 10);

            if (year < 100) year += 2000; // Assume 20xx for 2-digit years

            const hours = match[4] ? parseInt(match[4], 10) : 0;
            const minutes = match[5] ? parseInt(match[5], 10) : 0;
            const seconds = match[6] ? parseInt(match[6], 10) : 0;

            const newD = new Date(year, month, day, hours, minutes, seconds);
            if (!isNaN(newD.getTime())) return newD;
        }
    }

    console.warn("Could not parse date, defaulting to now:", dateStr);
    return new Date();
}

export default () => {
    const { user } = useAuth();

    // Supabase state
    const [indentSheet, setIndentSheet] = useState<IndentSheetItem[]>([]);
    const [poMasterSheet, setPoMasterSheet] = useState<any[]>([]);
    const [details, setDetails] = useState<MasterDetails | null>(null);
    const [dataLoading, setDataLoading] = useState(false);

    const [readOnly, setReadOnly] = useState(-1);
    const [mode, setMode] = useState<'create' | 'revise'>('create');
    const [isEditingDestination, setIsEditingDestination] = useState(false);
    const [destinationAddress, setDestinationAddress] = useState('');
    const [firmCompanyName, setFirmCompanyName] = useState('');
    const [firmCompanyAddress, setFirmCompanyAddress] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState<POPdfProps | null>(null);

    // Fetch all data from Supabase on mount
    useEffect(() => {
        async function loadData() {
            if (!supabaseEnabled) return;

            try {
                setDataLoading(true);
                const [indents, poMaster, masterData] = await Promise.all([
                    fetchIndents(),
                    fetchPoMaster(),
                    fetchMasterData(),
                ]);

                setIndentSheet(indents);
                setPoMasterSheet(poMaster);
                setDetails(masterData);
            } catch (error) {
                console.error('Error loading data:', error);
                toast.error('Failed to load data');
            } finally {
                setDataLoading(false);
            }
        }

        loadData();
    }, []);

    useEffect(() => {
        if (details?.destinationAddress) {
            setDestinationAddress(details.destinationAddress);
        }
    }, [details]);

    const schema = z.object({
        poNumber: z.string().nonempty(),
        poDate: z.coerce.date(),
        supplierName: z.string().nonempty(),
        supplierAddress: z.string().nonempty(),
        gstin: z.string().nonempty(),
        companyEmail: z.string().email().optional(),

        quotationNumber: z.string().nonempty(),
        quotationDate: z.coerce.date(),
        ourEnqNo: z.string(),
        enquiryDate: z.coerce.date(),
        description: z.string(),
        indents: z.array(
            z.object({
                indentNumber: z.string().nonempty(),
                productName: z.string().optional(),
                specifications: z.string().optional(),
                gst: z.coerce.number(),
                discount: z.coerce.number().default(0).optional(),
                quantity: z.coerce.number().optional(),
                unit: z.string().optional(),
                rate: z.coerce.number().optional(),
            })
        ),
        terms: z.array(z.string().nonempty()).max(10),
        deliveryDate: z.coerce.date(),
        deliveryDays: z.coerce.number().optional(),
        deliveryType: z.enum(['for', 'exfactory']).optional(),
        paymentTerms: z.enum(['Party PI / Party Advance', 'Advance', 'After Delivery']),
        numberOfDays: z.coerce.number().optional(),
    });

    type FormData = z.infer<typeof schema>;
    const form = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            poNumber: '',
            poDate: new Date(),
            supplierName: '',
            supplierAddress: '',
            gstin: '',
            companyEmail: '',
            quotationNumber: '',
            quotationDate: new Date(),
            ourEnqNo: '',
            enquiryDate: undefined as any,
            description: '',
            indents: [],
            terms: (details as MasterDetails)?.defaultTerms || [],
            deliveryDate: new Date(),
            deliveryDays: undefined,
            deliveryType: undefined,
            paymentTerms: undefined as any,
            numberOfDays: undefined,
        },
    });

    useEffect(() => {
        if (details) {
            form.setValue('terms', (details as MasterDetails).defaultTerms || []);
        }
    }, [details, form]);

    const indents = form.watch('indents');
    const vendor = form.watch('supplierName');
    const poDate = form.watch('poDate');
    const poNumber = form.watch('poNumber');

    const termsArray = useFieldArray({
        control: form.control,
        name: 'terms' as any,
    });

    const itemsArray = useFieldArray({
        control: form.control,
        name: 'indents' as any,
    });

    // Vendor selection effect for CREATE mode
    useEffect(() => {
        if (!vendor || !details || !(details as MasterDetails).vendors || mode !== 'create') return;

        console.log("🔍 Vendor changed:", vendor);

        const normalize = (str: any) => {
            // ✅ FIX: Handle cases where str might not be a string
            if (!str) return '';
            if (typeof str !== 'string') return String(str).trim().toLowerCase();
            return str.trim().toLowerCase();
        };

        const selectedVendor = (details as MasterDetails).vendors?.find(
            (v) => normalize(v.vendorName) === normalize(vendor)
        );

        if (selectedVendor) {
            console.log("✅ Matched vendor:", selectedVendor);
            form.setValue('supplierAddress', selectedVendor.address || '', { shouldValidate: true });
            form.setValue('gstin', selectedVendor.gstin || '', { shouldValidate: true });
            form.setValue('companyEmail', selectedVendor.vendorEmail || '', { shouldValidate: true });
        } else {
            console.warn("⚠️ Vendor not found in master list:", vendor);
            form.setValue('supplierAddress', '', { shouldValidate: true });
            form.setValue('gstin', '', { shouldValidate: true });
            form.setValue('companyEmail', '', { shouldValidate: true });
        }

        // ✅ FIX: Update the matching indents filter to handle non-string vendor names
        const matchingIndents = indentSheet.filter((i: IndentSheetItem) => {
            const vendorName = i.approvedVendorName;
            const hasVendor = vendorName && (typeof vendorName === 'string' || typeof vendorName === 'number');
            const normalizedVendorName = normalize(vendorName);
            const normalizedSelectedVendor = normalize(vendor);

            return hasVendor &&
                i.planned4 !== '' &&
                i.actual4 === '' &&
                normalizedVendorName === normalizedSelectedVendor;
        });

        console.log("📦 Matching indents found:", matchingIndents.length);

        const firmName = matchingIndents[0]?.firmName?.trim();
        if (firmName && (details as MasterDetails).firmCompanyMap) {
            const firmKey = Object.keys((details as MasterDetails).firmCompanyMap!).find(
                (key) => normalize(key) === normalize(firmName)
            );

            const companyDetails = firmKey ? (details as MasterDetails).firmCompanyMap![firmKey] : null;

            if (companyDetails) {
                setFirmCompanyName(companyDetails.companyName || '');
                setFirmCompanyAddress(companyDetails.companyAddress || '');
                setDestinationAddress(
                    companyDetails.destinationAddress || (details as MasterDetails).destinationAddress || ''
                );
                console.log("✅ Firm/company details loaded:", companyDetails);
            } else {
                console.log("⚠️ Firm not found in firmCompanyMap:", firmName);
                setFirmCompanyName((details as MasterDetails).companyName || '');
                setFirmCompanyAddress((details as MasterDetails).companyAddress || '');
                setDestinationAddress((details as MasterDetails).destinationAddress || '');
            }
        }

        form.setValue(
            'indents',
            matchingIndents.map((i: IndentSheetItem) => {
                let gstValue: number | undefined = undefined;

                if (i.taxValue1 && !isNaN(Number(i.taxValue1)) && Number(i.taxValue1) > 0) {
                    gstValue = Number(i.taxValue1);
                }
                else if (i.taxValue4 && !isNaN(Number(i.taxValue4)) && Number(i.taxValue4) > 0) {
                    gstValue = Number(i.taxValue4);
                }

                return {
                    indentNumber: i.indentNumber || '',
                    productName: i.productName || '',
                    specifications: i.specifications || '',
                    gst: gstValue ?? 0,
                    discount: 0,
                    quantity: i.approvedQuantity || 0,
                    unit: i.uom || '',
                    rate: i.approvedRate || 0,
                };
            })
        );

        setTimeout(() => form.trigger(['supplierAddress', 'gstin']), 100);

    }, [vendor, details, indentSheet, mode, form]);

    // Mode change effect
    useEffect(() => {
        console.log("🔄 Mode changed to:", mode, "PO Master Sheet count:", poMasterSheet.length);

        if (mode === 'revise') {
            form.reset({
                poNumber: '',
                poDate: new Date(),
                supplierName: '',
                supplierAddress: '',
                gstin: '',
                companyEmail: '',
                quotationNumber: '',
                quotationDate: new Date(),
                ourEnqNo: '',
                enquiryDate: undefined as any,
                indents: [],
                terms: (details as MasterDetails)?.defaultTerms || [],
                deliveryDate: new Date(),
                deliveryDays: undefined,
                deliveryType: undefined,
                paymentTerms: undefined as any,
                numberOfDays: undefined,
                description: '',
            });
        } else {
            if (poMasterSheet && poMasterSheet.length > 0) {
                const poNumbers = poMasterSheet.map((p) => p.poNumber).filter(po => po && po.trim() !== '');
                console.log("📋 Available PO numbers for generation:", poNumbers);

                const newPoNumber = generatePoNumber(poNumbers);
                console.log("🎯 Final generated PO number:", newPoNumber);

                form.reset({
                    poNumber: newPoNumber,
                    poDate: new Date(),
                    supplierName: '',
                    supplierAddress: '',
                    gstin: '',
                    companyEmail: '',
                    quotationNumber: '',
                    quotationDate: new Date(),
                    ourEnqNo: '',
                    enquiryDate: undefined as any,
                    indents: [],
                    terms: (details as MasterDetails)?.defaultTerms || [],
                    deliveryDate: new Date(),
                    deliveryDays: undefined,
                    deliveryType: undefined,
                    paymentTerms: undefined as any,
                    numberOfDays: undefined,
                    description: '',
                });
            } else {
                console.log("📝 No PO data available, using default PO number");
                form.reset({
                    poNumber: 'STORE-PO-25-26-1',
                    poDate: new Date(),
                    supplierName: '',
                    supplierAddress: '',
                    gstin: '',
                    companyEmail: '',
                    quotationNumber: '',
                    quotationDate: new Date(),
                    ourEnqNo: '',
                    enquiryDate: undefined as any,
                    indents: [],
                    terms: (details as MasterDetails)?.defaultTerms || [],
                    deliveryDate: new Date(),
                    deliveryDays: undefined,
                    deliveryType: undefined,
                    paymentTerms: undefined as any,
                    numberOfDays: undefined,
                    description: '',
                });
            }
        }
    }, [mode, poMasterSheet, details, form]);

    // REVISE MODE - Load PO data when PO number is selected
    useEffect(() => {
        if (mode === 'revise' && poNumber && poNumber.trim() !== '') {
            console.log("🔄 REVISE MODE: Loading PO data for:", poNumber);

            const poItems = poMasterSheet.filter((p) => p.poNumber === poNumber);
            console.log("📦 Found PO items:", poItems.length);

            if (poItems.length > 0) {
                const firstPoItem = poItems[0];
                console.log("📄 First PO Item:", firstPoItem);

                const vendor = (details as MasterDetails)?.vendors?.find((v) => {
                    const vendorName = v.vendorName?.toLowerCase()?.trim();
                    const partyName = firstPoItem.partyName?.toLowerCase()?.trim();
                    return vendorName === partyName;
                });

                console.log("🔍 Looking for vendor:", firstPoItem.partyName);
                console.log("✅ Found vendor details:", vendor);

                form.setValue('poDate', parseCustomDate(firstPoItem.timestamp));
                form.setValue('supplierName', firstPoItem.partyName || '');

                if (vendor) {
                    form.setValue('supplierAddress', vendor.address || '');
                    form.setValue('gstin', vendor.gstin || '');
                    form.setValue('companyEmail', vendor.vendorEmail || '');
                } else {
                    const storedAddress = (firstPoItem as any)?.supplierAddress || '';
                    const storedGstin = (firstPoItem as any)?.supplierGstin || '';
                    const storedEmail = (firstPoItem as any)?.companyEmail || '';

                    form.setValue('supplierAddress', storedAddress);
                    form.setValue('gstin', storedGstin);
                    form.setValue('companyEmail', storedEmail);
                }

                form.setValue('quotationNumber', firstPoItem.quotationNumber || '');
                form.setValue('quotationDate', parseCustomDate(firstPoItem.quotationDate));
                form.setValue('description', firstPoItem.description || '');
                form.setValue('ourEnqNo', firstPoItem.enquiryNumber || '');
                form.setValue('enquiryDate', parseCustomDate(firstPoItem.enquiryDate));
                form.setValue('deliveryDate', parseCustomDate(firstPoItem.deliveryDate));
                form.setValue('deliveryDays', firstPoItem.deliveryDays || 0);
                form.setValue('deliveryType', (firstPoItem.deliveryType === 'for' || firstPoItem.deliveryType === 'exfactory') ? firstPoItem.deliveryType : undefined);
                form.setValue('paymentTerms', firstPoItem.paymentTerms as any || undefined);
                form.setValue('numberOfDays', firstPoItem.numberOfDays || 0);

                const poIndents = poItems.map((poItem) => ({
                    indentNumber: poItem.internalCode || '',
                    productName: poItem.product || '',
                    specifications: poItem.description || '',
                    gst: poItem.gstPercent || 18,
                    discount: poItem.discountPercent || 0,
                    quantity: poItem.quantity || 0,
                    unit: poItem.unit || '',
                    rate: poItem.rate || 0,
                }));

                console.log("✅ Loaded indents:", poIndents);
                form.setValue('indents', poIndents);

                const terms = [];
                for (let i = 1; i <= 10; i++) {
                    const termKey = `term${i}` as keyof PoMasterSheet;
                    const term = firstPoItem[termKey] as string;
                    if (term && typeof term === 'string' && term.trim() !== '') {
                        terms.push(term.trim());
                    }
                }
                form.setValue('terms', terms.length > 0 ? terms : ((details as MasterDetails)?.defaultTerms || []));

                console.log("✅ PO data loaded successfully for revision");
            }
        }
    }, [poNumber, mode, poMasterSheet, details, form]);

    const handleDestinationEdit = () => setIsEditingDestination(true);
    const handleDestinationSave = () => {
        setIsEditingDestination(false);
        toast.success('Destination address updated');
    };
    const handleDestinationCancel = () => {
        setDestinationAddress((details as MasterDetails)?.destinationAddress || '');
        setIsEditingDestination(false);
    };

    async function generatePreviewData(): Promise<POPdfProps> {
        const values = form.getValues();

        const grandTotal = calculateGrandTotal(
            values.indents.map((indent) => ({
                quantity: indent.quantity || 0,
                rate: indent.rate || 0,
                discountPercent: indent.discount || 0,
                gstPercent: indent.gst || 0,
            }))
        );

        return {
            companyName: firmCompanyName || (details as MasterDetails)?.companyName || '',
            companyPhone: (details as MasterDetails)?.companyPhone || '',
            companyGstin: (details as MasterDetails)?.companyGstin || '',
            companyPan: (details as MasterDetails)?.companyPan || '',
            companyAddress: firmCompanyAddress || (details as MasterDetails)?.companyAddress || '',
            billingAddress: firmCompanyAddress || (details as MasterDetails)?.billingAddress || '',
            destinationAddress: destinationAddress || '',
            supplierName: values.supplierName,
            supplierAddress: values.supplierAddress,
            supplierGstin: values.gstin,
            orderNumber: mode === 'create' ? values.poNumber : incrementPoRevision(values.poNumber, poMasterSheet),
            orderDate: formatDate(values.poDate),
            deliveryDate: formatDate(values.deliveryDate),
            quotationNumber: values.quotationNumber,
            quotationDate: formatDate(values.quotationDate),
            enqNo: values.ourEnqNo,
            enqDate: formatDate(values.enquiryDate),
            description: values.description,
            items: values.indents.map((item) => {
                const indent = indentSheet.find((i: IndentSheetItem) => i.indentNumber === item.indentNumber);
                return {
                    internalCode: indent?.indentNumber || item.indentNumber,
                    product: item.productName || indent?.productName || '',
                    description: item.specifications || indent?.specifications || '',
                    quantity: item.quantity || 0,
                    unit: item.unit || '',
                    rate: item.rate || 0,
                    gst: item.gst || 0,
                    discount: item.discount || 0,
                    amount: calculateTotal(
                        item.rate || 0,
                        item.gst || 0,
                        item.discount || 0,
                        item.quantity || 0
                    ),
                };
            }),
            total: calculateSubtotal(
                values.indents.map((indent) => ({
                    quantity: indent.quantity || 0,
                    rate: indent.rate || 0,
                    discountPercent: indent.discount || 0,
                }))
            ),
            gstAmount: calculateTotalGst(
                values.indents.map((indent) => ({
                    quantity: indent.quantity || 0,
                    rate: indent.rate || 0,
                    discountPercent: indent.discount || 0,
                    gstPercent: indent.gst,
                }))
            ),
            grandTotal: grandTotal,
            terms: values.terms,
            preparedBy: user.username || 'Unknown',
            approvedBy: 'Sayan Das',
        };
    }

    async function handlePreview() {
        try {
            const data = await generatePreviewData();
            setPreviewData(data);
            setShowPreview(true);
        } catch (error) {
            console.error('Preview error:', error);
            toast.error('Failed to generate preview');
        }
    }

    async function onSubmit(values: FormData) {
        try {
            const poNumber = mode === 'create' ? values.poNumber : incrementPoRevision(values.poNumber, poMasterSheet);
            const grandTotal = calculateGrandTotal(
                values.indents.map((indent) => ({
                    quantity: indent.quantity || 0,
                    rate: indent.rate || 0,
                    discountPercent: indent.discount || 0,
                    gstPercent: indent.gst || 0,
                }))
            );

            // Convert logo image to base64 for PDF
            const logoResponse = await fetch('/logo.png');
            const logoBlob = await logoResponse.blob();
            const logoBase64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(logoBlob);
            });

            const pdfProps: POPdfProps = {
                companyName: firmCompanyName || (details as MasterDetails)?.companyName || '',
                companyPhone: (details as MasterDetails)?.companyPhone || '',
                companyGstin: (details as MasterDetails)?.companyGstin || '',
                companyPan: (details as MasterDetails)?.companyPan || '',
                companyAddress: firmCompanyAddress || (details as MasterDetails)?.companyAddress || '',
                billingAddress: firmCompanyAddress || (details as MasterDetails)?.billingAddress || '',
                destinationAddress: destinationAddress || (details as MasterDetails)?.destinationAddress || '',
                supplierName: values.supplierName,
                supplierAddress: values.supplierAddress,
                supplierGstin: values.gstin,
                orderNumber: poNumber,
                orderDate: formatDate(values.poDate),
                deliveryDate: formatDate(values.deliveryDate),
                quotationNumber: values.quotationNumber,
                quotationDate: formatDate(values.quotationDate),
                enqNo: values.ourEnqNo,
                enqDate: formatDate(values.enquiryDate),
                description: values.description,

                items: values.indents.map((item) => {
                    const indent = indentSheet.find((i: IndentSheetItem) => i.indentNumber === item.indentNumber);
                    return {
                        internalCode: indent?.indentNumber || item.indentNumber,
                        product: item.productName || indent?.productName || '',
                        description: item.specifications || indent?.specifications || '',
                        quantity: item.quantity || 0,
                        unit: item.unit || '',
                        rate: item.rate || 0,
                        gst: item.gst || 0,
                        discount: item.discount || 0,
                        amount: calculateTotal(
                            item.rate || 0,
                            item.gst || 0,
                            item.discount || 0,
                            item.quantity || 0
                        ),
                    };
                }),
                total: calculateSubtotal(
                    values.indents.map((indent) => ({
                        quantity: indent.quantity || 0,
                        rate: indent.rate || 0,
                        discountPercent: indent.discount || 0,
                    }))
                ),
                gstAmount: calculateTotalGst(
                    values.indents.map((indent) => ({
                        quantity: indent.quantity || 0,
                        rate: indent.rate || 0,
                        discountPercent: indent.discount || 0,
                        gstPercent: indent.gst,
                    }))
                ),
                grandTotal: grandTotal,
                terms: values.terms,
                preparedBy: user.username || 'Unknown',
                approvedBy: 'Sayan Das',
            };

            const blob = await pdf(<POPdf {...pdfProps} />).toBlob();
            const file = new File([blob], `PO-${poNumber}.pdf`, {
                type: 'application/pdf',
            });

            const email = (details as MasterDetails)?.vendors?.find((v) => v.vendorName === values.supplierName)?.email;

            const uploadParams: {
                file: File;
                folderId: string;
                uploadType?: 'upload' | 'email';
                email?: string;
                emailSubject?: string;
                emailBody?: string;
            } = {
                file,
                folderId: 'po_image',
                uploadType: 'upload',
            };

            if (email && email.trim() && email.includes('@')) {
                uploadParams.uploadType = 'email';
                uploadParams.email = email;
                uploadParams.emailSubject = `Purchase Order - ${poNumber}`;
                uploadParams.emailBody = `Please find attached Purchase Order ${poNumber}`;
            }

            const url = await uploadFile(uploadParams);

            const rows: PoMasterSheet[] = values.indents.map((v) => {
                const indent = indentSheet.find((i: IndentSheetItem) => i.indentNumber === v.indentNumber);

                const formatDateTime = (date: Date) => {
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date
                        .getFullYear()
                        .toString()
                        .slice(-2)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
                            date.getSeconds()
                        )}`;
                };

                return {
                    timestamp: values.poDate.toISOString(),
                    partyName: values.supplierName,
                    poNumber,
                    internalCode: v.indentNumber,
                    product: v.productName || indent?.productName || '',
                    description: values.description,
                    quantity: v.quantity || 0,
                    unit: v.unit || '',
                    rate: v.rate || 0,
                    gst: v.gst,
                    companyEmail: values.companyEmail || '',
                    discount: v.discount || 0,
                    amount: calculateTotal(
                        v.rate || 0,
                        v.gst,
                        v.discount || 0,
                        v.quantity || 0
                    ),
                    totalPoAmount: grandTotal,
                    pdf: url,
                    quotationNumber: values.quotationNumber,
                    quotationDate: formatDateTime(values.quotationDate),
                    enquiryNumber: values.ourEnqNo,
                    enquiryDate: formatDateTime(values.enquiryDate),
                    term1: values.terms[0],
                    term2: values.terms[1],
                    term3: values.terms[2],
                    term4: values.terms[3],
                    term5: values.terms[4],
                    term6: values.terms[5],
                    term7: values.terms[6],
                    term8: values.terms[7],
                    term9: values.terms[8],
                    term10: values.terms[9],
                    discountPercent: v.discount || 0,
                    gstPercent: v.gst,
                    deliveryDate: formatDateTime(values.deliveryDate),
                    paymentTerms: values.paymentTerms,
                    numberOfDays: values.numberOfDays || 0,
                    deliveryDays: values.deliveryDays || 0,
                    deliveryType: values.deliveryType || '',
                    firmNameMatch: (indent as any)?.firmNameMatch ?? '',
                };
            });

            await insertPoRecords(rows);

            // Update indents to mark PO as created (set actual4)
            const indentNumbers = values.indents.map(v => v.indentNumber);
            await updateIndentsAfterPoCreation(indentNumbers);

            toast.success(`Successfully ${mode}d purchase order`);
            form.reset();

            // Refresh data from Supabase
            const [indents, poMaster] = await Promise.all([
                fetchIndents(),
                fetchPoMaster(),
            ]);
            setIndentSheet(indents);
            setPoMasterSheet(poMaster);
        } catch (e) {
            console.log(e);
            toast.error(`Failed to ${mode} purchase order`);
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    return (
        <div className="grid place-items-center w-full bg-gradient-to-br from-blue-100 via-purple-50 to-blue-50 rounder-md">
            <div className="flex justify-between p-5 w-full">
                <div className="flex gap-2 items-center">
                    <FilePlus2 size={50} className="text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold text-primary">Create or Revise PO</h1>
                        <p className="text-muted-foreground text-sm">
                            Create purchase order for indends or revise previous orders
                        </p>
                    </div>
                </div>
                <SidebarTrigger />
            </div>
            <div className="sm:p-4 max-w-6xl">
                <div className="w-full">
                    <Tabs defaultValue="create" onValueChange={(v) => setMode(v === 'create' ? v : 'revise')}>
                        <TabsList className="h-10 w-full rounded-none">
                            <TabsTrigger value="create">Create</TabsTrigger>
                            <TabsTrigger value="revise">Revise</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit, onError)} className="flex flex-col items-center">
                        <div className="space-y-4 p-4 w-full bg-white shadow-md rounded-sm">
                            {/* Header Section */}
                            <div className="flex items-center justify-center gap-4 bg-blue-50 p-2 h-25 rounded">
                                <img src="/logo (1).png" alt="Company Logo" className="w-40 h-40 object-contain" />
                                <div className="text-center">
                                    <h1 className="text-2xl font-bold">
                                        {firmCompanyName || <span className="text-gray-400">Select Supplier</span>}
                                    </h1>
                                    <div>
                                        <p className="text-sm">
                                            {firmCompanyAddress || <span className="text-gray-400">No address</span>}
                                        </p>
                                        {(details as MasterDetails)?.companyPhone && (
                                            <p className="text-sm">Phone No: +{(details as MasterDetails)?.companyPhone}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <hr />
                            <h2 className="text-center font-bold text-lg">Purchase Order</h2>
                            <hr />

                            {/* Form Fields */}
                            <div className="grid gap-5 px-4 py-2 text-foreground/80">
                                <div className="grid grid-cols-2 gap-x-5">
                                    <FormField control={form.control} name="poNumber" render={({ field }) => (
                                        <FormItem>
                                            {mode === 'create' ? (
                                                <>
                                                    <FormLabel>PO Number</FormLabel>
                                                    <FormControl>
                                                        <Input className="h-9" readOnly placeholder="Enter PO number" {...field} />
                                                    </FormControl>
                                                </>
                                            ) : (
                                                <FormControl>
                                                    <Select onValueChange={field.onChange} value={field.value || ""}>
                                                        <FormLabel>PO Number</FormLabel>
                                                        <FormControl>
                                                            <SelectTrigger size="sm" className="w-full">
                                                                <SelectValue placeholder="Select PO" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {filterUniquePoNumbers(poMasterSheet)
                                                                .filter(i => i.poNumber && i.poNumber.trim() !== '')
                                                                .map((i, k) => (
                                                                    <SelectItem key={k} value={i.poNumber}>
                                                                        {i.poNumber}
                                                                    </SelectItem>
                                                                ))}
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                            )}
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="poDate" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>PO Date</FormLabel>
                                            <FormControl>
                                                <Input className="h-9" type="date" value={field.value && !isNaN(field.value.getTime()) ? field.value.toISOString().split('T')[0] : ''}
                                                    onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)} />
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                </div>

                                <div className="grid grid-cols-3 gap-x-5">
                                    <FormField control={form.control} name="supplierName" render={({ field }) => (
                                        <FormItem>
                                            {mode === 'create' ? (
                                                <FormControl>
                                                    <Select onValueChange={field.onChange} value={field.value || ""}>
                                                        <FormLabel>Supplier Name</FormLabel>
                                                        <FormControl>
                                                            <SelectTrigger size="sm" className="w-full">
                                                                <SelectValue placeholder="Select supplier" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {[...new Map(
                                                                indentSheet
                                                                    .filter((i: IndentSheetItem) => {
                                                                        // ✅ FIX: Check if approvedVendorName exists and is a string
                                                                        const vendorName = i.approvedVendorName;
                                                                        const hasVendor = vendorName && typeof vendorName === 'string' && vendorName.trim() !== '';
                                                                        const hasPlannedDate = i.planned4 !== '';
                                                                        const hasNoActualDate = i.actual4 === '';

                                                                        return hasVendor && hasPlannedDate && hasNoActualDate;
                                                                    })
                                                                    .map((i) => [i.approvedVendorName, i])
                                                            ).values()]
                                                                .map((i, k) => (
                                                                    <SelectItem key={k} value={i.approvedVendorName as string}>
                                                                        {i.approvedVendorName as string}
                                                                    </SelectItem>
                                                                ))}
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                            ) : (
                                                <>
                                                    <FormLabel>Supplier Name</FormLabel>
                                                    <FormControl>
                                                        <Input className="h-9" readOnly placeholder="Enter supplier name" {...field} />
                                                    </FormControl>
                                                </>
                                            )}
                                        </FormItem>
                                    )} />
                                    {/* Supplier Address - Changed to always be editable */}
                                    <FormField control={form.control} name="supplierAddress" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Supplier Address</FormLabel>
                                            <FormControl>
                                                <Input
                                                    className="h-9"
                                                    readOnly={false}
                                                    placeholder="Enter supplier address"
                                                    {...field}
                                                    value={field.value || ''}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )} />

                                    {/* GSTIN - Changed to always be editable */}
                                    <FormField control={form.control} name="gstin" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>GSTIN</FormLabel>
                                            <FormControl>
                                                <Input
                                                    className="h-9"
                                                    readOnly={false}
                                                    placeholder="Enter GSTIN"
                                                    {...field}
                                                    value={field.value || ''}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )} />

                                    {/* Company Email - Changed to always be editable */}
                                    <FormField control={form.control} name="companyEmail" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Company Email</FormLabel>
                                            <FormControl>
                                                <Input
                                                    className="h-9"
                                                    type="email"
                                                    readOnly={false}
                                                    placeholder="Enter company email"
                                                    {...field}
                                                    value={field.value || ''}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                </div>

                                <div className="grid grid-cols-2 gap-x-5">
                                    <FormField control={form.control} name="quotationNumber" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Quotation Number</FormLabel>
                                            <FormControl>
                                                <Input className="h-9" placeholder="Enter Quotation number" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="quotationDate" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Quotation Date</FormLabel>
                                            <FormControl>
                                                <Input className="h-9" type="date" value={field.value && !isNaN(field.value.getTime()) ? field.value.toISOString().split('T')[0] : ''}
                                                    onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)} />
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                </div>

                                <div className="grid grid-cols-3 gap-x-5">
                                    <FormField control={form.control} name="ourEnqNo" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Our Enq No.</FormLabel>
                                            <FormControl>
                                                <Input className="h-9" placeholder="Enter Our Enq No." {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="enquiryDate" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Enquiry Date</FormLabel>
                                            <FormControl>
                                                <Input className="h-9" type="date" value={field.value && !isNaN(field.value.getTime()) ? field.value.toISOString().split('T')[0] : ''}
                                                    onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)} />
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="deliveryDate" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Delivery Date</FormLabel>
                                            <FormControl>
                                                <Input className="h-9" type="date" value={field.value && !isNaN(field.value.getTime()) ? field.value.toISOString().split('T')[0] : ''}
                                                    onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)} />
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                </div>

                                <div className="grid grid-cols-3 gap-x-5">
                                    <FormField control={form.control} name="paymentTerms" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Payment Terms</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || ""}>
                                                <FormControl>
                                                    <SelectTrigger size="sm" className="w-full h-9">
                                                        <SelectValue placeholder="Select payment terms" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Advance">Advance</SelectItem>
                                                    <SelectItem value="Party PI / Party Advance">Party PI / Party Advance</SelectItem>
                                                    <SelectItem value="After Delivery">After Delivery</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                </div>

                                {form.watch('paymentTerms') === 'After Delivery' && (
                                    <FormField control={form.control} name="numberOfDays" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Number of Days</FormLabel>
                                            <FormControl>
                                                <Input className="h-9" type="number" placeholder="Enter number of days" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                )}
                            </div>

                            <hr />

                            {/* Commercial Details Cards */}
                            <div className="grid md:grid-cols-3 gap-3">
                                <Card className="p-0 gap-0 shadow-xs rounded-[3px]">
                                    <CardHeader className="bg-muted px-5 py-2">
                                        <CardTitle className="text-center">Our Commercial Details</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 text-sm">
                                        <p><span className="font-medium">GSTIN</span> {(details as MasterDetails)?.companyGstin}</p>
                                        <p><span className="font-medium">Pan No.</span> {(details as MasterDetails)?.companyPan}</p>
                                    </CardContent>
                                </Card>

                                <Card className="p-0 gap-0 shadow-xs rounded-[3px]">
                                    <CardHeader className="bg-muted px-5 py-2">
                                        <CardTitle className="text-center">Billing Address</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 text-sm">
                                        {vendor ? (
                                            <>
                                                <p>M/S {firmCompanyName || (details as MasterDetails)?.companyName}</p>
                                                <p>{firmCompanyAddress || (details as MasterDetails)?.billingAddress}</p>
                                            </>
                                        ) : (
                                            <p className="text-gray-400 text-center">Select Supplier</p>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card className="p-0 gap-0 shadow-xs rounded-[3px]">
                                    <CardHeader className="bg-muted px-5 py-2">
                                        <CardTitle className="text-center flex items-center justify-between">
                                            Destination Address
                                            {vendor && (
                                                <Button type="button" variant="ghost" size="sm"
                                                    onClick={isEditingDestination ? handleDestinationSave : handleDestinationEdit}
                                                    className="h-6 w-6 p-0 hover:bg-gray-200">
                                                    {isEditingDestination ? (
                                                        <Save size={14} className="text-green-600" />
                                                    ) : (
                                                        <Pencil size={14} className="text-gray-600" />
                                                    )}
                                                </Button>
                                            )}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 text-sm">
                                        {vendor ? (
                                            <>
                                                <p>M/S {firmCompanyName || (details as MasterDetails)?.companyName}</p>
                                                {isEditingDestination ? (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Input value={destinationAddress} onChange={(e) => setDestinationAddress(e.target.value)}
                                                            className="h-7 text-sm" placeholder="Enter destination address"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    handleDestinationSave();
                                                                } else if (e.key === 'Escape') {
                                                                    handleDestinationCancel();
                                                                }
                                                            }} autoFocus />
                                                        <Button type="button" variant="ghost" size="sm" onClick={handleDestinationCancel}
                                                            className="h-6 w-6 p-0 hover:bg-red-100">
                                                            <Trash size={12} className="text-red-500" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <p>{destinationAddress}</p>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-gray-400 text-center">Select Supplier</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            <hr />

                            {/* Description */}
                            <div>
                                <FormField control={form.control} name="description" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Enter message" className="resize-y" {...field} />
                                        </FormControl>
                                    </FormItem>
                                )} />
                            </div>

                            <hr />

                            {/* Items Table */}
                            <div className="mx-4 grid">
                                <div className="rounded-[3px] w-full min-w-full overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-muted">
                                            <TableRow>
                                                <TableHead>S/N</TableHead>
                                                <TableHead>Internal Code</TableHead>
                                                <TableHead>Product</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead>Qty</TableHead>
                                                <TableHead>Unit</TableHead>
                                                <TableHead>Rate</TableHead>
                                                <TableHead>GST (%)</TableHead>
                                                <TableHead>Discount (%)</TableHead>
                                                <TableHead>Amount</TableHead>
                                                <TableHead></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {itemsArray.fields.map((field, index) => {
                                                const formValue = form.watch(`indents.${index}`);
                                                const amount = calculateTotal(formValue?.rate || 0, formValue?.gst || 0, formValue?.discount || 0, formValue?.quantity || 0);

                                                return (
                                                    <TableRow key={field.id}>
                                                        <TableCell>{index + 1}</TableCell>
                                                        <TableCell className="font-medium">{formValue?.indentNumber || 'N/A'}</TableCell>
                                                        <TableCell>{formValue?.productName || 'No Product'}</TableCell>
                                                        <TableCell>{formValue?.specifications || <span className="text-muted-foreground italic">No description</span>}</TableCell>
                                                        <TableCell>
                                                            <FormField control={form.control} name={`indents.${index}.quantity`} render={({ field }) => (
                                                                <FormItem className="flex justify-center">
                                                                    <FormControl>
                                                                        <Input type="number" className="h-9 w-20 text-center" value={field.value || 0} onChange={field.onChange} />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <FormField control={form.control} name={`indents.${index}.unit`} render={({ field }) => (
                                                                <FormItem className="flex justify-center">
                                                                    <FormControl>
                                                                        <Input className="h-9 w-20 text-center" value={field.value || ''} onChange={field.onChange} />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <FormField control={form.control} name={`indents.${index}.rate`} render={({ field }) => (
                                                                <FormItem className="flex justify-center">
                                                                    <FormControl>
                                                                        <Input type="number" className="h-9 w-24 text-center" value={field.value || 0} onChange={field.onChange} />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <FormField control={form.control} name={`indents.${index}.gst`} render={({ field }) => (
                                                                <FormItem className="flex items-center justify-center gap-1">
                                                                    <FormControl>
                                                                        <Input type="number" className="h-9 w-16 text-center" value={field.value || 0} onChange={field.onChange} />
                                                                    </FormControl>
                                                                    <span>%</span>
                                                                </FormItem>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <FormField control={form.control} name={`indents.${index}.discount`} render={({ field }) => (
                                                                <FormItem className="flex items-center justify-center gap-1">
                                                                    <FormControl>
                                                                        <Input type="number" className="h-9 w-16 text-center" value={field.value || 0} onChange={field.onChange} />
                                                                    </FormControl>
                                                                    <span>%</span>
                                                                </FormItem>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell className="font-medium">₹{amount.toFixed(2)}</TableCell>
                                                        <TableCell>
                                                            <Button type="button" variant="ghost" size="sm" onClick={() => itemsArray.remove(index)}>
                                                                <Trash size={16} className="text-red-500" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Total Calculation */}
                                <div className="flex justify-end p-4">
                                    <div className="w-80 rounded-[3px] bg-muted">
                                        <p className="flex px-7 py-2 justify-between">
                                            <span>Total:</span>
                                            <span className="text-end">
                                                {calculateSubtotal(
                                                    form.watch('indents').map((indent) => ({
                                                        quantity: indent.quantity || 0,
                                                        rate: indent.rate || 0,
                                                        discountPercent: indent.discount || 0,
                                                    }))
                                                )}
                                            </span>
                                        </p>
                                        <hr />
                                        <p className="flex px-7 py-2 justify-between">
                                            <span>GST Amount:</span>
                                            <span className="text-end">
                                                {calculateTotalGst(
                                                    form.watch('indents').map((indent) => ({
                                                        quantity: indent.quantity || 0,
                                                        rate: indent.rate || 0,
                                                        discountPercent: indent.discount || 0,
                                                        gstPercent: indent.gst || 0,
                                                    }))
                                                )}
                                            </span>
                                        </p>
                                        <hr />
                                        <p className="flex px-7 py-2 justify-between font-bold">
                                            <span>Grand Total:</span>
                                            <span className="text-end">
                                                {calculateGrandTotal(
                                                    form.watch('indents').map((indent) => ({
                                                        quantity: indent.quantity || 0,
                                                        rate: indent.rate || 0,
                                                        discountPercent: indent.discount || 0,
                                                        gstPercent: indent.gst || 0,
                                                    }))
                                                )}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <hr />

                            {/* Terms Section */}
                            <div>
                                <p className="text-sm px-3 font-semibold">THE ABOVE</p>
                                <div>
                                    {termsArray.fields.map((field, index) => {
                                        const write = readOnly === index;
                                        return (
                                            <div className="flex items-center" key={field.id}>
                                                <span className="px-3">{index + 1}.</span>
                                                <FormField control={form.control} name={`terms.${index}`} render={({ field: termField }) => (
                                                    <FormItem className="w-full">
                                                        <FormControl>
                                                            <Input className={cn('border-transparent rounded-xs h-6 shadow-none', !write ? '' : 'border-b border-b-foreground')}
                                                                readOnly={!write} {...termField} />
                                                        </FormControl>
                                                    </FormItem>
                                                )} />
                                                <Button variant="ghost" type="button" onClick={(e) => {
                                                    e.preventDefault();
                                                    if (write) {
                                                        setReadOnly(-1);
                                                    } else if (readOnly === -1) {
                                                        setReadOnly(index);
                                                    } else {
                                                        toast.error(`Please save term ${readOnly + 1} before editing`);
                                                    }
                                                }}>
                                                    {!write ? <Pencil size={20} /> : <Save size={20} />}
                                                </Button>
                                                <Button variant="ghost" type="button" onClick={(e) => {
                                                    e.preventDefault();
                                                    if (readOnly === index) setReadOnly(-1);
                                                    termsArray.remove(index);
                                                }}>
                                                    <Trash className="text-red-300" size={20} />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="w-full flex justify-end p-3">
                                    <Button className="w-50" variant="outline" type="button" onClick={(e) => {
                                        e.preventDefault();
                                        if (termsArray.fields.length < 11) {
                                            if (readOnly === -1) {
                                                termsArray.append('');
                                                setReadOnly(termsArray.fields.length);
                                            } else {
                                                toast.error(`Please save term ${readOnly + 1} before creating`);
                                            }
                                        } else {
                                            toast.error('Only 10 terms are allowed');
                                        }
                                    }}>
                                        Add Term
                                    </Button>
                                </div>
                            </div>

                            <hr />

                            <div className="text-center flex justify-between gap-5 px-7 items-center">
                            </div>
                        </div>

                        {/* Submit Buttons */}
                        <div className="grid grid-cols-3 gap-3 p-3 w-full max-w-6xl bg-background m-5 shadow-md rounded-md">
                            <Button type="reset" variant="outline" onClick={() => form.reset()}>
                                Reset
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handlePreview}
                                disabled={!vendor || indents.length === 0}
                            >
                                <Eye size={20} className="mr-2" />
                                Preview
                            </Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <Loader size={20} color="white" aria-label="Loading Spinner" />}
                                Save And Send PO
                            </Button>
                        </div>

                        {/* Preview Dialog */}
                        <Dialog open={showPreview} onOpenChange={setShowPreview}>
                            <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] p-0 gap-0">
                                <DialogHeader className="px-6 py-4 border-b">
                                    <DialogTitle>PO Preview</DialogTitle>
                                </DialogHeader>
                                <div className="w-full h-[calc(95vh-70px)]">
                                    {previewData && (
                                        <PDFViewer
                                            width="100%"
                                            height="100%"
                                            showToolbar={true}
                                            style={{ border: 'none' }}
                                        >
                                            <POPdf {...previewData} />
                                        </PDFViewer>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    </form>
                </Form>
            </div>
        </div>
    );
};
