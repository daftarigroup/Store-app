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
    formatDateTime,
    parseCustomDate,
} from '@/lib/utils';
import { toast } from 'sonner';
import { useSheets } from '@/context/SheetsContext';
import { ClipLoader as Loader } from 'react-spinners';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '../ui/textarea';
import { pdf } from '@react-pdf/renderer';
import POPdf, { type POPdfProps } from '../element/POPdf';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { PDFViewer } from '@react-pdf/renderer';
import { supabase, supabaseEnabled } from '@/lib/supabase';
import { fetchIndents, fetchPoMaster, fetchMasterData, insertPoRecords, updateIndentsAfterPoCreation } from '@/services/poService';
import { upsertSiteEngineer, fetchTermsAndConditions } from '@/services/masterService';

function getFinancialYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed, April is 3
    
    let startYear, endYear;
    if (month >= 3) { // April to December
        startYear = year;
        endYear = year + 1;
    } else { // January to March
        startYear = year - 1;
        endYear = year;
    }
    
    return `${startYear.toString().slice(-2)}-${endYear.toString().slice(-2)}`;
}

function generatePoNumber(poNumbers: string[]): string {
    const financialYear = getFinancialYear();
    const newPrefix = `${financialYear}/`;
    const oldPrefix = `STORE-PO-${financialYear}-`;
    
    if (!poNumbers || poNumbers.length === 0) {
        return `${newPrefix}01`;
    }

    // Extract all numbers for the current financial year
    const existingNumbers = poNumbers
        .filter(po => po && typeof po === 'string' && po.trim() !== '')
        .map(po => {
            const poStr = po.trim();

            // 1. Check for new format: YY-YY/NN or YY-YY/NN-RR
            if (poStr.startsWith(newPrefix)) {
                const afterPrefix = poStr.replace(newPrefix, '').trim();
                const baseNumberPart = afterPrefix.split('-')[0]; // Get the NN part
                const num = parseInt(baseNumberPart, 10);
                return isNaN(num) ? 0 : num;
            }

            // 2. Check for old format: STORE-PO-YY-YY-NN
            if (poStr.startsWith(oldPrefix)) {
                const afterPrefix = poStr.replace(oldPrefix, '').trim();
                const baseNumberPart = afterPrefix.split('-')[0]; // Get the NN part
                const num = parseInt(baseNumberPart, 10);
                return isNaN(num) ? 0 : num;
            }

            return 0;
        })
        .filter(n => n > 0);

    // Find highest number and add 1
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;

    // Pad with leading zero if less than 10
    const nextNumberStr = nextNumber.toString().padStart(2, '0');
    return `${newPrefix}${nextNumberStr}`;
}

function incrementPoRevision(poNumber: string, allPOs: any[]): string {
    // poNumber could be like 25-26/01 or 25-26/01-01
    const parts = poNumber.split('/');
    if (parts.length < 2) return poNumber; // Fallback for legacy format if needed

    const fyPart = parts[0]; // YY-YY
    const rest = parts[1]; // NN or NN-RR
    
    const baseNumber = rest.split('-')[0]; // NN
    const basePo = `${fyPart}/${baseNumber}`;

    // Find all POs that belong to this base number
    const allPoNumbers = allPOs
        .filter((po: any) => po.poNumber && typeof po.poNumber === 'string' && po.poNumber.trim() !== '')
        .map((po: any) => po.poNumber.trim());

    const relatedPos = allPoNumbers.filter(num => num === basePo || num.startsWith(basePo + '-'));

    // Extract existing revision suffixes
    const revisionNumbers = relatedPos.map(num => {
        if (num === basePo) return 0;
        const suffixPart = num.replace(basePo + '-', '');
        const n = parseInt(suffixPart, 10);
        return isNaN(n) ? 0 : n;
    });

    const maxRevision = revisionNumbers.length > 0 ? Math.max(...revisionNumbers) : 0;
    const nextRevision = maxRevision + 1;

    const nextRevisionStr = nextRevision.toString().padStart(2, '0');
    return `${basePo}-${nextRevisionStr}`;
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

const cleanAddress = (addr: string) => {
    if (!addr) return '';
    return addr.replace(/^Project\s+Name,\s*/i, '').trim();
};

interface IndentSheetItem {
    planned4?: string;
    actual4?: string;
    id?: number;
    approvedVendorName?: string | number; // ✅ Allow both string and number
    firmName?: string;
    firmNameMatch?: string;
    firm_id?: number;
    indentNumber?: string;
    productName?: string;
    specifications?: string;
    taxValue1?: string | number;
    taxValue4?: string | number;
    approvedQuantity?: number;
    indentQuantity?: number;
    uom?: string;
    approvedRate?: number;
    quotationNumber?: string;
    quotationDate?: string;
    approvedPaymentTerm?: string;
    approvedAdvancePercent?: string;
    vendorType?: string;
}

interface MasterDetails {
    destinationAddress: string;
    defaultTerms: string[];
    vendors: {
        vendorName: string;
        gstin: string;
        address: string;
        vendorEmail: string;
        personName?: string;
        email?: string;
        phone?: string;
    }[];
    items: {
        itemName: string;
        regularConditions: string[];
        thirdPartyConditions: string[];
    }[];
    firmCompanyMap: Record<string, {
        companyName: string;
        companyAddress: string;
        destinationAddress: string;
        companyGstin: string;
        companyPan: string;
    }>;
    companyName: string;
    companyPhone: string;
    companyGstin: string;
    companyPan: string;
    companyEmail: string;
    companyAddress: string;
    billingAddress: string;
    companyContactPerson: string;
    paymentTerms: string[];
    siteEngineers: { id: number; name: string; number: string; email: string }[];
}


const schema = z.object({
    poNumber: z.string().nonempty(),
    poDate: z.coerce.date(),
    supplierName: z.string().nonempty(),
    supplierAddress: z.string().nonempty(),
    gstin: z.string(),
    companyEmail: z.union([z.string().email(), z.literal('')]).optional(),

    ourEnqNo: z.string().optional(),
    enquiryDate: z.union([z.coerce.date(), z.any().transform(() => undefined)]).optional(),
    description: z.string(),
    indents: z.array(
        z.object({
            id: z.number(),
            indentNumber: z.string().nonempty(),
            quotationNumber: z.string().optional(),
            productName: z.string().optional(),
            specifications: z.string().optional(),
            gst: z.coerce.number(),
            discount: z.coerce.number().default(0).optional(),
            quantity: z.coerce.number().optional(),
            unit: z.string().optional(),
            rate: z.coerce.number().optional(),
            paymentTerm: z.string().optional(),
            numberOfDays: z.coerce.number().optional(),
        })
    ),
    terms: z.array(z.string().nonempty()),
    deliveryDate: z.coerce.date(),
    deliveryDays: z.coerce.number().optional(),
    deliveryType: z.enum(['for', 'exfactory']).optional(),
    siteEngineerName: z.string().optional(),
    siteEngineerEmail: z.string().optional(),
    siteEngineerPhoneNo: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const CreatePO = () => {
    const { user } = useAuth();
    const { updateMasterSheet } = useSheets();

    // Supabase state
    const [indentSheet, setIndentSheet] = useState<IndentSheetItem[]>([]);
    const [poMasterSheet, setPoMasterSheet] = useState<any[]>([]);
    const [details, setDetails] = useState<MasterDetails | null>(null);
    const [dataLoading, setDataLoading] = useState(false);

    const [readOnly, setReadOnly] = useState(-1);
    const [mode, setMode] = useState<'create' | 'revise'>('create');
    const [isEditingDestination, setIsEditingDestination] = useState(false);
    const [destinationAddress, setDestinationAddress] = useState('Khasra No 297/2 & 297/6 Village AKoli, Near Tarpongi Toll Plaza, PO- Devri, Raipur - 493221 (CG)');
    const [firmCompanyName, setFirmCompanyName] = useState('Project Name');
    const [firmCompanyAddress, setFirmCompanyAddress] = useState('Shri Ram Business Park , Block - C, 2nd floor , Room No. 212');
    const [firmCompanyGstin, setFirmCompanyGstin] = useState('');
    const [firmCompanyPan, setFirmCompanyPan] = useState('');
    const [currentProjectName, setCurrentProjectName] = useState('Project Name');
    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState<POPdfProps | null>(null);
    const [masterTerms, setMasterTerms] = useState<{ id: number; title: string; name: string }[]>([]);
    const [localTerms, setLocalTerms] = useState<{ id: number; title: string; name: string }[]>([]);
    const [editingTerm, setEditingTerm] = useState<{ id: number; title: string; name: string } | null>(null);
    const [showAddTerm, setShowAddTerm] = useState(false);
    const [newTerm, setNewTerm] = useState({ title: '', name: '' });

    // Fetch all data from Supabase on mount
    const loadData = useCallback(async () => {
        if (!supabaseEnabled) return;

        try {
            setDataLoading(true);
            const permittedFirms = user?.firm_access || [];
            const [indents, poMaster, masterData] = await Promise.all([
                fetchIndents(permittedFirms),
                fetchPoMaster(permittedFirms),
                fetchMasterData(),
            ]);

            setIndentSheet(indents);
            setPoMasterSheet(poMaster);

            if (!masterData || (!masterData.vendors?.length && !masterData.items?.length)) {
                setDetails({
                    destinationAddress: '',
                    defaultTerms: [],
                    vendors: [],
                    items: [],
                    firmCompanyMap: {},
                    companyName: '',
                    companyPhone: '',
                    companyGstin: '',
                    companyPan: '',
                    companyEmail: '',
                    companyAddress: '',
                    billingAddress: '',
                    companyContactPerson: '',
                    paymentTerms: [],
                    siteEngineers: [],
                } as MasterDetails);
            } else {
                setDetails(masterData as any);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Failed to load data');
        } finally {
            setDataLoading(false);
        }
    }, [user?.username, user?.firm_access]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        fetchTermsAndConditions().then(data => {
            setMasterTerms(data);
            setLocalTerms(data);
        }).catch(() => {});
    }, []);

    const handleEngineerSave = async () => {
        const name = form.getValues('siteEngineerName');
        const number = form.getValues('siteEngineerPhoneNo');
        const email = form.getValues('siteEngineerEmail');

        if (!name || !number || !email) {
            toast.error('Please fill all engineer details');
            return;
        }

        try {
            const res = await upsertSiteEngineer({ name, number, email });
            if (res.success) {
                toast.success('Engineer saved');
                loadData(); // Refresh local state
                updateMasterSheet(); // Sync other components
            } else {
                toast.error('Failed to save engineer');
            }
        } catch (error) {
            console.error('Error saving engineer:', error);
            toast.error('Error saving engineer');
        }
    };



    useEffect(() => {
        if (details && (details as any).destinationAddress) {
            setDestinationAddress(cleanAddress((details as any).destinationAddress));
        }
    }, [details]);
    const form = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            poNumber: '',
            poDate: new Date(),
            supplierName: '',
            supplierAddress: '',
            gstin: '',
            companyEmail: '',
            ourEnqNo: '',
            enquiryDate: undefined as any,
            deliveryDate: new Date(),
            deliveryDays: undefined,
            deliveryType: undefined,
            description: '',
            indents: [],
            terms: [],
            siteEngineerName: '',
            siteEngineerEmail: '',
            siteEngineerPhoneNo: '',
        },
    });



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
                i.approvedVendorName !== '' &&
                i.planned4 !== '' &&
                i.actual4 === '' &&
                normalizedVendorName === normalizedSelectedVendor;
        });
        const firmName = matchingIndents[0]?.firmNameMatch || matchingIndents[0]?.firmName || '';
        setCurrentProjectName(firmName || 'Project Name');

        if (firmName && (details as MasterDetails).firmCompanyMap) {
            const firmKey = Object.keys((details as MasterDetails).firmCompanyMap!).find(
                (key) => normalize(key) === normalize(firmName)
            );

            const companyDetails = firmKey ? (details as MasterDetails).firmCompanyMap![firmKey] : null;

            if (companyDetails) {
                setFirmCompanyName(companyDetails.companyName || '');
                setFirmCompanyAddress(companyDetails.companyAddress || '');
                setFirmCompanyGstin(companyDetails.companyGstin || '');
                setFirmCompanyPan(companyDetails.companyPan || '');
                setDestinationAddress(
                    cleanAddress(companyDetails.destinationAddress || (details as MasterDetails).destinationAddress || '')
                );
            } else {
                setFirmCompanyName((details as MasterDetails).companyName || 'Project Name');
                setFirmCompanyAddress((details as MasterDetails).companyAddress || 'Shri Ram Business Park , Block - C, 2nd floor , Room No. 212');
                setFirmCompanyGstin((details as MasterDetails).companyGstin || '');
                setFirmCompanyPan((details as MasterDetails).companyPan || '');
                setDestinationAddress(cleanAddress((details as MasterDetails).destinationAddress || ''));
            }
        }

        // Payment terms are now handled per item in the table
        // No longer setting top-level paymentTerms and numberOfDays

        form.setValue(
            'indents',
            matchingIndents.map((i: IndentSheetItem) => {
                let gstValue = 0;

                if (i.taxValue1 && !isNaN(Number(i.taxValue1)) && Number(i.taxValue1) > 0) {
                    gstValue = Number(i.taxValue1);
                }
                else if (i.taxValue4 && !isNaN(Number(i.taxValue4)) && Number(i.taxValue4) > 0) {
                    gstValue = Number(i.taxValue4);
                }

                return {
                    id: i.id as number,
                    indentNumber: i.indentNumber || '',
                    quotationNumber: i.quotationNumber || '',
                    productName: i.productName || '',
                    specifications: i.specifications || '',
                    gst: gstValue,
                    discount: 0,
                    quantity: i.approvedQuantity || 0,
                    unit: i.uom || '',
                    rate: i.approvedRate || 0,
                    paymentTerm: i.approvedPaymentTerm || '',
                    numberOfDays: Number(i.approvedAdvancePercent) || 0,
                };
            })
        );

        // Dynamic Terms Population based on Product and Vendor Type - REMOVED for manual entry

        setTimeout(() => form.trigger(['supplierAddress', 'gstin']), 100);

    }, [vendor, details, indentSheet, mode, form]);

    // Mode change effect
    useEffect(() => {
        if (mode === 'revise') {
            form.reset({
                poNumber: '',
                poDate: new Date(),
                supplierName: '',
                supplierAddress: '',
                gstin: '',
                companyEmail: '',
                enquiryDate: undefined as any,
                indents: [],
                terms: [],
                deliveryDate: new Date(),
                deliveryDays: undefined,
                deliveryType: undefined,
                description: '',
            });
        } else {
            if (poMasterSheet && poMasterSheet.length > 0) {
                const poNumbers = poMasterSheet.map((p) => p.poNumber).filter(po => po && po.trim() !== '');
                const newPoNumber = generatePoNumber(poNumbers);
                form.reset({
                    poNumber: newPoNumber,
                    poDate: new Date(),
                    supplierName: '',
                    supplierAddress: '',
                    gstin: '',
                    companyEmail: '',
                    ourEnqNo: '',
                    enquiryDate: undefined as any,
                    indents: [],
                    terms: [],
                    deliveryDate: new Date(),
                    deliveryDays: undefined,
                    deliveryType: undefined,
                    description: '',
                });
            } else {
                form.reset({
                    poNumber: `${getFinancialYear()}/01`,
                    poDate: new Date(),
                    supplierName: '',
                    supplierAddress: '',
                    gstin: '',
                    companyEmail: '',
                    ourEnqNo: '',
                    enquiryDate: undefined as any,
                    indents: [],
                    terms: [],
                    deliveryDate: new Date(),
                    deliveryDays: undefined,
                    deliveryType: undefined,
                    description: '',
                });
            }
        }
    }, [mode, poMasterSheet, details, form]);

    // REVISE MODE - Load PO data when PO number is selected
    useEffect(() => {
        if (mode === 'revise' && poNumber && poNumber.trim() !== '') {
            const poItems = poMasterSheet.filter((p) => p.poNumber === poNumber);
            if (poItems.length > 0) {
                const firstPoItem = poItems[0];
                const vendor = (details as MasterDetails)?.vendors?.find((v) => {
                    const vendorName = v.vendorName?.toLowerCase()?.trim();
                    const partyName = firstPoItem.partyName?.toLowerCase()?.trim();
                    return vendorName === partyName;
                });
                const poDateParsed = parseCustomDate(firstPoItem.timestamp);
                form.setValue('poDate', isNaN(poDateParsed.getTime()) ? new Date() : poDateParsed);
                form.setValue('supplierName', firstPoItem.partyName || '');

                if (vendor) {
                    form.setValue('supplierAddress', firstPoItem.supplierAddress || vendor.address || '');
                    form.setValue('gstin', firstPoItem.supplierGstin || vendor.gstin || '');
                    form.setValue('companyEmail', firstPoItem.companyEmail || vendor.vendorEmail || '');
                } else {
                    form.setValue('supplierAddress', firstPoItem.supplierAddress || '');
                    form.setValue('gstin', firstPoItem.supplierGstin || '');
                    form.setValue('companyEmail', firstPoItem.companyEmail || '');
                }

                form.setValue('ourEnqNo', firstPoItem.enquiryNumber || '');
                const enqDate = parseCustomDate(firstPoItem.enquiryDate);
                form.setValue('enquiryDate', isNaN(enqDate.getTime()) ? undefined as any : enqDate);
                const delDate = parseCustomDate(firstPoItem.deliveryDate);
                form.setValue('deliveryDate', isNaN(delDate.getTime()) ? new Date() : delDate);
                form.setValue('deliveryDays', firstPoItem.deliveryDays || 0);
                form.setValue('deliveryType', (firstPoItem.deliveryType === 'for' || firstPoItem.deliveryType === 'exfactory') ? firstPoItem.deliveryType : undefined);

                const poIndents = poItems.map((poItem) => {
                    const originalIndent = indentSheet.find(i =>
                        i.indentNumber === poItem.internalCode &&
                        i.productName === poItem.product
                    );
                    return {
                        id: originalIndent?.id || 0,
                        indentNumber: poItem.internalCode || '',
                        quotationNumber: poItem.quotationNumber || '',
                        productName: poItem.product || '',
                        specifications: poItem.description || '',
                        gst: poItem.gstPercent || 18,
                        discount: poItem.discountPercent || 0,
                        quantity: poItem.quantity || 0,
                        unit: poItem.unit || '',
                        rate: poItem.rate || 0,
                        paymentTerm: poItem.paymentTerms || '',
                        numberOfDays: poItem.numberOfDays || 0,
                    };
                });
                form.setValue('indents', poIndents);

                const terms: string[] = [];
                // 1. Fetch from Term 1, 2, 3... legacy columns
                for (let i = 1; i <= 20; i++) {
                    const termKey = `term${i}` as keyof PoMasterSheet;
                    const term = firstPoItem[termKey] as string;
                    if (term && typeof term === 'string' && term.trim() !== '') {
                        terms.push(term.trim());
                    }
                }

                // 2. Also fetch from the JSONB 'terms' column
                if (firstPoItem.terms && typeof firstPoItem.terms === 'object') {
                    Object.keys(firstPoItem.terms).forEach(key => {
                        const val = (firstPoItem.terms as any)[key];
                        if (val && typeof val === 'string' && val.trim() !== '' && !terms.includes(val.trim())) {
                            terms.push(val.trim());
                        }
                    });
                }

                form.setValue('terms', terms);

                // Update Commercial Details for Revise Mode
                const firmName = firstPoItem.firmNameMatch || poIndents[0]?.indentNumber.split('/')[0] || '';
                setCurrentProjectName(firmName || 'Project Name');
                
                if (firmName && (details as MasterDetails).firmCompanyMap) {
                    const normalize = (str: any) => {
                        if (!str) return '';
                        if (typeof str !== 'string') return String(str).trim().toLowerCase();
                        return str.trim().toLowerCase();
                    };

                    const firmKey = Object.keys((details as MasterDetails).firmCompanyMap!).find(
                        (key) => normalize(key) === normalize(firmName)
                    );

                    const companyDetails = firmKey ? (details as MasterDetails).firmCompanyMap![firmKey] : null;

                    if (companyDetails) {
                        setFirmCompanyName(companyDetails.companyName || '');
                        setFirmCompanyAddress(companyDetails.companyAddress || '');
                        setFirmCompanyGstin(companyDetails.companyGstin || '');
                        setFirmCompanyPan(companyDetails.companyPan || '');
                        setDestinationAddress(
                            cleanAddress(firstPoItem.destinationAddress || companyDetails.destinationAddress || (details as MasterDetails).destinationAddress || '')
                        );
                    } else {
                        setFirmCompanyName((details as MasterDetails).companyName || 'Project Name');
                        setFirmCompanyAddress((details as MasterDetails).companyAddress || 'Shri Ram Business Park , Block - C, 2nd floor , Room No. 212');
                        setFirmCompanyGstin((details as MasterDetails).companyGstin || '');
                        setFirmCompanyPan((details as MasterDetails).companyPan || '');
                        setDestinationAddress(cleanAddress(firstPoItem.destinationAddress || (details as MasterDetails).destinationAddress || ''));
                    }
                }

                // Populate Site Engineer Details in Revise Mode
                form.setValue('siteEngineerName', firstPoItem.siteEngineerName || '');
                form.setValue('siteEngineerEmail', firstPoItem.siteEngineerEmail || '');
                form.setValue('siteEngineerPhoneNo', firstPoItem.siteEngineerPhoneNo || '');
            }
        }
    }, [poNumber, mode, poMasterSheet, details, indentSheet, form]);

    // Auto-populate Site Engineer Details
    const watchedSiteEngineerName = form.watch('siteEngineerName');
    useEffect(() => {
        if (!watchedSiteEngineerName || !details?.siteEngineers) return;

        const engineer = details.siteEngineers.find(
            (e) => e.name.toLowerCase().trim() === watchedSiteEngineerName.toLowerCase().trim()
        );

        if (engineer) {
            const currentPhone = form.getValues('siteEngineerPhoneNo');
            const currentEmail = form.getValues('siteEngineerEmail');

            if (currentPhone !== engineer.number) {
                form.setValue('siteEngineerPhoneNo', engineer.number, { shouldDirty: true });
            }
            if (currentEmail !== engineer.email) {
                form.setValue('siteEngineerEmail', engineer.email, { shouldDirty: true });
            }
        }
    }, [watchedSiteEngineerName, details?.siteEngineers, form]);

    const handleDestinationEdit = () => setIsEditingDestination(true);
    const handleDestinationSave = () => {
        setIsEditingDestination(false);
        toast.success('Destination address updated');
    };
    const handleDestinationCancel = () => {
        setDestinationAddress((details as MasterDetails)?.destinationAddress || '');
        setIsEditingDestination(false);
    };

    const getLogoBase64 = async (): Promise<string> => {
        return '/logo.png';
    };

    async function generatePreviewData(): Promise<POPdfProps> {
        const values = form.getValues();

        const mappedItems = values.indents.map((indent) => ({
            quantity: indent.quantity || 0,
            rate: indent.rate || 0,
            discountPercent: indent.discount || 0,
            gstPercent: indent.gst || 0,
        }));
        const grandTotal = calculateGrandTotal(mappedItems);
        const subtotal = calculateSubtotal(mappedItems);
        const totalGst = calculateTotalGst(mappedItems);

        const selectedVendor = details?.vendors?.find(v => v.vendorName === values.supplierName);
        const projectName = currentProjectName;

        // Parse terms from form values
        const parsedTerms = [
            ...values.terms.map((text, index) => ({
                num: (index + 1).toString(),
                text: text
            })),
            ...localTerms.map((t, index) => ({
                num: (values.terms.length + index + 1).toString(),
                text: `${t.title}: ${t.name}`
            }))
        ];

        return {
            companyName: firmCompanyName,
            companyAddress: firmCompanyAddress,
            companyPhone: details?.companyPhone || '',
            companyEmail: details?.companyEmail || '',
            companyGstin: firmCompanyGstin,
            companyPan: firmCompanyPan,
            companyContactPerson: details?.companyContactPerson || '',
            supplierName: values.supplierName,
            supplierAddress: values.supplierAddress,
            supplierGstin: values.gstin,
            supplierContactPerson: selectedVendor?.personName || '',
            supplierPhone: selectedVendor?.phone || '',
            supplierEmail: values.companyEmail || '',
            poNumber: mode === 'create' ? values.poNumber : incrementPoRevision(values.poNumber, poMasterSheet),
            poDate: formatDate(values.poDate),
            deliveryDate: formatDate(values.deliveryDate),
            projectName: projectName,
            deliveryAddress: destinationAddress,
            deliveryContactPerson: '', // Could be dynamic if we knew where to get it
            deliveryPhone: '',
            deliveryEmail: '',
            siteEngineerName: values.siteEngineerName || '',
            siteEngineerEmail: values.siteEngineerEmail || '',
            siteEngineerPhoneNo: values.siteEngineerPhoneNo || '',
            subtotal,
            totalGst,
            items: values.indents.map((item) => {
                const indent = indentSheet.find((i: IndentSheetItem) => i.id === item.id);
                return {
                    internalCode: item.indentNumber || indent?.indentNumber || '',
                    quotationNo: item.quotationNumber || indent?.quotationNumber || '',
                    product: item.productName || indent?.productName || '',
                    paymentTerm: item.paymentTerm || '',
                    qty: item.quantity || 0,
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
            totalAmount: grandTotal,
            terms: parsedTerms,
            logo: await getLogoBase64(),
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
            const mappedItems = values.indents.map((indent) => ({
                quantity: indent.quantity || 0,
                rate: indent.rate || 0,
                discountPercent: indent.discount || 0,
                gstPercent: indent.gst || 0,
            }));
            const grandTotal = calculateGrandTotal(mappedItems);
            const subtotal = calculateSubtotal(mappedItems);
            const totalGst = calculateTotalGst(mappedItems);

            const logoBase64 = await getLogoBase64();
            const selectedVendor = details?.vendors?.find(v => v.vendorName === values.supplierName);
            const projectName = currentProjectName;

            // Parse terms from form values
            const parsedTerms = [
                ...values.terms.map((text, index) => ({
                    num: (index + 1).toString(),
                    text: text
                })),
                ...localTerms.map((t, index) => ({
                    num: (values.terms.length + index + 1).toString(),
                    text: `${t.title}: ${t.name}`
                }))
            ];

            const pdfProps: POPdfProps = {
                companyName: firmCompanyName,
                companyAddress: firmCompanyAddress,
                companyPhone: details?.companyPhone || '',
                companyEmail: details?.companyEmail || '',
                companyGstin: firmCompanyGstin,
                companyPan: firmCompanyPan,
                companyContactPerson: details?.companyContactPerson || '',
                supplierName: values.supplierName,
                supplierAddress: values.supplierAddress,
                supplierGstin: values.gstin,
                supplierContactPerson: selectedVendor?.personName || '',
                supplierPhone: selectedVendor?.phone || '',
                supplierEmail: values.companyEmail || '',
                poNumber: poNumber,
                poDate: formatDate(values.poDate),
                deliveryDate: formatDate(values.deliveryDate),
                projectName: projectName,
                deliveryAddress: destinationAddress,
                deliveryContactPerson: '',
                deliveryPhone: '',
                deliveryEmail: '',
                siteEngineerName: values.siteEngineerName || '',
                siteEngineerEmail: values.siteEngineerEmail || '',
                siteEngineerPhoneNo: values.siteEngineerPhoneNo || '',
                subtotal,
                totalGst,
                items: values.indents.map((item) => {
                    const indent = indentSheet.find((i: IndentSheetItem) => i.id === item.id);
                    return {
                        internalCode: item.indentNumber || indent?.indentNumber || '',
                        quotationNo: item.quotationNumber || indent?.quotationNumber || '',
                        product: item.productName || indent?.productName || '',
                        paymentTerm: item.paymentTerm || '',
                        qty: item.quantity || 0,
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
                totalAmount: grandTotal,
                terms: parsedTerms,
                logo: logoBase64 || '/logo.png',
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

            const missingFirmId = values.indents.some((v) => {
                const indent = indentSheet.find((i: IndentSheetItem) => i.indentNumber === v.indentNumber);
                return !indent?.firm_id;
            });
            if (missingFirmId) {
                toast.error('Project ID is required to create a PO');
                return;
            }

            const rows: PoMasterSheet[] = values.indents.map((v) => {
                const indent = indentSheet.find((i: IndentSheetItem) => i.indentNumber === v.indentNumber);

                return {
                    discountPercent: v.discount || 0,
                    gstPercent: v.gst,
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
                    quotationNumber: v.quotationNumber || '',
                    quotationDate: '',
                    enquiryNumber: values.ourEnqNo || '',
                    enquiryDate: values.enquiryDate ? formatDateTime(values.enquiryDate) : '',
                    term1: values.terms[0] || '',
                    term2: values.terms[1] || '',
                    term3: values.terms[2] || '',
                    term4: values.terms[3] || '',
                    term5: values.terms[4] || '',
                    term6: values.terms[5] || '',
                    term7: values.terms[6] || '',
                    term8: values.terms[7] || '',
                    term9: values.terms[8] || '',
                    term10: values.terms[9] || '',
                    deliveryDate: formatDateTime(values.deliveryDate),
                    paymentTerms: v.paymentTerm || '',
                    numberOfDays: v.numberOfDays || 0,
                    deliveryDays: values.deliveryDays || 0,
                    deliveryType: values.deliveryType || '',
                    firmNameMatch: (indent as any)?.firmNameMatch ?? '',
                    firm_id: indent?.firm_id,
                    advancePercent: (v.paymentTerm?.toLowerCase().includes('partly') && (v.paymentTerm?.toLowerCase().includes('advance') || v.paymentTerm?.toLowerCase().includes('pi'))) ? (v.numberOfDays || 0) : 0,
                    advanceAmount: (v.paymentTerm?.toLowerCase().includes('partly') && (v.paymentTerm?.toLowerCase().includes('advance') || v.paymentTerm?.toLowerCase().includes('pi'))) ? (calculateTotal(v.rate || 0, v.gst, v.discount || 0, v.quantity || 0) * (v.numberOfDays || 0)) / 100 : 0,
                    termsObject: {
                        ...values.terms.reduce((acc, term, idx) => {
                            acc[`term${idx + 1}`] = term;
                            return acc;
                        }, {} as Record<string, string>),
                        localTerms: localTerms.map(t => ({ title: t.title, name: t.name }))
                    },
                    destinationAddress: destinationAddress,
                    supplierAddress: values.supplierAddress,
                    supplierGstin: values.gstin,
                    siteEngineerName: values.siteEngineerName || '',
                    siteEngineerEmail: values.siteEngineerEmail || '',
                    siteEngineerPhoneNo: values.siteEngineerPhoneNo || '',
                };
            });

            await insertPoRecords(rows);

            // Update indents to mark PO as created (set actual4 and delivery_date)
            const indentIds = values.indents.map(v => v.id).filter(id => id > 0);
            // Use ISO string for database compatibility to avoid "out of range" error
            const databaseDeliveryDate = values.deliveryDate.toISOString();
            if (indentIds.length > 0) {
                await updateIndentsAfterPoCreation(indentIds, databaseDeliveryDate, poNumber);
            }

            toast.success(`Successfully ${mode}d purchase order`);
            form.reset();

            // Refresh data from Supabase
            const permittedFirms = user?.firm_access || [];
            const [indents, poMaster] = await Promise.all([
                fetchIndents(permittedFirms),
                fetchPoMaster(permittedFirms),
            ]);
            setIndentSheet(indents);
            setPoMasterSheet(poMaster);
        } catch (e) {
            toast.error(`Failed to ${mode} purchase order`);
        }
    }

    function onError(errors: any) {
        console.error('Form validation errors:', errors);
        toast.error('Please fill all required fields');
    }

    return (
        <div className="grid place-items-center w-full bg-gradient-to-br from-blue-100 via-purple-50 to-blue-50 rounded-md">
            <div className="flex justify-between p-5 w-full">
                <div className="flex gap-2 items-center">
                    <FilePlus2 size={50} className="text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold text-primary">Create or Revise PO</h1>
                        <p className="text-muted-foreground text-sm">
                            Create purchase order for indents or revise previous orders
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
                                <div className="text-center">
                                    <h1 className="text-2xl font-bold uppercase">
                                        {details?.companyName || 'Pooja Constructions'}
                                    </h1>
                                    <div>
                                        <p className="text-sm">
                                            Address: {details?.companyAddress || ''}
                                        </p>
                                        <p className="text-sm">Phone No: {details?.companyPhone || ''} </p>
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
                                                                        const vendorName = i.approvedVendorName;
                                                                        const hasVendor = vendorName && typeof vendorName === 'string' && vendorName.trim() !== '';
                                                                        const hasApprovedVendor = i.approvedVendorName && typeof i.approvedVendorName === 'string' && i.approvedVendorName.trim() !== '';
                                                                        const hasPlannedDate = i.planned4 !== '';
                                                                        const hasNoActualDate = i.actual4 === '';
                                                                        return hasVendor && hasApprovedVendor && hasPlannedDate && hasNoActualDate;
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
                                </div>

                                <div className="grid grid-cols-3 gap-x-5">
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

                                <div className="grid grid-cols-3 gap-x-5">
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
                            </div>

                            <hr />

                            {/* Commercial Details Cards */}
                            <div className="grid md:grid-cols-3 gap-3">
                                <Card className="p-0 gap-0 shadow-xs rounded-[3px]">
                                    <CardHeader className="bg-muted px-4 py-1.5">
                                        <CardTitle className="text-center truncate text-[12px]">Project Name</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-3 text-sm flex items-center justify-center min-h-[70px]">
                                        <p className="text-[14px] font-bold text-center leading-tight text-gray-700">{currentProjectName}</p>
                                    </CardContent>
                                </Card>

                                <Card className="p-0 gap-0 shadow-xs rounded-[3px]">
                                    <CardHeader className="bg-muted px-4 py-1.5">
                                        <CardTitle className="text-center flex items-center justify-between text-[12px]">
                                            Destination Address
                                            {vendor && (
                                                <Button type="button" variant="ghost" size="sm"
                                                    onClick={isEditingDestination ? handleDestinationSave : handleDestinationEdit}
                                                    className="h-5 w-5 p-0 hover:bg-gray-200">
                                                    {isEditingDestination ? (
                                                        <Save size={12} className="text-green-600" />
                                                    ) : (
                                                        <Pencil size={12} className="text-gray-600" />
                                                    )}
                                                </Button>
                                            )}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-3 text-[12px]">
                                        {vendor ? (
                                            <>
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

                                <Card className="p-0 gap-0 shadow-xs rounded-[3px]">
                                    <CardHeader className="bg-muted px-4 py-1.5">
                                        <CardTitle className="text-center flex items-center justify-between text-[12px]">
                                            Site Engineer Details
                                            {mode === 'create' && (
                                                <Button type="button" variant="ghost" size="sm" onClick={handleEngineerSave} className="h-5 w-5 p-0 hover:bg-gray-200">
                                                    <Save size={12} className="text-blue-600" />
                                                </Button>
                                            )}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-3 space-y-1">
                                        {/* Name Field */}
                                        <FormField control={form.control} name="siteEngineerName" render={({ field }) => (
                                            <FormItem className="flex items-center gap-2 space-y-0">
                                                <FormLabel className="w-14 text-[10px] font-bold text-gray-500 uppercase shrink-0">Name</FormLabel>
                                                <FormControl>
                                                    <div className="flex-1">
                                                        <Input 
                                                            {...field} 
                                                            className="h-7 text-[11px]" 
                                                            placeholder="Enter Name" 
                                                            list="siteEngineerNameList" 
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                field.onChange(val);
                                                                const eng = details?.siteEngineers.find(e => e.name.toLowerCase().trim() === val.toLowerCase().trim());
                                                                if (eng) {
                                                                    form.setValue('siteEngineerPhoneNo', eng.number);
                                                                    form.setValue('siteEngineerEmail', eng.email);
                                                                }
                                                            }}
                                                        />
                                                        <datalist id="siteEngineerNameList">
                                                            {(details?.siteEngineers || []).map((eng) => (
                                                                <option key={eng.number} value={eng.name} />
                                                            ))}
                                                        </datalist>
                                                    </div>
                                                </FormControl>
                                            </FormItem>
                                        )} />

                                        {/* Phone Field */}
                                        <FormField control={form.control} name="siteEngineerPhoneNo" render={({ field }) => (
                                            <FormItem className="flex items-center gap-2 space-y-0">
                                                <FormLabel className="w-14 text-[10px] font-bold text-gray-500 uppercase shrink-0">Phone</FormLabel>
                                                <FormControl>
                                                    <div className="flex-1">
                                                        <Input 
                                                            {...field} 
                                                            className="h-7 text-[11px]" 
                                                            placeholder="Enter Phone" 
                                                            list="siteEngineerPhoneList" 
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                field.onChange(val);
                                                                const eng = details?.siteEngineers.find(e => e.number === val);
                                                                if (eng) {
                                                                    form.setValue('siteEngineerName', eng.name);
                                                                    form.setValue('siteEngineerEmail', eng.email);
                                                                }
                                                            }}
                                                        />
                                                        <datalist id="siteEngineerPhoneList">
                                                            {(details?.siteEngineers || []).map((eng) => (
                                                                <option key={eng.number} value={eng.number}>
                                                                    {eng.name}
                                                                </option>
                                                            ))}
                                                        </datalist>
                                                    </div>
                                                </FormControl>
                                            </FormItem>
                                        )} />

                                        {/* Email Field */}
                                        <FormField control={form.control} name="siteEngineerEmail" render={({ field }) => (
                                            <FormItem className="flex items-center gap-2 space-y-0">
                                                <FormLabel className="w-14 text-[10px] font-bold text-gray-500 uppercase shrink-0">Email</FormLabel>
                                                <FormControl>
                                                    <div className="flex-1">
                                                        <Input 
                                                            {...field} 
                                                            className="h-7 text-[11px]" 
                                                            placeholder="Enter Email" 
                                                            list="siteEngineerEmailList" 
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                field.onChange(val);
                                                                const eng = details?.siteEngineers.find(e => e.email === val);
                                                                if (eng) {
                                                                    form.setValue('siteEngineerName', eng.name);
                                                                    form.setValue('siteEngineerPhoneNo', eng.number);
                                                                }
                                                            }}
                                                        />
                                                        <datalist id="siteEngineerEmailList">
                                                            {(details?.siteEngineers || []).map((eng) => (
                                                                <option key={eng.number} value={eng.email}>
                                                                    {eng.name}
                                                                </option>
                                                            ))}
                                                        </datalist>
                                                    </div>
                                                </FormControl>
                                            </FormItem>
                                        )} />
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
                                <div className="rounded-[3px] w-full min-w-full overflow-x-auto max-h-[400px] overflow-y-auto">
                                    <Table>
                                        <TableHeader className="bg-muted">
                                            <TableRow>
                                                <TableHead>S/N</TableHead>
                                                <TableHead>Internal Code</TableHead>
                                                <TableHead>Quotation No.</TableHead>
                                                <TableHead>Product</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead>Payment Term</TableHead>
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
                                                        <TableCell className="font-medium">
                                                            <FormField control={form.control} name={`indents.${index}.quotationNumber`} render={({ field }) => (
                                                                <FormItem className="flex justify-center">
                                                                    <FormControl>
                                                                        <Input className="h-9 w-32 text-center bg-gray-50" value={field.value || ''} onChange={field.onChange} />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell>{formValue?.productName || 'No Product'}</TableCell>
                                                        <TableCell>{formValue?.specifications || <span className="text-muted-foreground italic">No description</span>}</TableCell>
                                                        <TableCell>
                                                            <FormField control={form.control} name={`indents.${index}.paymentTerm`} render={({ field }) => (
                                                                <FormItem className="flex justify-center">
                                                                    <FormControl>
                                                                        <Input className="h-9 w-32 text-center bg-gray-50" value={field.value || ''} onChange={field.onChange} />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <FormField control={form.control} name={`indents.${index}.quantity`} render={({ field }) => (
                                                                <FormItem className="flex justify-center">
                                                                    <FormControl>
                                                                        <Input type="number" className="h-9 w-20 text-center bg-gray-50" value={field.value || 0} onChange={field.onChange} />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <FormField control={form.control} name={`indents.${index}.unit`} render={({ field }) => (
                                                                <FormItem className="flex justify-center">
                                                                    <FormControl>
                                                                        <Input readOnly className="h-9 w-16 text-center bg-gray-50 cursor-not-allowed" value={field.value || ''} onChange={field.onChange} />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <FormField control={form.control} name={`indents.${index}.rate`} render={({ field }) => (
                                                                <FormItem className="flex justify-center">
                                                                    <FormControl>
                                                                        <Input type="number" readOnly className="h-9 w-24 text-center bg-gray-50 cursor-not-allowed" value={field.value || 0} onChange={field.onChange} />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <FormField control={form.control} name={`indents.${index}.gst`} render={({ field }) => (
                                                                <FormItem className="flex items-center justify-center gap-1">
                                                                    <FormControl>
                                                                        <Input type="number" className="h-9 w-16 text-center bg-background" value={field.value || 0} onChange={field.onChange} />
                                                                    </FormControl>
                                                                    <span>%</span>
                                                                </FormItem>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <FormField control={form.control} name={`indents.${index}.discount`} render={({ field }) => (
                                                                <FormItem className="flex items-center justify-center gap-1">
                                                                    <FormControl>
                                                                        <Input type="number" className="h-9 w-16 text-center bg-background" value={field.value || 0} onChange={field.onChange} />
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

                                <div className="w-full flex flex-col gap-2 p-3">
                                    {localTerms.length > 0 && (
                                        <div className="space-y-1 mb-1">
                                            {localTerms.map((t, i) => (
                                                <div key={t.id} className="flex items-center gap-2 text-sm">
                                                    <span className="text-muted-foreground shrink-0 w-5 text-right">{i + 1}.</span>
                                                    <span className="flex-1"><span className="font-medium">{t.title}: </span>{t.name}</span>
                                                    <Button variant="ghost" size="icon" type="button"
                                                        className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                                                        onClick={() => setEditingTerm({ ...t })}>
                                                        <Pencil size={13} />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" type="button"
                                                        className="h-6 w-6 text-muted-foreground hover:text-red-500 shrink-0"
                                                        onClick={() => setLocalTerms(prev => prev.filter(x => x.id !== t.id))}>
                                                        <X size={13} />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <Button className="w-48" variant="outline" type="button" onClick={(e) => {
                                        e.preventDefault();
                                        setNewTerm({ title: '', name: '' });
                                        setShowAddTerm(true);
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

                        {/* Edit Term Dialog */}
                        <Dialog open={!!editingTerm} onOpenChange={open => { if (!open) setEditingTerm(null); }}>
                            <DialogContent className="sm:max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>Edit Term</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-2">
                                    <div className="grid gap-1.5">
                                        <label className="text-sm font-medium">Heading</label>
                                        <Input
                                            value={editingTerm?.title ?? ''}
                                            onChange={e => setEditingTerm(prev => prev ? { ...prev, title: e.target.value } : prev)}
                                            placeholder="e.g. Payment Terms"
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <label className="text-sm font-medium">Condition</label>
                                        <Textarea
                                            value={editingTerm?.name ?? ''}
                                            onChange={e => setEditingTerm(prev => prev ? { ...prev, name: e.target.value } : prev)}
                                            placeholder="e.g. Payment within 30 days of invoice"
                                            rows={6}
                                            className="resize-y"
                                        />
                                    </div>
                                </div>
                                <DialogFooter className="gap-2">
                                    <Button variant="outline" type="button" onClick={() => setEditingTerm(null)}>Cancel</Button>
                                    <Button type="button" onClick={() => {
                                        if (editingTerm) {
                                            setLocalTerms(prev => prev.map(x => x.id === editingTerm.id ? editingTerm : x));
                                            setEditingTerm(null);
                                        }
                                    }}>Save</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* Add Term Dialog */}
                        <Dialog open={showAddTerm} onOpenChange={setShowAddTerm}>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Add Term</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-2">
                                    <div className="grid gap-1.5">
                                        <label className="text-sm font-medium">Heading</label>
                                        <input
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                                            value={newTerm.title}
                                            onChange={e => setNewTerm(prev => ({ ...prev, title: e.target.value }))}
                                            placeholder="e.g. Payment Terms"
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <label className="text-sm font-medium">Condition</label>
                                        <input
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                                            value={newTerm.name}
                                            onChange={e => setNewTerm(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="e.g. Payment within 30 days of invoice"
                                        />
                                    </div>
                                </div>
                                <DialogFooter className="gap-2">
                                    <Button variant="outline" type="button" onClick={() => setShowAddTerm(false)}>Cancel</Button>
                                    <Button type="button" onClick={() => {
                                        if (!newTerm.title.trim() || !newTerm.name.trim()) {
                                            toast.error('Please fill in both heading and condition');
                                            return;
                                        }
                                        setLocalTerms(prev => [...prev, { id: Date.now(), title: newTerm.title.trim(), name: newTerm.name.trim() }]);
                                        setShowAddTerm(false);
                                    }}>Add</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

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

export default CreatePO;
