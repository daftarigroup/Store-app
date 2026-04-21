import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { toast } from 'sonner';
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';
import { ClipLoader as Loader } from 'react-spinners';
import { ClipboardList, Trash, Search, RotateCcw } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import IssuePdf from '../element/IssuePdf';
const logo = "/logo.png";

import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { supabase } from '@/lib/supabase';
import type { IndentSheet } from '@/types';

import type { IssueSheet } from '@/types';
import Heading from '../element/Heading';
import { useEffect, useState } from 'react';

import { fetchIssueRecords, createIssueRecords, updateIssueRecordById, type IssueRecord } from '@/services/issueService';
import { fetchInventoryRecords, type InventoryRecord } from '@/services/inventoryService';
import { fetchMasterOptions, type MasterData } from '@/services/masterService';
import { useAuth } from '@/context/AuthContext';

export default () => {
    const { user } = useAuth();
    const [issueData, setIssueData] = useState<IssueRecord[]>([]);
    const [inventoryData, setInventoryData] = useState<InventoryRecord[]>([]);
    const [options, setOptions] = useState<MasterData | null>(null);
    const [dataLoading, setDataLoading] = useState(true);

    const fetchData = async () => {
        try {
            setDataLoading(true);
            const [issues, inventory, masterOptions] = await Promise.all([
                fetchIssueRecords(),
                fetchInventoryRecords(),
                fetchMasterOptions(),
            ]);
            setIssueData(issues);
            setInventoryData(inventory);
            setOptions(masterOptions);
        } catch (error) {
            console.error('Error fetching data for StoreIssue:', error);
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchTermGroupHead, setSearchTermGroupHead] = useState('');
    const [searchTermProductName, setSearchTermProductName] = useState('');
    const [searchTermUOM, setSearchTermUOM] = useState('');
    const [searchTermDepartment, setSearchTermDepartment] = useState('');

    const schema = z.object({
        constructorName: z.string().nonempty('Contractor Name is required'),
        siteLocation: z.string().nonempty('Site Location is required'),
        projectName: z.string().nonempty('Project Name is required'),
        remarks: z.string().optional(),
        issuePersonName: z.string().optional(),
        returnPersonName: z.string().optional(),
        damageRemark: z.string().optional(),
        rejectedDamageQty: z.coerce.number().optional(),
        id: z.number().optional(),
        products: z
            .array(
                z.object({
                    department: z.string().nonempty(),
                    groupHead: z.string().nonempty(),
                    productName: z.string().nonempty(),
                    quantity: z.coerce.number().gt(0, 'Must be greater than 0'),
                    uom: z.string().nonempty(),
                    givenQuantity: z.coerce.number().gt(0, 'Must be greater than 0').optional(),
                })
            )
            .min(1, 'At least one product is required'),
    });

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            constructorName: '',
            siteLocation: '',
            projectName: '',
            remarks: '',
            issuePersonName: '',
            returnPersonName: '',
            damageRemark: '',
            rejectedDamageQty: 0,
            products: [
                {
                    uom: '',
                    productName: '',
                    quantity: 1,
                    groupHead: '',
                    department: '',
                },
            ],
        },
    });

    const products = form.watch('products');
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'products',
    });

    const fetchLogoAsBase64 = async (url: string): Promise<string> => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Error fetching logo:', error);
            return '';
        }
    };

    const processPdfSlip = async (type: 'issue' | 'return', issueNumber: string, data: any) => {
        try {
            // Pre-fetch logo as base64 to avoid Buffer errors in browser
            const logoBase64 = await fetchLogoAsBase64(logo);

            const blob = await pdf(
                <IssuePdf
                    type={type}
                    issueNumber={issueNumber}
                    date={new Date().toLocaleDateString()}
                    constructorName={data.constructorName}
                    siteLocation={data.siteLocation}
                    projectName={data.projectName}
                    remarks={data.remarks}
                    issuePersonName={data.issuePersonName}
                    returnPersonName={data.returnPersonName}
                    damageRemark={data.damageRemark}
                    rejectedDamageQty={data.rejectedDamageQty}
                    products={data.products}
                    logo={logoBase64}
                />
            ).toBlob();

            const fileName = `${issueNumber}_${type}_${Date.now()}.pdf`;
            const filePath = `indent-pdfs/${fileName}`;

            // Convert blob to File for better compatibility
            const pdfFile = new File([blob], fileName, { type: 'application/pdf' });

            const { error: uploadError } = await supabase.storage
                .from('indent_attachment')
                .upload(filePath, pdfFile);

            if (uploadError) {
                console.error("Supabase Storage Error:", uploadError);
                throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('indent_attachment')
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (error) {
            console.error(`Error processing ${type} PDF:`, error);
            toast.error(`Failed to generate ${type} slip PDF`);
            return '';
        }
    };

    async function onSubmit(data: z.infer<typeof schema>) {
        try {
            const getNextIssueNumber = (existingIssues: IssueRecord[]) => {
                if (!Array.isArray(existingIssues) || existingIssues.length === 0) return 'IS-0001';

                const availableNumbers = existingIssues
                    .filter((issue) => issue.issue_no && typeof issue.issue_no === 'string')
                    .map((issue) => issue.issue_no!)
                    .filter((num) => /^IS-\d+$/.test(num))
                    .map((num) => parseInt(num.split('-')[1], 10));

                if (availableNumbers.length === 0) return 'IS-0001';

                const lastIssueNumber = Math.max(...availableNumbers);
                return `IS-${String(lastIssueNumber + 1).padStart(4, '0')}`;
            };

            const nextIssueNumber = getNextIssueNumber(issueData);

            const rows: Partial<IssueRecord>[] = [];
            for (const product of data.products) {
                const row: Partial<IssueRecord> = {
                    timestamp: new Date().toISOString(),
                    planned1: new Date().toISOString(),
                    issue_no: nextIssueNumber,
                    issue_to: data.remarks || '',
                    uom: product.uom,
                    group_head: product.groupHead,
                    product_name: product.productName,
                    quantity: product.quantity,
                    department: product.department,
                    constructor_name: data.constructorName,
                    site_location: data.siteLocation,
                    project_name: data.projectName,
                    issue_person_name: data.issuePersonName,
                    return_person_name: data.returnPersonName,
                    damage_remark: data.damageRemark,
                    rejected_damage_qty: String(data.rejectedDamageQty || 0),
                    status: 'Pending',
                };

                rows.push(row);
            }

            if (data.id) {
                // Return Logic
                const updateData: Partial<IssueRecord> = rows[0];
                delete updateData.issue_no;

                // Auto-generate Return PDF
                const currentIssueNumber = issueData.find(i => i.id === data.id)?.issue_no || 'IS-UNKNOWN';
                const returnPdfUrl = await processPdfSlip('return', currentIssueNumber, data);
                updateData.return_slip = returnPdfUrl;

                await updateIssueRecordById(data.id, updateData);
                toast.success('Return updated successfully');
            } else {
                // Create Logic (Issue)
                const issuePdfUrl = await processPdfSlip('issue', nextIssueNumber, data);
                const rowsWithSlip = rows.map(r => ({ ...r, issue_slip: issuePdfUrl }));
                
                await createIssueRecords(rowsWithSlip);
                toast.success('Issue created successfully');
            }

            fetchData(); // Refresh data

            form.reset({
                constructorName: '',
                siteLocation: '',
                projectName: '',
                remarks: '',
                issuePersonName: '',
                returnPersonName: '',
                damageRemark: '',
                rejectedDamageQty: 0,
                products: [
                    {
                        uom: '',
                        productName: '',
                        quantity: 1,
                        groupHead: '',
                        department: '',
                    },
                ],
            });
        } catch (error) {
            console.error('Error in onSubmit:', error);
            toast.error('Error while creating issue! Please try again');
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    console.log('Form values:', form.watch());

    const handleIssueSelect = (issueId: string) => {
        const selected = issueData.find(i => String(i.id) === issueId);
        if (selected) {
            form.setValue('constructorName', selected.constructor_name || '');
            form.setValue('siteLocation', selected.site_location || '');
            form.setValue('projectName', selected.project_name || '');
            form.setValue('remarks', selected.issue_to || '');
            form.setValue('issuePersonName', selected.issue_person_name || '');
            
            // Map the product
            form.setValue('products', [
                {
                    department: selected.department,
                    groupHead: selected.group_head,
                    productName: selected.product_name,
                    quantity: selected.quantity,
                    uom: selected.uom,
                }
            ]);
            form.setValue('id', selected.id);
            toast.info(`Loaded issue ${selected.issue_no}`);
        }
    };

    return (
        <div className="pb-10">
            <Tabs defaultValue="issue" className="w-full" onValueChange={(v) => v === 'issue' && form.reset()}>
                <Heading
                    heading="Store Management"
                    subtext="Handle issues and returns"
                    tabs
                    pendingLabel="Create Issue"
                    historyLabel="Return"
                    pendingValue="issue"
                    historyValue="return"
                >
                    <ClipboardList size={50} className="text-primary" />
                </Heading>

                <TabsContent value="issue">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6 p-5">
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 bg-secondary/20 p-4 rounded-xl border border-secondary/30">
                                <FormField
                                    control={form.control}
                                    name="constructorName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Contractor Name <span className="text-destructive">*</span></FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter contractor name" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="issuePersonName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Issue Person Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter issuer name" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="siteLocation"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Site Location <span className="text-destructive">*</span></FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter site location" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="projectName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Project Name <span className="text-destructive">*</span></FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter project name" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                 <FormField
                                    control={form.control}
                                    name="remarks"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Remarks</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter remarks" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="space-y-4">
                                {fields.map((field, index) => {
                                    const groupHead = products[index]?.groupHead;
                                    const groupHeadOptions = options?.allGroupHeads || [];
                                    const productOptions = options?.products[groupHead] || [];

                                    return (
                                        <div
                                            key={field.id}
                                            className="flex flex-col gap-4 border p-4 rounded-lg relative"
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <h3 className="text-md font-semibold">Product {index + 1}</h3>
                                                {fields.length > 1 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:bg-destructive/10"
                                                        onClick={() => remove(index)}
                                                    >
                                                        <Trash size={18} />
                                                    </Button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1.5fr_2fr_1fr_1fr] gap-4 items-end">
                                                {/* Department Field */}
                                                <FormField
                                                    control={form.control}
                                                    name={`products.${index}.department`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>
                                                                Department
                                                                <span className="text-destructive">*</span>
                                                            </FormLabel>
                                                            <Select
                                                                onValueChange={field.onChange}
                                                                value={field.value}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger className="w-full overflow-hidden">
                                                                        <SelectValue placeholder="Select" className="truncate" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {(options?.departments || [])
                                                                        .map((dep, i) => (
                                                                            <SelectItem key={i} value={dep}>
                                                                                {dep}
                                                                            </SelectItem>
                                                                        ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />

                                                {/* Group Head Field */}
                                                <FormField
                                                    control={form.control}
                                                    name={`products.${index}.groupHead`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>
                                                                Group Head
                                                                <span className="text-destructive">*</span>
                                                            </FormLabel>
                                                            <Select
                                                                onValueChange={field.onChange}
                                                                value={field.value}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger className="w-full overflow-hidden text-left h-auto min-h-[40px] py-1">
                                                                        <SelectValue placeholder="Select" className="truncate whitespace-normal line-clamp-1" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {groupHeadOptions
                                                                        .map((gh, i) => (
                                                                            <SelectItem key={i} value={gh}>
                                                                                {gh}
                                                                            </SelectItem>
                                                                        ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />

                                                {/* Product Name Field */}
                                                <FormField
                                                    control={form.control}
                                                    name={`products.${index}.productName`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>
                                                                Product Name
                                                                <span className="text-destructive">*</span>
                                                            </FormLabel>
                                                            <Select
                                                                onValueChange={field.onChange}
                                                                value={field.value}
                                                                disabled={!groupHead}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger className="w-full overflow-hidden text-left h-auto min-h-[40px] py-1">
                                                                        <SelectValue placeholder="Select" className="truncate whitespace-normal line-clamp-1" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {productOptions
                                                                        .map((dep, i) => (
                                                                            <SelectItem key={i} value={dep}>
                                                                                {dep}
                                                                            </SelectItem>
                                                                        ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />

                                                {/* Quantity Field */}
                                                <FormField
                                                    control={form.control}
                                                    name={`products.${index}.quantity`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>
                                                                Quantity
                                                                <span className="text-destructive">*</span>
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    {...field}
                                                                    disabled={!groupHead}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />

                                                {/* UOM Field */}
                                                <FormField
                                                    control={form.control}
                                                    name={`products.${index}.uom`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>
                                                                UOM
                                                                <span className="text-destructive">*</span>
                                                            </FormLabel>
                                                            <Select
                                                                onValueChange={field.onChange}
                                                                value={field.value}
                                                                disabled={!groupHead}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger className="w-full overflow-hidden">
                                                                        <SelectValue placeholder="UOM" className="truncate" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {(options?.uoms || [])
                                                                        .map((uom, i) => (
                                                                            <SelectItem key={i} value={uom}>
                                                                                {uom}
                                                                            </SelectItem>
                                                                        ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex justify-center mt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                                    onClick={() => append({ uom: '', productName: '', quantity: 1, groupHead: '', department: '' })}
                                >
                                    Add Product
                                </Button>
                            </div>

                            <div>
                                <Button
                                    className="w-full"
                                    type="submit"
                                    disabled={form.formState.isSubmitting}
                                >
                                    {form.formState.isSubmitting && (
                                        <Loader size={20} color="white" aria-label="Loading Spinner" />
                                    )}
                                    Store Issue
                                </Button>
                            </div>
                        </form>
                    </Form>
                </TabsContent>

                <TabsContent value="return">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6 p-5">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-primary/5 p-4 rounded-xl border border-primary/20 items-end">
                                <FormItem className="overflow-hidden">
                                    <FormLabel>Select Issue Number</FormLabel>
                                    <Select onValueChange={handleIssueSelect}>
                                        <FormControl>
                                            <SelectTrigger className="w-full overflow-hidden text-left h-auto min-h-[40px] py-1">
                                                <SelectValue placeholder="Select issue" className="truncate whitespace-normal line-clamp-1" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {issueData.map((issue) => (
                                                <SelectItem key={issue.id} value={String(issue.id)}>
                                                    {issue.issue_no} - {issue.product_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                                <FormField
                                    control={form.control}
                                    name="constructorName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Contractor Name</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="siteLocation"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Site Location</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="projectName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Project Name</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="issuePersonName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Issue Person Name</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="returnPersonName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Return Person Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter returner name" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="remarks"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Issue Remarks</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="damageRemark"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Damage Remark</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter damage details" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="space-y-4">
                                {fields.map((field, index) => {
                                    const groupHead = products[index]?.groupHead;
                                    const groupHeadOptions = options?.allGroupHeads || [];
                                    const productOptions = options?.products[groupHead] || [];

                                    return (
                                        <div
                                            key={field.id}
                                            className="flex flex-col gap-4 border p-4 rounded-lg relative"
                                        >
                                            {(() => {
                                                const originalIssue = issueData.find(i => i.id === form.watch('id'));
                                                return (
                                                    <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1.2fr_2fr_1fr_1.5fr_0.8fr] gap-4 items-end">

                                                <FormField
                                                    control={form.control}
                                                    name={`products.${index}.department`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Department</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger className="w-full overflow-hidden">
                                                                        <SelectValue className="truncate" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {(options?.departments || []).map((dep, i) => (
                                                                        <SelectItem key={i} value={dep}>{dep}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name={`products.${index}.groupHead`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Group Head</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger className="w-full overflow-hidden text-left h-auto min-h-[40px] py-1">
                                                                        <SelectValue className="truncate whitespace-normal line-clamp-1" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {groupHeadOptions.map((gh, i) => (
                                                                        <SelectItem key={i} value={gh}>{gh}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name={`products.${index}.productName`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Product Name {originalIssue ? `(Issue Qty: ${originalIssue.quantity})` : ''}</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger className="w-full overflow-hidden text-left h-auto min-h-[40px] py-1">
                                                                        <SelectValue placeholder="Select" className="truncate whitespace-normal line-clamp-1" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {productOptions.map((p, i) => (
                                                                        <SelectItem key={i} value={p}>{p}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name={`products.${index}.quantity`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Return Qty</FormLabel>
                                                            <FormControl><Input type="number" {...field} /></FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="rejectedDamageQty"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Reject/Damage Qty</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" placeholder="Qty" {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name={`products.${index}.uom`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>UOM</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger className="w-full overflow-hidden">
                                                                        <SelectValue className="truncate" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {(options?.uoms || []).map((u, i) => (
                                                                        <SelectItem key={i} value={u}>{u}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                })}
                            </div>

                            <div>
                                <Button
                                    className="w-full bg-orange-600 hover:bg-orange-700"
                                    type="submit"
                                    disabled={form.formState.isSubmitting}
                                >
                                    {form.formState.isSubmitting && (
                                        <Loader size={20} color="white" aria-label="Loading Spinner" />
                                    )}
                                    Confirm Return
                                </Button>
                            </div>
                        </form>
                    </Form>
                </TabsContent>
            </Tabs>
        </div>
    );
};