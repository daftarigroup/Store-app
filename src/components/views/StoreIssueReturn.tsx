import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { toast } from 'sonner';
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { ClipLoader as Loader } from 'react-spinners';
import { RotateCcw, Trash, Package, ClipboardList } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import IssuePdf from '../element/IssuePdf';
const logo = "/logo.png";

import { supabase } from '@/lib/supabase';
import Heading from '../element/Heading';
import { useEffect, useState, useMemo } from 'react';

import { fetchIssueRecords, updateIssueRecordById, type IssueRecord } from '@/services/issueService';
import { fetchMasterOptions, type MasterData } from '@/services/masterService';
import { useAuth } from '@/context/AuthContext';
import { useSheets } from '@/context/SheetsContext';
import { calculateRealInventory } from '@/lib/inventoryUtils';
import { isAllowedFirm } from '@/lib/firmAccess';


export default () => {
    const { user } = useAuth();
    const {
        inventorySheet,
        indentSheet,
        storeInSheet,
        issueSheet: sheetIssues,
        stockTransferSheet,
        updateAll,
    } = useSheets();

    const [options, setOptions] = useState<MasterData | null>(null);
    const [dataLoading, setDataLoading] = useState(true);

    const fetchData = async () => {
        try {
            setDataLoading(true);
            await updateAll(true);
            const masterOptions = await fetchMasterOptions();
            setOptions(masterOptions);
        } catch (error) {
            console.error('Error fetching data for StoreIssueReturn:', error);
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

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
                    // department: z.string().optional(),
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
                    // department: '',
                },
            ],
        },
    });

    const products = form.watch('products');
    const { fields } = useFieldArray({
        control: form.control,
        name: 'products',
    });

    const selectedProject = form.watch('projectName') || 'All';

    const realInventory = useMemo(() => {
        if (!inventorySheet) return [];
        return calculateRealInventory(
            inventorySheet,
            indentSheet || [],
            storeInSheet || [],
            sheetIssues || [],
            stockTransferSheet || [],
            selectedProject
        );
    }, [inventorySheet, indentSheet, storeInSheet, sheetIssues, stockTransferSheet, selectedProject]);

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

    const processPdfSlip = async (type: 'return', issueNumber: string, data: any) => {
        try {
            const logoBase64 = await fetchLogoAsBase64(logo);

            const blob = await pdf(
                <IssuePdf
                    type={type}
                    issueNumber={issueNumber}
                    date={new Date().toLocaleString('en-IN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                    })}
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
            if (!data.id) {
                toast.error('Please select an issue to return');
                return;
            }

            const rows: Partial<IssueRecord>[] = [];
            for (const product of data.products) {
                const row: Partial<IssueRecord> = {
                    timestamp: new Date().toISOString(),
                    uom: product.uom,
                    group_head: product.groupHead,
                    product_name: product.productName,
                    // Preserve original quantity (don't overwrite with return qty)
                    // quantity: product.quantity, 
                    constructor_name: data.constructorName,
                    site_location: data.siteLocation,
                    firm_name: data.projectName,
                    issue_person_name: data.issuePersonName,
                    return_person_name: data.returnPersonName,
                    damage_remark: data.damageRemark,
                    // Use the product quantity as the return amount for inventory
                    rejected_damage_qty: String(product.quantity || data.rejectedDamageQty || 0),
                };

                rows.push(row);
            }

            // Return Logic
            const updateData: Partial<IssueRecord> = rows[0];
            const currentIssueNumber = sheetIssues.find(i => i.id === data.id)?.issueNo || 'IS-UNKNOWN';
            const returnPdfUrl = await processPdfSlip('return', currentIssueNumber, data);
            updateData.return_slip = returnPdfUrl;

            await updateIssueRecordById(data.id, updateData);
            toast.success('Return updated successfully');

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
                        // department: '',
                    },
                ],
            });
        } catch (error) {
            console.error('Error in onSubmit:', error);
            toast.error('Error while updating return! Please try again');
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    const handleIssueSelect = (issueId: string) => {
        const selected = sheetIssues.find(i => String(i.id) === issueId);
        if (selected) {
            form.setValue('constructorName', selected.constructorName || '');
            form.setValue('siteLocation', selected.siteLocation || '');
            form.setValue('projectName', selected.projectName || '');
            form.setValue('remarks', selected.issueTo || '');
            form.setValue('issuePersonName', selected.issuePersonName || '');

            // Map the product
            form.setValue('products', [
                {
                    // department: selected.department,
                    groupHead: selected.groupHead,
                    productName: selected.productName,
                    quantity: selected.quantity,
                    uom: selected.uom,
                }
            ]);
            form.setValue('id', selected.id);
            toast.info(`Loaded issue ${selected.issueNo}`);
        }
    };



    return (
        <div className="pb-10">
            <Heading
                heading="Store Issue Return"
                subtext="Process material returns"
            >
                <RotateCcw size={50} className="text-primary" />
            </Heading>

            <div className="max-w-6xl mx-auto px-4">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-8">
                        <Card className="border-slate-200 shadow-sm overflow-hidden">
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                                <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500">Return Context</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <FormItem className="lg:col-span-1">
                                        <FormLabel className="text-slate-600 font-semibold text-xs uppercase">Select Issue Number <span className="text-destructive">*</span></FormLabel>
                                        <Select onValueChange={handleIssueSelect}>
                                            <FormControl>
                                                <SelectTrigger className="w-full h-11 bg-white border-slate-200 focus:ring-primary/20">
                                                    <SelectValue placeholder="Search issue no." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {sheetIssues
                                                    .filter(i => {
                                                        const isFirmMatch = isAllowedFirm({ id: i.firm_id, name: i.projectName || i.firm_name }, user?.firm_access || []);
                                                        const isIssued = i.actual1 && i.actual1 !== '';
                                                        const isNotReturned = !(i.return_slip || i.return_person_name || (i.rejected_damage_qty && i.rejected_damage_qty !== '0' && i.rejected_damage_qty !== ''));
                                                        return isFirmMatch && isIssued && isNotReturned;
                                                    })
                                                    .map((issue) => (
                                                        <SelectItem key={issue.id} value={String(issue.id)}>
                                                            {issue.issueNo} - {issue.productName}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>

                                    <FormField
                                        control={form.control}
                                        name="projectName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-slate-600 font-semibold text-xs uppercase">Project Name</FormLabel>
                                                <FormControl>
                                                    <Input {...field} disabled className="h-11 bg-slate-50" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    
                                    <FormField
                                        control={form.control}
                                        name="constructorName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-slate-600 font-semibold text-xs uppercase">Contractor Name</FormLabel>
                                                <FormControl>
                                                    <Input {...field} disabled className="h-11 bg-slate-50" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="siteLocation"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-slate-600 font-semibold text-xs uppercase">Site Location</FormLabel>
                                                <FormControl>
                                                    <Input {...field} disabled className="h-11 bg-slate-50" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 shadow-sm overflow-hidden">
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                                <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500">Return Details</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="returnPersonName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-slate-600 font-semibold">Returner Name <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Who is returning?" className="h-11 bg-white border-slate-200 focus:ring-primary/20" {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="issuePersonName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-slate-600 font-semibold">Original Issuer</FormLabel>
                                                <FormControl>
                                                    <Input {...field} disabled className="h-11 bg-slate-50" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="damageRemark"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-slate-600 font-semibold">Damage Remarks</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Condition of returned item" className="h-11 bg-white border-slate-200 focus:ring-primary/20" {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    
                                    <FormField
                                        control={form.control}
                                        name="remarks"
                                        render={({ field }) => (
                                            <FormItem className="lg:col-span-3">
                                                <FormLabel className="text-slate-600 font-semibold">Original Issue Remarks</FormLabel>
                                                <FormControl>
                                                    <Input {...field} disabled className="h-11 bg-slate-50" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2 px-1">
                                <div className="w-2 h-6 bg-primary rounded-full" />
                                <h3 className="text-lg font-bold text-slate-700">Material Being Returned</h3>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {fields.map((field, index) => {
                                    const groupHead = products[index]?.groupHead;
                                    const originalIssue = sheetIssues.find(i => i.id === form.watch('id'));

                                    return (
                                        <Card
                                            key={field.id}
                                            className="border-slate-200 shadow-sm hover:border-primary/30 transition-colors"
                                        >
                                            <CardContent className="p-4 sm:p-6">
                                                <div className="flex justify-between items-center mb-4">
                                                    <div className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                        Returning Item #{index + 1}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-slate-500 uppercase">Group Head</FormLabel>
                                                        <Input value={groupHead} disabled className="h-11 bg-slate-50" />
                                                    </FormItem>

                                                    <FormItem className="md:col-span-1">
                                                        <FormLabel className="text-xs font-semibold text-slate-500 uppercase">Product Name</FormLabel>
                                                        <Input value={products[index]?.productName} disabled className="h-11 bg-slate-50" />
                                                    </FormItem>

                                                    <FormField
                                                        control={form.control}
                                                        name={`products.${index}.quantity`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold text-slate-700 uppercase">
                                                                    Good Qty to Return {originalIssue ? `(Max: ${originalIssue.quantity})` : ''}
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        className="h-11 bg-white border-primary/20 focus:ring-primary/20 font-bold text-primary"
                                                                        {...field}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="rejectedDamageQty"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold text-red-500 uppercase">
                                                                    Rejected/Damage Qty
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        placeholder="0"
                                                                        className="h-11 bg-white border-red-200 focus:ring-red-100 text-red-600 font-bold"
                                                                        {...field}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="pt-4 pb-10">
                            <Button
                                className="w-full h-11 font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-200/50 transition-all active:scale-[0.98]"
                                type="submit"
                                disabled={form.formState.isSubmitting}
                            >
                                {form.formState.isSubmitting ? (
                                    <Loader size={20} color="white" />
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <RotateCcw size={20} />
                                        Process Material Return
                                    </span>
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
        </div>
    );
};
