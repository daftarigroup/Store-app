


import { ChevronDown, ChevronUp, FilePlus2, Pencil, Plus, Save, Trash, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { z } from 'zod';
import { Button } from '../ui/button';
import { useFieldArray, useForm, type Control, type FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import type { PoMasterSheet, QuotationHistorySheet, MasterDataRow } from '@/types';
import { uploadFile } from '@/lib/fetchers';
import { fetchQuotationHistory, insertQuotationHistory } from '@/services/quotationService';
import { fetchMasterOptions, fetchMasterRecords } from '@/services/masterService';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSheets } from '@/context/SheetsContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '@/context/AuthContext';
import { cn, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { ClipLoader as Loader } from 'react-spinners';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Textarea } from '../ui/textarea';
import { pdf } from '@react-pdf/renderer';
import POPdf, { type POPdfProps } from '../element/QuotationPdf';
import { Checkbox } from '../ui/checkbox';
import { Search as SearchIcon } from 'lucide-react'; 
import Heading from '../element/Heading';
import { sendEmail, generateBiddingEmailHtml } from '@/services/emailService';





type Mode = 'create' | 'history';


interface SupplierInfo {
  name: string;
  address: string;
  gstin: string;
  email?: string;
}


// MASTER Sheet interface for suppliers
interface MasterSheetSupplier {
  supplierName: string;      // Column A
  vendorGstin: string;       // Column B  
  vendorAddress: string;     // Column C
  email?: string;
}


function filterUniqueQuotationNumbers(data: PoMasterSheet[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const row of data) {
    // Convert to string first, then trim
    const q = row.quotationNumber ? String(row.quotationNumber).trim() : ''; // Updated to quotationNumber
    if (q && !seen.has(q)) {
      seen.add(q);
      result.push(q);
    }
  }
  return result;
}


// Generate next quotation number based on existing numbers
function generateNextQuotationNumber(existingNumbers: string[]): string {
  const maxNumber = getMaxQuotationNumber(existingNumbers);
  return `QT-${String(maxNumber + 1).padStart(3, '0')}`;
}

function getMaxQuotationNumber(existingNumbers: string[]): number {
  return existingNumbers
    .map(num => {
      const match = String(num || '').trim().match(/^QT-(\d+)$/i);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(num => num > 0)
    .reduce((max, num) => Math.max(max, num), 0);
}


// Updated schema - removed mandatory validations
const quotationSchema = z.object({
  quotationNumber: z.string(),
  quotationDate: z.coerce.date(),
  suppliers: z.array(z.string()),
  description: z.string(),
  selectedIndents: z.array(z.string()),
  terms: z.array(z.string()),
});


type QuotationForm = z.infer<typeof quotationSchema>;


// Simple Badge component as replacement
const Badge = ({ children, className, onClick }: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) => (
  <span
    className={cn(
      "inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 border",
      className
    )}
    onClick={onClick}
  >
    {children}
  </span>
);


export default function QuotationPage() {
  const { user } = useAuth();

  const { indentSheet, poMasterSheet, updateIndentSheet, updatePoMasterSheet, masterSheet: details } = useSheets();
  const [mode, setMode] = useState<Mode>('create');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [supplierInfos, setSupplierInfos] = useState<SupplierInfo[]>([]);
  const [masterSuppliers, setMasterSuppliers] = useState<MasterSheetSupplier[]>([]);
  const [latestQuotationNumbers, setLatestQuotationNumbers] = useState<string[]>([]);
  const [allHistory, setAllHistory] = useState<QuotationHistorySheet[]>([]);
  const [fullMasterData, setFullMasterData] = useState<MasterDataRow[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [expandedQuotation, setExpandedQuotation] = useState<string | null>(null);





  // Editable cards: make Billing and Destination editable (last two cards)
  const [isEditingBilling, setIsEditingBilling] = useState(false);
  const [billingAddress, setBillingAddress] = useState('');
  const [isEditingDestination, setIsEditingDestination] = useState(false);
  const [destinationAddress, setDestinationAddress] = useState('');


  useEffect(() => {
    if (details) {
      setBillingAddress(details.billingAddress || '');
      setDestinationAddress(details.destinationAddress || '');
    }
  }, [details]);


  const fetchLatestQuotationNumbers = async () => {
    try {
      const quotationHistory = await fetchQuotationHistory();
      console.log('Fetched QUOTATION HISTORY:', quotationHistory);

      if (Array.isArray(quotationHistory)) {
        setAllHistory(quotationHistory);
        const quotationNos = Array.from(new Set(
          quotationHistory
            .map((row: any) => row.quatationNo || '')
            .filter((no: string) => no && no.trim() !== '')
        ));

        setLatestQuotationNumbers(quotationNos);
        console.log('Latest quotation numbers:', quotationNos);
      }
    } catch (error) {
      console.error('Error fetching quotation numbers:', error);
    }
  };

  useEffect(() => {
    fetchLatestQuotationNumbers();
  }, []);


  // Fetch suppliers from MASTER sheet using existing fetchSheet function
  useEffect(() => {
    function hasVendors(data: any): data is { vendors: any[] } {
      return data && typeof data === 'object' && 'vendors' in data;
    }

    const fetchMasterSuppliers = async () => {
      try {
        console.log('Fetching MASTER data...');

        const masterData = await fetchMasterOptions();
        const rawMasterForFilter = await fetchMasterRecords();

        console.log('MASTER data:', masterData);
        console.log('Master Records for filtering:', rawMasterForFilter);

        if (Array.isArray(rawMasterForFilter)) {
          setFullMasterData(rawMasterForFilter as unknown as MasterDataRow[]);
        }

        // Use type guard to safely access vendors
        let vendorsArray: any[] = [];

        if (hasVendors(masterData)) {
          vendorsArray = masterData.vendors || [];
        } else if (Array.isArray(masterData)) {
          vendorsArray = masterData;
        }

        const suppliers: MasterSheetSupplier[] = vendorsArray
          .map((vendor: any) => ({
            supplierName: vendor.vendorName || vendor.supplierName || '',
            vendorGstin: vendor.gstin || vendor.vendorGstin || '',
            vendorAddress: vendor.address || vendor.vendorAddress || '',
            email: vendor.email || ''
          }))
          .filter(supplier => {
            const name = supplier.supplierName;
            return name && typeof name === 'string' && name.trim() !== '';
          });

        console.log('Processed suppliers:', suppliers);
        setMasterSuppliers(suppliers);

        if (suppliers.length === 0) {
          console.warn('No suppliers found in MASTER sheet');
          toast.warning('No suppliers found in MASTER sheet');
        } else {
          console.log(`Successfully loaded ${suppliers.length} suppliers from MASTER sheet`);
          toast.success(`Loaded ${suppliers.length} suppliers`);
        }

      } catch (error) {
        console.error('Error fetching MASTER sheet suppliers:', error);
        toast.error('Failed to load suppliers from MASTER sheet');
      }
    };

    fetchMasterSuppliers();
  }, [details]);


  // Filter eligible items - planned2 NOT NULL and actual2 effectively empty
  const eligibleItems = useMemo(() => {
    console.log('Total indentSheet items:', indentSheet.length);

    const isEmpty = (value: any) => {
      if (value === null || value === undefined) return true;
      if (typeof value !== 'string') return false;
      const normalized = value.trim();
      // Treat common placeholder values as "empty"
      return (
        normalized === '' ||
        normalized.toLowerCase() === 'null' ||
        normalized === '0000-00-00' ||
        normalized === '0000-00-00 00:00:00' ||
        normalized === '0000-00-00T00:00:00'
      );
    };

    const filtered = indentSheet.filter(item => {
      // 1. Stage 1 must be done (Approved)
      // The backend IndentController adds a 'status' field: 'Approved' if approvedIndents.length > 0
      const isApproved = item.status === 'Approved' || item.indentStatus === 'Approved' || !isEmpty(item.actual1);

      // 4. Identify if it already has an enquiry
      const hasQuotationInHistory = allHistory.some(h => h.indentNo === item.indentNumber);

      // 5. Stage check: Identify if it already moved to Stage 3 (HOD Approval) or beyond
      const isAlreadyInNextStage =
        !isEmpty(item.planned3) || !isEmpty(item.planned4);

      // Eligible if Approved AND Not yet in Vendor Rate Update/Approval stages
      return isApproved && !isAlreadyInNextStage;
    }).reverse();

    console.log('Filtered eligible items:', filtered.length);
    return filtered;
  }, [indentSheet, mode, allHistory]);



  const form = useForm<QuotationForm>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      quotationNumber: '',
      quotationDate: new Date(),
      suppliers: [],
      description: '',
      selectedIndents: [],
      terms: [],
    },
  });


  


  // Auto-generate quotation number in create mode - FIXED
  useEffect(() => {
    if (mode === 'create') {
      // Use unique numbers from history for next number generation
      const nextNumber = generateNextQuotationNumber(latestQuotationNumbers);
      form.setValue('quotationNumber', nextNumber);
      console.log('Generated next quotation number:', nextNumber);
    }
  }, [mode, poMasterSheet, latestQuotationNumbers, form]);


  // Handle multiple supplier selection from MASTER sheet - Robust lookup
  const handleSupplierSelect = (supplierName: string) => {
    if (!supplierName) return;

    setSelectedSuppliers(prev => {
      const isAlreadySelected = prev.some(s => s.trim().toLowerCase() === supplierName.trim().toLowerCase());
      const newSuppliers = isAlreadySelected
        ? prev.filter(s => s.trim().toLowerCase() !== supplierName.trim().toLowerCase())
        : [...prev, supplierName];

      form.setValue('suppliers', newSuppliers);

      // Fetch supplier info from MASTER sheet data
      const infos = newSuppliers.map(name => {
        const masterSupplier = masterSuppliers.find(s =>
          (s.supplierName || '').trim().toLowerCase() === name.trim().toLowerCase()
        );
        return {
          name,
          address: masterSupplier?.vendorAddress || '',
          gstin: masterSupplier?.vendorGstin || '',
          email: masterSupplier?.email || ''
        };
      });
      setSupplierInfos(infos);

      console.log('Selected suppliers info:', infos);

      return newSuppliers;
    });
  };





  // Handle checkbox selection
  const handleItemSelection = (indentNumber: string, checked: boolean) => {
    setSelectedItems(prev => {
      if (checked) {
        return [...prev, indentNumber];
      } else {
        return prev.filter(item => item !== indentNumber);
      }
    });
  };


  // Handle select all checkbox
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIndentNumbers = eligibleItems.map(item => item.indentNumber);
      setSelectedItems(allIndentNumbers);
    } else {
      setSelectedItems([]);
    }
  };


  // Update form when selectedItems changes
  useEffect(() => {
    form.setValue('selectedIndents', selectedItems);
  }, [selectedItems, form]);


  // Fixed TypeScript error for useFieldArray
  const termsArray = useFieldArray({
    control: form.control as any,
    name: 'terms',
  });


  async function onSubmit(values: QuotationForm) {
    try {
      if (selectedItems.length === 0) {
        toast.error('Please select at least one item');
        return;
      }

      if (selectedSuppliers.length === 0) {
        toast.error('Please select at least one supplier');
        return;
      }

      const selectedItemsData = eligibleItems.filter(item =>
        selectedItems.includes(item.indentNumber)
      );

      let logoBase64 = '';
      const logoUrl = window.location.origin + '/logo.png';
      try {
        const logoResponse = await fetch(logoUrl);
        if (logoResponse.ok) {
          const logoBlob = await logoResponse.blob();
          logoBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(logoBlob);
          });
        }
      } catch (error) {
        console.error('Failed to load logo for PDF:', error);
      }

      const allQuotationRows: QuotationHistorySheet[] = [];

      // Get all existing quotation numbers to generate unique ones - FIXED
      const allNumbers = [...filterUniqueQuotationNumbers(poMasterSheet), ...latestQuotationNumbers];
      let currentMaxNumber = getMaxQuotationNumber(allNumbers);

      const suppliersToProcess = supplierInfos; 

      if (suppliersToProcess.length === 0) {
        toast.error("Please select at least one supplier.");
        return;
      }

      for (let i = 0; i < suppliersToProcess.length; i++) {
        const supplierInfo = suppliersToProcess[i];

        currentMaxNumber += 1;
        const uniqueQuotationNumber = `QT-${String(currentMaxNumber).padStart(3, '0')}`;
        const sessionToken = crypto.randomUUID(); // Unique token for this vendor session

        const pdfProps: POPdfProps = {
          companyName: details?.companyName || '',
          companyPhone: details?.companyPhone || '',
          companyGstin: details?.companyGstin || '',
          companyPan: details?.companyPan || '',
          companyAddress: details?.companyAddress || '',
          billingAddress: billingAddress,
          destinationAddress: destinationAddress,
          supplierName: supplierInfo.name,
          supplierAddress: supplierInfo.address,
          supplierGstin: supplierInfo.gstin,
          orderNumber: uniqueQuotationNumber,
          orderDate: formatDate(values.quotationDate || new Date()),
          quotationNumber: uniqueQuotationNumber,
          quotationDate: formatDate(values.quotationDate || new Date()),
          enqNo: '',
          enqDate: '',
          description: values.description || '',
          items: selectedItemsData.map(item => ({
            internalCode: item.indentNumber,
            project: item.firmNameMatch || 'N/A',
            product: item.productName,
            description: item.specifications,
            quantity: item.quantity,
            unit: item.uom,
            rate: 0,
            gst: 0,
            discount: 0,
            amount: 0,
          })),
          total: 0,
          gstAmount: 0,
          grandTotal: 0,
          terms: values.terms || [],
          preparedBy: '',
          approvedBy: '',
          logo: logoBase64 || logoUrl,
        };

        const blob = await pdf(<POPdf {...pdfProps} />).toBlob();
        const file = new File([blob], `ENQUIRY-${uniqueQuotationNumber}-${supplierInfo.name}.pdf`, { type: 'application/pdf' });

        if (!supplierInfo.email) {
          toast.error(`Email not found for ${supplierInfo.name}!`);
          continue;
        }

        const pdfUrl = await uploadFile({
          file,
          folderId: 'indent_attachment',
          subFolder: 'indent-pdfs',
          uploadType: 'email',
          email: supplierInfo.email
        });

        // Type-safe mapping to QuotationHistorySheet
        const quotationHistoryRows: QuotationHistorySheet[] = selectedItemsData.map(item => ({
          timestamp: (values.quotationDate || new Date()).toISOString(),
          quatationNo: uniqueQuotationNumber,
          supplierName: supplierInfo.name,
          adreess: supplierInfo.address,
          gst: supplierInfo.gstin,
          indentNo: item.indentNumber,
          product: item.productName,
          description: item.specifications || '',
          qty: String(item.quantity || ''),
          unit: item.uom || '',
          pdfLink: pdfUrl,
          firm: item.firmNameMatch || 'N/A',
          token: sessionToken,
        }));

        allQuotationRows.push(...quotationHistoryRows);

        // Send Email to Vendor
        try {
          const emailHtml = generateBiddingEmailHtml(supplierInfo.name, selectedItemsData[0]?.firmNameMatch || details?.companyName || 'Our Firm', sessionToken);
          await sendEmail({
            to: supplierInfo.email,
            subject: `Enquiry Request: ${uniqueQuotationNumber}`,
            html: emailHtml
          });
          console.log(`Email sent to ${supplierInfo.name} (${supplierInfo.email})`);
        } catch (emailError) {
          console.error(`Failed to send email to ${supplierInfo.name}:`, emailError);
          toast.error(`Enquiry created, but email failed for ${supplierInfo.name}.`);
        }
      }

      console.log('Submitting to QUOTATION HISTORY:', allQuotationRows);
      console.log('Total rows:', allQuotationRows.length);
      console.log('First row:', allQuotationRows[0]);

      // Post to history - inserting multiple rows
      await insertQuotationHistory(allQuotationRows);

      toast.success(`Successfully created ${selectedSuppliers.length} unique enquiry(s) for ${selectedSuppliers.length} supplier(s)`);
      form.reset();
      setSelectedItems([]);
      setSelectedSuppliers([]);
      setSupplierInfos([]);

      setTimeout(() => {
        updatePoMasterSheet();
        updateIndentSheet();
        fetchLatestQuotationNumbers(); // Refresh history
      }, 1000);
    } catch (e) {
      console.error('Submit error:', e);
      toast.error('Failed to create enquiry: ' + (e as Error).message);
    }
  }

  function onError(e: any) {
    console.log('Form errors:', e);
    toast.error('Please check the form');
  }

  const filteredHistory = useMemo(() => {
    if (!historySearch) return allHistory;
    const search = historySearch.toLowerCase();
    return allHistory.filter(h => 
      (h.quatationNo || '').toLowerCase().includes(search) ||
      (h.supplierName || '').toLowerCase().includes(search) ||
      (h.indentNo || '').toLowerCase().includes(search) ||
      (h.product || '').toLowerCase().includes(search) ||
      (h.firm || '').toLowerCase().includes(search)
    );
  }, [allHistory, historySearch]);

  const toggleExpand = (quotationNo: string) => {
    setExpandedQuotation(expandedQuotation === quotationNo ? null : quotationNo);
  };

  const groupedHistory = useMemo(() => {
    const groups: Record<string, QuotationHistorySheet[]> = {};
    filteredHistory.forEach(item => {
      const qNo = item.quatationNo || 'Unknown';
      if (!groups[qNo]) {
        groups[qNo] = [];
      }
      groups[qNo].push(item);
    });
    
    return Object.entries(groups).map(([quatationNo, items]) => ({
      quatationNo,
      items,
      timestamp: items[0].timestamp,
      supplierName: items[0].supplierName,
      firm: items[0].firm,
      pdfLink: items[0].pdfLink,
    })).sort((a, b) => {
        return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
    });
  }, [filteredHistory]);

  const renderHistoryTable = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search history..."
            className="pl-8"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
          />
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {groupedHistory.length} unique enquiries
        </div>
      </div>

      <div className="border rounded-md bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10"></TableHead>
              <TableHead className="font-bold">Date</TableHead>
              <TableHead className="font-bold">Enquiry No</TableHead>
              <TableHead className="font-bold">Supplier</TableHead>
              <TableHead className="font-bold">Project</TableHead>
              <TableHead className="font-bold">Items Count</TableHead>
              <TableHead className="font-bold text-right pr-4">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedHistory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  No history records found
                </TableCell>
              </TableRow>
            ) : (
              groupedHistory.map((group) => (
                <Fragment key={group.quatationNo}>
                  <TableRow 
                    className="hover:bg-muted/30 cursor-pointer transition-colors" 
                    onClick={() => toggleExpand(group.quatationNo)}
                  >
                    <TableCell>
                      {expandedQuotation === group.quatationNo ? (
                        <ChevronUp size={18} className="text-primary" />
                      ) : (
                        <ChevronDown size={18} className="text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {group.timestamp ? formatDate(new Date(group.timestamp)) : 'N/A'}
                    </TableCell>
                    <TableCell className="font-medium text-blue-600">{group.quatationNo}</TableCell>
                    <TableCell>{group.supplierName}</TableCell>
                    <TableCell>{group.firm || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                        {group.items.length} Product(s)
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      {group.pdfLink && (
                        <Button variant="ghost" size="sm" asChild onClick={(e) => e.stopPropagation()}>
                          <a href={group.pdfLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 flex items-center gap-1 justify-end">
                            View PDF
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedQuotation === group.quatationNo && (
                    <TableRow className="bg-muted/5 animate-in fade-in slide-in-from-top-1 duration-200">
                      <TableCell colSpan={7} className="p-0 border-t">
                        <div className="px-12 py-6 bg-slate-50/50">
                          <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-slate-100/80">
                                  <TableHead className="h-9 text-xs font-bold text-slate-600">SR.</TableHead>
                                  <TableHead className="h-9 text-xs font-bold text-slate-600">INDENT NO</TableHead>
                                  <TableHead className="h-9 text-xs font-bold text-slate-600">PROJECT</TableHead>
                                  <TableHead className="h-9 text-xs font-bold text-slate-600">PRODUCT</TableHead>

                                  <TableHead className="h-9 text-xs font-bold text-slate-600 text-center">QTY</TableHead>
                                  <TableHead className="h-9 text-xs font-bold text-slate-600">UNIT</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.items.map((item, i) => (
                                  <TableRow key={i} className="hover:bg-slate-50 border-b last:border-0">
                                    <TableCell className="py-2.5 text-xs text-slate-600">{i + 1}</TableCell>
                                    <TableCell className="py-2.5 text-xs text-slate-600">{item.indentNo}</TableCell>
                                    <TableCell className="py-2.5 text-xs text-slate-600">{item.firm || 'N/A'}</TableCell>
                                    <TableCell className="py-2.5 text-xs font-medium text-slate-900">
                                      <div>{item.product}</div>
                                      {item.description && <div className="text-[10px] text-slate-400 font-normal">{item.description}</div>}
                                    </TableCell>



                                    <TableCell className="py-2.5 text-xs text-center font-semibold text-slate-700">{item.qty}</TableCell>
                                    <TableCell className="py-2.5 text-xs text-slate-600">{item.unit}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  // Simple inline edit controls
  const EditIconButton = ({ editing, onClick }: { editing: boolean; onClick: () => void }) => (
    <Button type="button" variant="ghost" size="sm" onClick={onClick} className="h-6 w-6 p-0 hover:bg-gray-200">
      {editing ? <Save size={14} className="text-green-600" /> : <Pencil size={14} className="text-gray-600" />}
    </Button>
  );


  const renderForm = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="flex flex-col items-center">
        <div className="space-y-4 p-4 w-full bg-white shadow-md rounded-sm mt-4">
          <div className="flex items-center justify-center gap-4 bg-blue-50 p-4 rounded">
            <img src="/logo.png" alt="Company Logo" className="w-20 h-20 object-contain" />
            <div className="text-center">
              <h1 className="text-2xl font-bold">{details?.companyName}</h1>
              <div>
                <p className="text-sm">{details?.companyAddress}</p>
                <p className="text-sm">Phone No: +{details?.companyPhone}</p>
              </div>
            </div>
          </div>
          <hr />
          <h2 className="text-center font-bold text-lg">Create New Enquiry</h2>
          <hr />

          <div className="grid gap-5 px-4 py-2 text-foreground/80">
            <div className="space-y-3">
              <FormField
                control={form.control as any}
                name="suppliers"
                render={() => (
                  <FormItem>
                    <FormLabel>Suppliers (From MASTER Table)</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Select onValueChange={handleSupplierSelect}>
                          <SelectTrigger size="sm" className="w-full">
                            <SelectValue placeholder="Select suppliers from MASTER Table" />
                          </SelectTrigger>
                          <SelectContent className="z-[100] max-h-[300px]">
                            {masterSuppliers.length === 0 ? (
                              <SelectItem value="no-suppliers" disabled>No suppliers found</SelectItem>
                            ) : (
                              masterSuppliers.map((supplier, k) => (
                                <SelectItem key={k} value={supplier.supplierName}>{supplier.supplierName}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {selectedSuppliers.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selectedSuppliers.map((supplier, index) => (
                              <Badge key={index} className="flex items-center gap-1 cursor-pointer">
                                {supplier}
                                <button type="button" onClick={() => handleSupplierSelect(supplier)} className="ml-1">×</button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <Card className="p-0 gap-0 shadow-xs rounded-[3px]">
              <CardHeader className="bg-muted px-5 py-2">
                <CardTitle className="text-center">Our Commercial Details</CardTitle>
              </CardHeader>
              <CardContent className="p-5 text-sm">
                <p><span className="font-medium">GSTIN</span> {details?.companyGstin}</p>
                <p><span className="font-medium">Pan No.</span> {details?.companyPan}</p>
              </CardContent>
            </Card>

            <Card className="p-0 gap-0 shadow-xs rounded-[3px]">
              <CardHeader className="bg-muted px-5 py-2">
                <CardTitle className="text-center flex items-center justify-between">
                  Billing Address
                  <EditIconButton
                    editing={isEditingBilling}
                    onClick={() => {
                      if (isEditingBilling) toast.success('Billing address updated');
                      setIsEditingBilling(!isEditingBilling);
                    }}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 text-sm">
                <p>M/S {details?.companyName}</p>
                {isEditingBilling ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} className="h-7 text-sm" />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditingBilling(false)} className="h-6 w-6 p-0">
                      <Trash size={12} className="text-red-500" />
                    </Button>
                  </div>
                ) : (
                  <p>{billingAddress}</p>
                )}
              </CardContent>
            </Card>

            <Card className="p-0 gap-0 shadow-xs rounded-[3px]">
              <CardHeader className="bg-muted px-5 py-2">
                <CardTitle className="text-center flex items-center justify-between">
                  Destination Address
                  <EditIconButton
                    editing={isEditingDestination}
                    onClick={() => {
                      if (isEditingDestination) toast.success('Destination address updated');
                      setIsEditingDestination(!isEditingDestination);
                    }}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 text-sm">
                <p>M/S {details?.companyName}</p>
                {isEditingDestination ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input value={destinationAddress} onChange={(e) => setDestinationAddress(e.target.value)} className="h-7 text-sm" />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditingDestination(false)} className="h-6 w-6 p-0">
                      <Trash size={12} className="text-red-500" />
                    </Button>
                  </div>
                ) : (
                  <p>{destinationAddress}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <hr />

          <FormField
            control={form.control as any}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="Enter message" className="resize-y" {...field} />
                </FormControl>
              </FormItem>
            )}
          />




          <hr />

          <div className="mx-4 grid overflow-y-auto overflow-x-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox checked={selectedItems.length === eligibleItems.length && eligibleItems.length > 0} onCheckedChange={handleSelectAll} />
                  </TableHead>
                  <TableHead>SR.</TableHead>
                  <TableHead>INDENT NO</TableHead>
                  <TableHead>PROJECT</TableHead>
                  <TableHead>PRODUCT</TableHead>

                  <TableHead>QTY</TableHead>
                  <TableHead>UNIT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eligibleItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10 text-xl font-bold">
                      No eligible items found
                    </TableCell>
                  </TableRow>
                ) : (
                  eligibleItems.map((item, index) => (
                    <TableRow key={item.indentNumber}>
                      <TableCell>
                        <Checkbox checked={selectedItems.includes(item.indentNumber)} onCheckedChange={(checked) => handleItemSelection(item.indentNumber, checked as boolean)} />
                      </TableCell>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{item.indentNumber}</TableCell>
                      <TableCell>{item.firmNameMatch || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="font-medium">{item.productName}</div>
                        {item.specifications && <div className="text-xs text-muted-foreground">{item.specifications}</div>}
                      </TableCell>

                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.uom}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <hr />

          <div className="space-y-4 px-4 py-2">
            <div className="flex items-center justify-between">
              <FormLabel className="text-base font-bold text-slate-800">TERMS & CONDITIONS</FormLabel>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => termsArray.append('')}
                className="h-8 flex items-center gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <Plus size={16} />
                Add Term
              </Button>
            </div>
            
            <div className="space-y-3">
              {termsArray.fields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-2 group">
                  <span className="mt-2 text-sm font-medium text-slate-400 w-4">{index + 1}.</span>
                  <div className="flex-1">
                    <FormField
                      control={form.control as any}
                      name={`terms.${index}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder={`Term ${index + 1}`} 
                              className="h-9 focus:ring-1 focus:ring-blue-400"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => termsArray.remove(index)}
                    className="h-9 w-9 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <X size={16} />
                  </Button>
                </div>
              ))}
              {termsArray.fields.length === 0 && (
                <p className="text-sm text-center text-slate-400 py-2 bg-slate-50 rounded border border-dashed">
                  No terms added. Click "Add Term" to manually enter terms and conditions.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 w-full max-w-6xl bg-background my-5 shadow-md rounded-md">
          <Button type="reset" variant="outline" onClick={() => { 
            form.reset(); 
            setSelectedItems([]); 
            setSelectedSuppliers([]); 
            setSupplierInfos([]); 
          }}>Reset</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader size={20} color="white" />}
            Save And Send Enquiry
          </Button>
        </div>
      </form>
    </Form>
  );

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-blue-100 via-purple-50 to-blue-50 rounded-md flex flex-col pb-10">
      <Tabs defaultValue="create" className="w-full flex flex-col flex-1" onValueChange={(v) => {
        setMode(v as Mode);
        // Clear selection state when switching modes
        setSelectedItems([]);
        setSelectedSuppliers([]);
        setSupplierInfos([]);
        form.reset();
      }}>
        <Heading
          heading="Enquiry"
          subtext="Create an enquiry from eligible indents or view history"
          tabs
          pendingLabel="Create"
          pendingValue="create"
          historyLabel="History"
          historyValue="history"
          historyCount={allHistory.length}
        >
          <FilePlus2 size={30} className="text-primary" />
        </Heading>

        <div className="w-full">
          <TabsContent value="create" className="m-0 border-none outline-none">
            <div className="px-4">
              {renderForm()}
            </div>
          </TabsContent>



          <TabsContent value="history" className="m-0 border-none outline-none">
            <div className="px-4 py-6">
              {renderHistoryTable()}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
