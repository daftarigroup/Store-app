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
import { ClipLoader as Loader } from 'react-spinners';
import { RotateCcw } from 'lucide-react';
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

    if (dataLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader size={40} color="#0f172a" />
            </div>
        );
    }

    return (
        <div className="pb-10">
            <Heading
                heading="Store Issue Return"
                subtext="Process material returns"
            >
                <RotateCcw size={50} className="text-primary" />
            </Heading>

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
                                    {sheetIssues
                                        .filter(i => {
                                            const permittedFirms = (user?.firm_access || []).map(f => f.trim().toLowerCase());
                                            const sheetFirm = (i.projectName || i.firm_name || '').trim().toLowerCase();
                                            const isFirmMatch = permittedFirms.includes('all') || permittedFirms.includes(sheetFirm);
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
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="w-full h-10">
                                                <SelectValue placeholder="Select project" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {(options?.firms || []).map((firm, i) => (
                                                <SelectItem key={i} value={firm}>
                                                    {firm}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
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
                            const originalIssue = sheetIssues.find(i => i.id === form.watch('id'));

                            return (
                                <div
                                    key={field.id}
                                    className="flex flex-col gap-4 border p-4 rounded-lg relative"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-[1.2fr_2fr_1fr_1.5fr_0.8fr] gap-4 items-end">
                                        {/* <FormField
                                            control={form.control}
                                            name={`products.${index}.department`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Department</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="w-full overflow-hidden text-left">
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
                                        /> */}
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
                                                            {productOptions.map((p, i) => {
                                                                const inv = realInventory.find(item => item.itemName === p);
                                                                const stock = inv ? inv.current : 0;
                                                                return (
                                                                    <SelectItem key={i} value={p}>
                                                                        {p} (Stock: {stock})
                                                                    </SelectItem>
                                                                );
                                                            })}
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
                                </div>
                            );
                        })}
                    </div>

                    <div>
                        <Button
                            className="w-full bg-orange-600 hover:bg-orange-700 font-bold"
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
        </div>
    );
};
