import { Plus, Building2, Package, FileSpreadsheet, Boxes, LayoutGrid, Building, Trash, Pencil, X } from 'lucide-react';
import Heading from '../element/Heading';
import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { fetchMasterRecords, insertMasterData, updateMasterData, deleteMasterData } from '@/services/masterService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { Checkbox } from '../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { addItemToInventory } from '@/services/inventoryService';
import { useSheets } from '@/context/SheetsContext';

const nullishToUndefined = (value: unknown) => (value === null || value === '' ? undefined : value);
const optionalText = () => z.preprocess(nullishToUndefined, z.string().optional());
const optionalEmail = () => z.preprocess(nullishToUndefined, z.string().email().optional());
const optionalPaymentType = () => z.preprocess(nullishToUndefined, z.enum(['regular', 'thirdparty']).optional());

const vendorSchema = z.object({
    vendor_name: z.string().min(1, 'Required'),
    vendor_gstin: optionalText(),
    vendor_address: optionalText(),
    vendor_email: optionalEmail(),
    responsible_person: optionalText(),
    location: optionalText(),
    phone: optionalText(),
    regular_conditions: z.array(z.object({ value: z.string() })).default([{ value: '' }]),
    third_party_conditions: z.array(z.object({ value: z.string() })).default([{ value: '' }]),
});
type VendorFormValues = {
    vendor_name: string;
    vendor_gstin: string;
    vendor_address: string;
    vendor_email: string;
    responsible_person: string;
    location: string;
    phone: string;
    regular_conditions: { value: string }[];
    third_party_conditions: { value: string }[];
};
const itemSchema = z.object({
    item_name: z.string().min(1, 'Required'),
    group_head: z.string().min(1, 'Required'),
    uom: z.string().optional(),
    include_in_inventory: z.boolean().default(false),
    inventory_quantity: z.coerce.number().min(0, 'Quantity cannot be negative').default(0),
}).superRefine((data, ctx) => {
    if (data.include_in_inventory && data.inventory_quantity <= 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['inventory_quantity'],
            message: 'Quantity must be greater than 0',
        });
    }
});
const departmentSchema = z.object({ department: z.string().min(1, 'Required') });
const projectSchema = z.object({ firm_name: z.string().min(1, 'Required') });
const companySchema = z.object({ company_name: z.string().min(1, 'Required'), company_gstin: z.string().optional(), company_pan: z.string().optional(), company_email: z.string().email().or(z.literal('')), company_phone: z.string().optional(), company_address: z.string().optional(), billing_address: z.string().optional(), destination_address: z.string().optional() });

export default function MasterManagement() {
    const { updateInventorySheet } = useSheets();
    const [allRecords, setAllRecords] = useState<any[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [openDialog, setOpenDialog] = useState<string | null>(null);

    const vForm = useForm<VendorFormValues>({
        resolver: zodResolver(vendorSchema) as any,
        defaultValues: {
            vendor_name: '',
            vendor_gstin: '',
            vendor_address: '',
            vendor_email: '',
            responsible_person: '',
            location: '',
            phone: '',
            regular_conditions: [{ value: '' }],
            third_party_conditions: [{ value: '' }]
        }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iForm = useForm<z.infer<typeof itemSchema>>({ resolver: zodResolver(itemSchema) as any, defaultValues: { item_name: '', group_head: '', uom: '', include_in_inventory: false, inventory_quantity: 0 } });
    const dForm = useForm<z.infer<typeof departmentSchema>>({ resolver: zodResolver(departmentSchema), defaultValues: { department: '' } });
    const pForm = useForm<z.infer<typeof projectSchema>>({ resolver: zodResolver(projectSchema), defaultValues: { firm_name: '' } });
    const cForm = useForm<z.infer<typeof companySchema>>({ resolver: zodResolver(companySchema), defaultValues: { company_name: '', company_gstin: '', company_pan: '', company_email: '', company_phone: '', company_address: '', billing_address: '', destination_address: '' } });

    const { fields: regFields, append: regAppend, remove: regRemove } = useFieldArray({ control: vForm.control, name: "regular_conditions" });
    const { fields: tpFields, append: tpAppend, remove: tpRemove } = useFieldArray({ control: vForm.control, name: "third_party_conditions" });

    const includeInInventory = iForm.watch('include_in_inventory');

    useEffect(() => { loadData(); }, []);
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        if (openDialog) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = previousOverflow;
        }

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [openDialog]);

    useEffect(() => {
        const parseConds = (val: any) => {
            if (!val) return [{ value: '' }];
            try {
                const parsed = typeof val === 'string' ? JSON.parse(val) : val;
                if (Array.isArray(parsed)) return parsed.map(c => ({ value: typeof c === 'object' ? (c.value || c.text || '') : String(c) }));
                return [{ value: String(parsed) }];
            } catch {
                return [{ value: String(val) }];
            }
        };

        if (editingRecord) {
            const normalized = {
                ...editingRecord,
                vendor_gstin: editingRecord.vendor_gstin ?? '',
                vendor_address: editingRecord.vendor_address ?? '',
                vendor_email: editingRecord.vendor_email ?? '',
                responsible_person: editingRecord.responsible_person ?? '',
                location: editingRecord.location ?? '',
                phone: editingRecord.phone ?? '',
                regular_conditions: parseConds(editingRecord.regular_conditions),
                third_party_conditions: parseConds(editingRecord.third_party_conditions),
                firm_name: editingRecord.firm_name ?? '',
            };
            if (openDialog === 'vendor') vForm.reset(normalized);
            if (openDialog === 'item') iForm.reset({ ...normalized, include_in_inventory: false, inventory_quantity: 0 });
            if (openDialog === 'dept') dForm.reset(normalized);
            if (openDialog === 'project') pForm.reset(normalized);
            if (openDialog === 'company') cForm.reset(normalized);
        } else if (openDialog) {
            if (openDialog === 'vendor') vForm.reset({ vendor_name: '', vendor_gstin: '', vendor_address: '', vendor_email: '', responsible_person: '', location: '', phone: '', regular_conditions: [{ value: '' }], third_party_conditions: [{ value: '' }] });
            if (openDialog === 'item') iForm.reset({ item_name: '', group_head: '', uom: '', include_in_inventory: false, inventory_quantity: 0 });
            if (openDialog === 'dept') dForm.reset({ department: '' });
            if (openDialog === 'project') pForm.reset({ firm_name: '' });
            if (openDialog === 'company') cForm.reset({ company_name: '', company_gstin: '', company_pan: '', company_email: '', company_phone: '', company_address: '', billing_address: '', destination_address: '' });
        }
    }, [editingRecord, openDialog]);

    async function loadData() { setDataLoading(true); try { setAllRecords(await fetchMasterRecords()); } finally { setDataLoading(false); } }

    const handleDelete = async (record: any) => {
        if (confirm('Permanently delete this record?')) {
            const res = await deleteMasterData(record.id);
            if (res.success) { toast.success('Deleted'); loadData(); } else toast.error('Delete failed');
        }
    };

    const handleDeleteByDept = async (deptName: string) => {
        if (confirm(`Remove department "${deptName}"? (Standalone entries deleted, Item entries cleared)`)) {
            const targets = allRecords.filter(r => r.department === deptName);
            const ops = targets.map(t => (!t.item_name && !t.vendor_name && !t.company_name) ? deleteMasterData(t.id) : updateMasterData(t.id, { department: null }));
            await Promise.all(ops);
            toast.success('Department removed'); loadData();
        }
    };

    const getActions = (row: any, type: string) => (
        <div className="flex items-center gap-1 justify-end pr-4">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setEditingRecord(row); setOpenDialog(type); }}><Pencil size={14} /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(row)}><Trash size={14} /></Button>
        </div>
    );

    const vendorColumns: ColumnDef<any>[] = [
        { accessorKey: 'vendor_name', header: 'Vendor Name', cell: ({ row }) => <div className="flex items-center gap-2 font-medium"><Building2 size={16} className="text-primary" />{row.original.vendor_name}</div> },
        { accessorKey: 'vendor_gstin', header: 'GSTIN' },
        { accessorKey: 'vendor_email', header: 'Email' },
        { accessorKey: 'responsible_person', header: 'Responsible Person' },
        { accessorKey: 'phone', header: 'Phone' },
        { accessorKey: 'location', header: 'Location' },
        { id: 'actions', cell: ({ row }) => getActions(row.original, 'vendor') }
    ];

    const itemColumns: ColumnDef<any>[] = [
        { accessorKey: 'item_name', header: 'Product Name', cell: ({ row }) => <div className="flex items-center gap-2 font-medium"><Package size={16} className="text-blue-500" />{row.original.item_name}</div> },
        { accessorKey: 'group_head', header: 'Group Head' },
        { accessorKey: 'uom', header: 'UOM' },
        { id: 'actions', cell: ({ row }) => getActions(row.original, 'item') }
    ];

    const departmentColumns: ColumnDef<any>[] = [
        { accessorKey: 'department', header: 'Dept Name', cell: ({ row }) => <div className="flex items-center gap-2 font-medium"><LayoutGrid size={16} className="text-orange-500" />{row.original.department}</div> },
        {
            id: 'actions', cell: ({ row }) => (
                <div className="flex items-center gap-1 justify-end pr-4">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setEditingRecord(row.original); setOpenDialog('dept'); }}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteByDept(row.original.department)}><Trash size={14} /></Button>
                </div>
            )
        }
    ];
    const projectColumns: ColumnDef<any>[] = [
        { accessorKey: 'firm_name', header: 'Project Name', cell: ({ row }) => <div className="flex items-center gap-2 font-medium"><Building size={16} className="text-purple-500" />{row.original.firm_name}</div> },
        { id: 'actions', cell: ({ row }) => getActions(row.original, 'project') }
    ];

    const companyColumns: ColumnDef<any>[] = [
        { accessorKey: 'company_name', header: 'Company Name', cell: ({ row }) => <div className="flex items-center gap-2 font-medium"><Building size={16} className="text-emerald-500" />{row.original.company_name}</div> },
        { accessorKey: 'company_gstin', header: 'GSTIN' },
        { accessorKey: 'company_address', header: 'Address', cell: ({ row }) => <span className="text-xs truncate max-w-[150px] block">{row.original.company_address || '--'}</span> },
        { id: 'actions', cell: ({ row }) => getActions(row.original, 'company') }
    ];

    const onSubmit = async (values: any, type: string) => {
        let res;
        const vendorPayload = type === 'vendor'
            ? {
                ...values,
                vendor_gstin: values.vendor_gstin || null,
                vendor_address: values.vendor_address || null,
                vendor_email: values.vendor_email || null,
                responsible_person: values.responsible_person || null,
                location: values.location || null,
                phone: values.phone || null,
                regular_conditions: JSON.stringify(values.regular_conditions?.map((c: any) => c.value).filter(Boolean) || []),
                third_party_conditions: JSON.stringify(values.third_party_conditions?.map((c: any) => c.value).filter(Boolean) || []),
            }
            : values;
        const itemPayload = type === 'item'
            ? {
                item_name: values.item_name,
                group_head: values.group_head,
                uom: values.uom,
            }
            : vendorPayload;

        if (editingRecord) {
            if (type === 'dept') {
                const targets = allRecords.filter(r => r.department === editingRecord.department);
                const updates = targets.map(t => updateMasterData(t.id, { department: values.department }));
                const results = await Promise.all(updates);
                res = { success: results.every(r => r.success) };
            } else if (type === 'project') {
                const targets = allRecords.filter(r => r.firm_name === editingRecord.firm_name);
                const updates = targets.map(t => updateMasterData(t.id, { firm_name: values.firm_name }));
                const results = await Promise.all(updates);
                res = { success: results.every(r => r.success) };
            } else {
                res = await updateMasterData(editingRecord.id, itemPayload);
            }
        } else {
            res = await insertMasterData(itemPayload);
            if (res.success && type === 'item' && values.include_in_inventory) {
                const inventoryRes = await addItemToInventory({
                    itemName: values.item_name,
                    groupHead: values.group_head,
                    uom: values.uom,
                    quantity: values.inventory_quantity,
                });

                if (!inventoryRes.success) {
                    toast.error('Item saved, but inventory could not be updated');
                    return;
                }

                updateInventorySheet();
            }
        }
        if (res.success) { toast.success('Saved'); setOpenDialog(null); setEditingRecord(null); loadData(); }
    };

    const vendorsData = allRecords.filter(r => r.vendor_name);
    const itemsData = allRecords.filter(r => r.item_name);
    const departmentsData = Array.from(new Set(allRecords.map(r => r.department).filter(Boolean))).map(name => {
        const original = allRecords.find(r => r.department === name);
        return { department: name, id: original?.id };
    });
    const projectsData = Array.from(new Set(allRecords.map(r => r.firm_name).filter(Boolean))).map(name => {
        const original = allRecords.find(r => r.firm_name === name);
        return { firm_name: name, id: original?.id };
    });
    const companiesData = allRecords.filter(r => r.company_name);

    return (
        <div className="h-full space-y-4 md:space-y-6 flex flex-col px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <Heading heading="Master Registry" subtext="Universal repository for Vendors, Items, Departments, and Corporate Profiles"><div className="bg-gradient-to-br from-indigo-500 to-cyan-500 p-2 sm:p-3 rounded-2xl text-white"><FileSpreadsheet size={32} className="sm:w-10 sm:h-10" /></div></Heading>

            <Tabs defaultValue="vendors" className="flex-1 flex flex-col min-h-0">
                <TabsList className="bg-muted/30 p-1 rounded-xl border border-border/50 mb-4 max-w-fit h-10 sm:h-12 flex-wrap justify-start">
                    <TabsTrigger value="vendors" className="gap-1 sm:gap-2 px-3 sm:px-6 text-xs sm:text-sm"><Building2 size={14} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Vendors</span></TabsTrigger>
                    <TabsTrigger value="items" className="gap-1 sm:gap-2 px-3 sm:px-6 text-xs sm:text-sm"><Boxes size={14} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Items</span></TabsTrigger>
                    <TabsTrigger value="departments" className="gap-1 sm:gap-2 px-3 sm:px-6 text-xs sm:text-sm"><LayoutGrid size={14} className="sm:w-4 sm:h-4" /> <span className="hidden md:inline">Depts</span><span className="md:hidden">D</span></TabsTrigger>
                    <TabsTrigger value="projects" className="gap-1 sm:gap-2 px-3 sm:px-6 text-xs sm:text-sm"><Building size={14} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Project</span></TabsTrigger>
                    <TabsTrigger value="companies" className="gap-1 sm:gap-2 px-3 sm:px-6 text-xs sm:text-sm"><Building size={14} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Companies</span></TabsTrigger>
                </TabsList>

                <TabsContent value="vendors" className="flex-1 outline-none"><DataTable data={vendorsData} columns={vendorColumns} searchFields={['vendor_name']} dataLoading={dataLoading} extraActions={<Button className="bg-indigo-600" onClick={() => { vForm.reset(); setEditingRecord(null); setOpenDialog('vendor'); }}><Plus size={18} /> Add Vendor</Button>} /></TabsContent>
                <TabsContent value="items" className="flex-1 outline-none"><DataTable data={itemsData} columns={itemColumns} searchFields={['item_name']} dataLoading={dataLoading} extraActions={<Button className="bg-blue-600" onClick={() => { iForm.reset(); setEditingRecord(null); setOpenDialog('item'); }}><Plus size={18} /> Add Item</Button>} /></TabsContent>
                <TabsContent value="departments" className="flex-1 outline-none"><DataTable data={departmentsData} columns={departmentColumns} searchFields={['department']} dataLoading={dataLoading} extraActions={<Button className="bg-orange-600" onClick={() => { dForm.reset(); setEditingRecord(null); setOpenDialog('dept'); }}><Plus size={18} /> Add Dept</Button>} /></TabsContent>
                <TabsContent value="projects" className="flex-1 outline-none"><DataTable data={projectsData} columns={projectColumns} searchFields={['firm_name']} dataLoading={dataLoading} extraActions={<Button className="bg-purple-600" onClick={() => { pForm.reset(); setEditingRecord(null); setOpenDialog('project'); }}><Plus size={18} /> Add Project</Button>} /></TabsContent>
                <TabsContent value="companies" className="flex-1 outline-none"><DataTable data={companiesData} columns={companyColumns} searchFields={['company_name']} dataLoading={dataLoading} extraActions={<Button className="bg-emerald-600" onClick={() => { cForm.reset(); setEditingRecord(null); setOpenDialog('company'); }}><Plus size={18} /> Add Company</Button>} /></TabsContent>
            </Tabs>

            <Dialog open={!!openDialog} onOpenChange={(o) => {
                if (!o) {
                    setOpenDialog(null);
                    setEditingRecord(null);
                    vForm.reset();
                    iForm.reset();
                    dForm.reset();
                    pForm.reset();
                    cForm.reset();
                }
            }}>
                <DialogContent className={cn("z-50 w-screen h-[100dvh] max-h-[100dvh] max-w-none p-0 overflow-hidden rounded-none flex flex-col sm:w-[95vw] sm:h-auto sm:max-h-[90vh] sm:rounded-3xl sm:max-w-xl md:max-w-2xl lg:max-w-3xl [&>button]:z-30", openDialog === 'company' && "md:max-w-4xl")}>
                    <div className={cn("h-2 w-full bg-gradient-to-r", openDialog === 'vendor' ? "from-indigo-600 to-cyan-600" : openDialog === 'item' ? "from-blue-600 to-indigo-600" : openDialog === 'dept' ? "from-orange-400 to-red-500" : "from-emerald-500 to-teal-600")} />
                    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                        <div className="sticky top-0 z-20 px-4 sm:px-6 pt-4 sm:pt-6 pb-2 flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/40 shadow-sm">
                            <DialogHeader><DialogTitle className="text-lg sm:text-xl font-bold">{editingRecord ? 'Edit' : 'Add'} {openDialog?.toUpperCase()}</DialogTitle></DialogHeader>
                        </div>
                        <ScrollArea className="flex-1 min-h-0 scroll-smooth overflow-y-auto" type="always">
                            <div className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-24 sm:pb-24">
                                {openDialog === 'vendor' && (
                                    <Form {...vForm}>
                                        <form className="grid gap-4" onSubmit={vForm.handleSubmit(v => onSubmit(v, 'vendor'))}>
                                            <FormField control={vForm.control} name="vendor_name" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Vendor Name</FormLabel>
                                                    <FormControl><Input {...field} placeholder="e.g., ABC Enterprises" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={vForm.control} name="vendor_gstin" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>GSTIN</FormLabel>
                                                    <FormControl><Input {...field} placeholder="e.g., 22AAAAA0000A1Z5" /></FormControl>
                                                </FormItem>
                                            )} />
                                            <FormField control={vForm.control} name="vendor_email" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Email</FormLabel>
                                                    <FormControl><Input {...field} placeholder="e.g., vendor@example.com" /></FormControl>
                                                </FormItem>
                                            )} />
                                            <FormField control={vForm.control} name="phone" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Phone (Optional)</FormLabel>
                                                    <FormControl><Input {...field} placeholder="+91 XXXXX XXXXX" /></FormControl>
                                                </FormItem>
                                            )} />
                                            <FormField control={vForm.control} name="vendor_address" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Vendor Address</FormLabel>
                                                    <FormControl><Input {...field} placeholder="e.g., Plot No. 45, Industrial Area, Phase-I" /></FormControl>
                                                </FormItem>
                                            )} />
                                            <FormField control={vForm.control} name="location" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Location (Optional)</FormLabel>
                                                    <FormControl><Input {...field} placeholder="e.g., New Delhi" /></FormControl>
                                                </FormItem>
                                            )} />
                                            <FormField control={vForm.control} name="responsible_person" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Responsible Person</FormLabel>
                                                    <FormControl><Input {...field} placeholder="e.g., Mr. Rajesh Kumar" /></FormControl>
                                                </FormItem>
                                            )} />
                                            <div className="space-y-6 border rounded-xl p-4 sm:p-6 bg-muted/20 border-border/60">
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <FormLabel className="text-base font-bold text-indigo-700 dark:text-indigo-400">Regular Payment Conditions</FormLabel>
                                                        <Button type="button" variant="outline" size="sm" onClick={() => regAppend({ value: '' })} className="h-7 px-2 text-xs gap-1 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-900/50"><Plus size={12} /> Add</Button>
                                                    </div>
                                                    <div className="space-y-3">
                                                        {regFields.map((field, index) => (
                                                            <div key={field.id} className="flex gap-2 items-center group animate-in slide-in-from-left-2 duration-200">
                                                                <div className="bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center shrink-0">{index + 1}</div>
                                                                <FormField control={vForm.control} name={`regular_conditions.${index}.value` as any} render={({ field }) => (
                                                                    <div className="flex-1 shrink-0"><Input {...field} placeholder="Enter condition..." className="h-9 text-sm" /></div>
                                                                )} />
                                                                <Button type="button" variant="ghost" size="icon" onClick={() => regRemove(index)} className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></Button>
                                                            </div>
                                                        ))}
                                                        {regFields.length === 0 && <p className="text-xs text-muted-foreground italic pl-7">No regular conditions added</p>}
                                                    </div>
                                                </div>

                                                <div className="h-px bg-border/40" />

                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <FormLabel className="text-base font-bold text-emerald-700 dark:text-emerald-400">Third Party Conditions</FormLabel>
                                                        <Button type="button" variant="outline" size="sm" onClick={() => tpAppend({ value: '' })} className="h-7 px-2 text-xs gap-1 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-900/50"><Plus size={12} /> Add</Button>
                                                    </div>
                                                    <div className="space-y-3">
                                                        {tpFields.map((field, index) => (
                                                            <div key={field.id} className="flex gap-2 items-center group animate-in slide-in-from-left-2 duration-200">
                                                                <div className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center shrink-0">{index + 1}</div>
                                                                <FormField control={vForm.control} name={`third_party_conditions.${index}.value` as any} render={({ field }) => (
                                                                    <div className="flex-1 shrink-0"><Input {...field} placeholder="Enter condition..." className="h-9 text-sm" /></div>
                                                                )} />
                                                                <Button type="button" variant="ghost" size="icon" onClick={() => tpRemove(index)} className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></Button>
                                                            </div>
                                                        ))}
                                                        {tpFields.length === 0 && <p className="text-xs text-muted-foreground italic pl-7">No third party conditions added</p>}
                                                    </div>
                                                </div>
                                            </div>

                                            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-sm sm:text-base py-2 sm:py-3 mt-2">Save Vendor</Button>
                                        </form>
                                    </Form>
                                )}
                                {openDialog === 'item' && (
                                    <Form {...iForm}>
                                        <form className="grid gap-4" onSubmit={iForm.handleSubmit(v => onSubmit(v, 'item'))}>
                                            <FormField control={iForm.control} name="item_name" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Item Name</FormLabel>
                                                    <FormControl><Input {...field} placeholder="e.g., Cement OPC 43" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={iForm.control} name="group_head" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Group Head</FormLabel>
                                                    <FormControl><Input {...field} placeholder="e.g., Construction Material" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={iForm.control} name="uom" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>UOM</FormLabel>
                                                    <FormControl><Input {...field} placeholder="e.g., BAG / NOS / MT" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={iForm.control} name="include_in_inventory" render={({ field }) => (
                                                <FormItem className="flex flex-row items-start gap-3 rounded-xl border p-4">
                                                    <FormControl><Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} /></FormControl>
                                                    <div className="space-y-1 leading-none">
                                                        <FormLabel>Add to Inventory</FormLabel>
                                                        <p className="text-sm text-muted-foreground">Include this item in stock immediately after saving.</p>
                                                    </div>
                                                </FormItem>
                                            )} />
                                            {includeInInventory && (
                                                <FormField control={iForm.control} name="inventory_quantity" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Initial Inventory Quantity</FormLabel>
                                                        <FormControl><Input type="number" min={0} {...field} onChange={(e) => field.onChange(e.target.value)} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            )}
                                            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-sm sm:text-base py-2 sm:py-3 mt-2">Save Item</Button>
                                        </form>
                                    </Form>
                                )}
                                {openDialog === 'dept' && (
                                    <Form {...dForm}>
                                        <form className="grid gap-4" onSubmit={dForm.handleSubmit(v => onSubmit(v, 'dept'))}>
                                            <FormField control={dForm.control} name="department" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Department Name</FormLabel>
                                                    <FormControl><Input {...field} placeholder="e.g., Operations / Store" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-sm sm:text-base py-2 sm:py-3 mt-2">Save Department</Button>
                                        </form>
                                    </Form>
                                )}
                                {openDialog === 'project' && (
                                    <Form {...pForm}>
                                        <form className="grid gap-4" onSubmit={pForm.handleSubmit(v => onSubmit(v, 'project'))}>
                                            <FormField control={pForm.control} name="firm_name" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Project Name</FormLabel>
                                                    <FormControl><Input {...field} placeholder="e.g., Project Raipur Phase 2" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-sm sm:text-base py-2 sm:py-3 mt-2">Save Project</Button>
                                        </form>
                                    </Form>
                                )}
                                {openDialog === 'company' && (
                                    <Form {...cForm}>
                                        <form className="grid gap-6" onSubmit={cForm.handleSubmit(v => onSubmit(v, 'company'))}>
                                            <FormField control={cForm.control} name="company_name" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Company Name</FormLabel>
                                                    <FormControl><Input {...field} placeholder="e.g., Pooja Constructions Pvt Ltd" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                                <FormField control={cForm.control} name="company_gstin" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>GSTIN</FormLabel>
                                                        <FormControl><Input {...field} placeholder="e.g., 22AAAAA0000A1Z5" /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={cForm.control} name="company_pan" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>PAN</FormLabel>
                                                        <FormControl><Input {...field} placeholder="e.g., ABCDE1234F" /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={cForm.control} name="company_email" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Email</FormLabel>
                                                        <FormControl><Input {...field} placeholder="e.g., info@company.com" /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={cForm.control} name="company_phone" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Phone</FormLabel>
                                                        <FormControl><Input {...field} placeholder="e.g., +91 99999 00000" /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={cForm.control} name="company_address" render={({ field }) => (
                                                    <FormItem className="sm:col-span-1">
                                                        <FormLabel>Address</FormLabel>
                                                        <FormControl><Input {...field} placeholder="e.g., 123 Business Park, Sector 5..." /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={cForm.control} name="billing_address" render={({ field }) => (
                                                    <FormItem className="sm:col-span-1">
                                                        <FormLabel>Billing Address</FormLabel>
                                                        <FormControl><Input {...field} placeholder="e.g., Same as above or specify billing office" /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={cForm.control} name="destination_address" render={({ field }) => (
                                                    <FormItem className="sm:col-span-1">
                                                        <FormLabel>Destination Address</FormLabel>
                                                        <FormControl><Input {...field} placeholder="e.g., Site Office, Raipur Project" /></FormControl>
                                                    </FormItem>
                                                )} />
                                            </div>
                                            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-sm sm:text-base py-2 sm:py-3 mt-2">Save Company</Button>
                                        </form>
                                    </Form>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
