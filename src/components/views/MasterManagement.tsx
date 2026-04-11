import { Plus, Building2, Mail, MapPin, Receipt, Package, RefreshCw, FileSpreadsheet, Store, Boxes, LayoutGrid, ClipboardList, Tag, Building, Phone, Globe, FileText, Landmark } from 'lucide-react';
import Heading from '../element/Heading';
import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { PuffLoader as Loader } from 'react-spinners';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { fetchMasterRecords, insertMasterData } from '@/services/masterService';
import { Card, CardContent } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';

// --- Schemas ---

const vendorSchema = z.object({
    vendor_name: z.string().min(1, 'Vendor Name is required'),
    vendor_gstin: z.string().optional(),
    vendor_address: z.string().optional(),
    vendor_email: z.string().email('Invalid email').or(z.literal('')),
});

const itemSchema = z.object({
    item_name: z.string().min(1, 'Item Name is required'),
    group_head: z.string().min(1, 'Group Head is required'),
    uom: z.string().optional(),
});

const departmentSchema = z.object({
    department: z.string().min(1, 'Department name is required'),
});

const companySchema = z.object({
    company_name: z.string().min(1, 'Company Name is required'),
    company_gstin: z.string().optional(),
    company_pan: z.string().optional(),
    company_email: z.string().email('Invalid email').or(z.literal('')),
    company_phone: z.string().optional(),
    company_address: z.string().optional(),
    billing_address: z.string().optional(),
    destination_address: z.string().optional(),
});

// --- Component ---

export default () => {
    const [allRecords, setAllRecords] = useState<any[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [openVendorDialog, setOpenVendorDialog] = useState(false);
    const [openItemDialog, setOpenItemDialog] = useState(false);
    const [openDeptDialog, setOpenDeptDialog] = useState(false);
    const [openCompanyDialog, setOpenCompanyDialog] = useState(false);
    const [activeTab, setActiveTab] = useState('vendors');

    const vendorForm = useForm<z.infer<typeof vendorSchema>>({
        resolver: zodResolver(vendorSchema),
        defaultValues: { vendor_name: '', vendor_gstin: '', vendor_address: '', vendor_email: '' },
    });

    const itemForm = useForm<z.infer<typeof itemSchema>>({
        resolver: zodResolver(itemSchema),
        defaultValues: { item_name: '', group_head: '', uom: '' },
    });

    const departmentForm = useForm<z.infer<typeof departmentSchema>>({
        resolver: zodResolver(departmentSchema),
        defaultValues: { department: '' },
    });

    const companyForm = useForm<z.infer<typeof companySchema>>({
        resolver: zodResolver(companySchema),
        defaultValues: {
            company_name: '',
            company_gstin: '',
            company_pan: '',
            company_email: '',
            company_phone: '',
            company_address: '',
            billing_address: '',
            destination_address: '',
        },
    });

    async function loadData() {
        setDataLoading(true);
        try {
            const records = await fetchMasterRecords();
            setAllRecords(records);
        } catch (error) {
            console.error('Failed to fetch master records:', error);
            toast.error('Failed to load master data');
        } finally {
            setDataLoading(false);
        }
    }

    useEffect(() => {
        loadData();
    }, []);

    // --- Columns ---

    const vendorColumns: ColumnDef<any>[] = [
        {
            accessorKey: 'vendor_name',
            header: 'Vendor Name',
            cell: ({ row }) => <div className="flex items-center gap-2 font-medium"><Building2 size={16} className="text-primary" />{row.original.vendor_name || '--'}</div>
        },
        { accessorKey: 'vendor_gstin', header: 'GSTIN', cell: ({ row }) => <span className="font-mono text-xs">{row.original.vendor_gstin || '--'}</span> },
        { accessorKey: 'vendor_email', header: 'Email', cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.vendor_email || '--'}</span> },
        { accessorKey: 'vendor_address', header: 'Address', cell: ({ row }) => <span className="text-xs truncate max-w-[200px] block">{row.original.vendor_address || '--'}</span> }
    ];

    const itemColumns: ColumnDef<any>[] = [
        {
            accessorKey: 'item_name',
            header: 'Product Name',
            cell: ({ row }) => <div className="flex items-center gap-2 font-medium"><Package size={16} className="text-blue-500" />{row.original.item_name || '--'}</div>
        },
        { accessorKey: 'group_head', header: 'Group Head', cell: ({ row }) => <span className="text-xs text-muted-foreground uppercase">{row.original.group_head || '--'}</span> },
        { accessorKey: 'uom', header: 'UOM', cell: ({ row }) => <span className="text-xs font-mono">{row.original.uom || '--'}</span> }
    ];

    const departmentColumns: ColumnDef<any>[] = [
        {
            accessorKey: 'department',
            header: 'Department Name',
            cell: ({ row }) => <div className="flex items-center gap-2 font-medium"><LayoutGrid size={16} className="text-orange-500" />{row.original.department || '--'}</div>
        },
        { accessorKey: 'created_at', header: 'Created At', cell: ({ row }) => <span className="text-xs text-muted-foreground">{new Date(row.original.created_at).toLocaleDateString()}</span> }
    ];

    const companyColumns: ColumnDef<any>[] = [
        {
            accessorKey: 'company_name',
            header: 'Company Name',
            cell: ({ row }) => <div className="flex items-center gap-2 font-medium"><Building size={16} className="text-emerald-500" />{row.original.company_name || '--'}</div>
        },
        { accessorKey: 'company_gstin', header: 'GSTIN', cell: ({ row }) => <span className="font-mono text-xs">{row.original.company_gstin || '--'}</span> },
        { accessorKey: 'company_phone', header: 'Phone', cell: ({ row }) => <span className="text-xs">{row.original.company_phone || '--'}</span> },
        { accessorKey: 'company_email', header: 'Email', cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.company_email || '--'}</span> }
    ];

    // --- Submit Handlers ---

    async function handleSubmission(values: any, dialogSetter: (open: boolean) => void, form: any, type: string) {
        try {
            const res = await insertMasterData(values);
            if (res.success) {
                toast.success(`${type} added to registry`);
                dialogSetter(false);
                form.reset();
                loadData();
            } else throw res.error;
        } catch (error) {
            toast.error(`Failed to save ${type}`);
        }
    }

    const vendorsData = allRecords.filter(r => r.vendor_name);
    const itemsData = allRecords.filter(r => r.item_name);
    
    // Get unique departments from all records that have a department field
    const uniqueDeptNames = Array.from(new Set(allRecords.map(r => r.department).filter(Boolean)));
    const deptsData = uniqueDeptNames.map(name => {
        // Find the first record with this department to get its created_at, or fallback to now
        const original = allRecords.find(r => r.department === name);
        return {
            department: name,
            created_at: original?.created_at || new Date().toISOString()
        };
    });

    const companiesData = allRecords.filter(r => r.company_name);

    return (
        <div className="h-full space-y-6 flex flex-col">
            <Heading
                heading="Master Registry"
                subtext="Universal repository for Vendors, Items, Departments, and Corporate Profiles"
            >
                <div className="bg-gradient-to-br from-indigo-500 to-cyan-500 p-3 rounded-2xl shadow-xl shadow-indigo-500/20 text-white">
                    <FileSpreadsheet size={40} />
                </div>
            </Heading>

            <Tabs defaultValue="vendors" className="w-full flex-1 flex flex-col" onValueChange={setActiveTab}>
                <div className="flex items-center justify-between bg-muted/30 p-1 rounded-xl border border-border/50 max-w-fit mb-4">
                    <TabsList className="bg-transparent h-10">
                        <TabsTrigger value="vendors" className="rounded-lg px-4 gap-2"><Building2 size={16} /> Vendors</TabsTrigger>
                        <TabsTrigger value="items" className="rounded-lg px-4 gap-2"><Boxes size={16} /> Items</TabsTrigger>
                        <TabsTrigger value="departments" className="rounded-lg px-4 gap-2"><LayoutGrid size={16} /> Departments</TabsTrigger>
                        <TabsTrigger value="companies" className="rounded-lg px-4 gap-2"><Building size={16} /> Companies</TabsTrigger>
                    </TabsList>
                </div>

                {/* --- Tab Contents --- */}
                <TabsContent value="vendors" className="mt-0 flex-1 outline-none">
                    <DataTable data={vendorsData} columns={vendorColumns} searchFields={['vendor_name', 'vendor_gstin']} dataLoading={dataLoading} className="h-[calc(100dvh-280px)] overflow-hidden rounded-xl bg-card shadow-2xl"
                        extraActions={<Button className="bg-indigo-600" onClick={() => setOpenVendorDialog(true)}><Plus size={18} /> Add Vendor</Button>}
                    />
                </TabsContent>

                <TabsContent value="items" className="mt-0 flex-1 outline-none">
                    <DataTable data={itemsData} columns={itemColumns} searchFields={['item_name', 'group_head']} dataLoading={dataLoading} className="h-[calc(100dvh-280px)] overflow-hidden rounded-xl bg-card shadow-2xl"
                        extraActions={<Button className="bg-blue-600" onClick={() => setOpenItemDialog(true)}><Plus size={18} /> Add Item</Button>}
                    />
                </TabsContent>

                <TabsContent value="departments" className="mt-0 flex-1 outline-none">
                    <DataTable data={deptsData} columns={departmentColumns} searchFields={['department']} dataLoading={dataLoading} className="h-[calc(100dvh-280px)] overflow-hidden rounded-xl bg-card shadow-2xl"
                        extraActions={<Button className="bg-orange-600" onClick={() => setOpenDeptDialog(true)}><Plus size={18} /> Add Dept</Button>}
                    />
                </TabsContent>

                <TabsContent value="companies" className="mt-0 flex-1 outline-none">
                    <DataTable data={companiesData} columns={companyColumns} searchFields={['company_name', 'company_gstin']} dataLoading={dataLoading} className="h-[calc(100dvh-280px)] overflow-hidden rounded-xl bg-card shadow-2xl"
                        extraActions={<Button className="bg-emerald-600" onClick={() => setOpenCompanyDialog(true)}><Plus size={18} /> Add Company</Button>}
                    />
                </TabsContent>
            </Tabs>

            {/* --- Dialogs --- */}
            
            {/* Vendor Dialog */}
            <Dialog open={openVendorDialog} onOpenChange={setOpenVendorDialog}>
                <DialogContent className="sm:max-w-xl p-0 overflow-hidden rounded-3xl">
                    <div className="bg-gradient-to-r from-indigo-600 to-cyan-600 h-2 w-full" />
                    <Form {...vendorForm}>
                        <form onSubmit={vendorForm.handleSubmit(v => handleSubmission(v, setOpenVendorDialog, vendorForm, 'Vendor'))} className="p-8 space-y-6">
                            <DialogHeader><div className="flex items-center gap-3"><Store size={24} className="text-indigo-600"/><DialogTitle>Register New Vendor</DialogTitle></div></DialogHeader>
                            <div className="grid gap-4">
                                <FormField control={vendorForm.control} name="vendor_name" render={({field}) => <FormItem><FormLabel>Vendor Name</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>}/>
                                <FormField control={vendorForm.control} name="vendor_gstin" render={({field}) => <FormItem><FormLabel>GSTIN</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/>
                                <FormField control={vendorForm.control} name="vendor_email" render={({field}) => <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/>
                                <FormField control={vendorForm.control} name="vendor_address" render={({field}) => <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/>
                            </div>
                            <DialogFooter><Button type="submit" className="bg-indigo-600">Register Vendor</Button></DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Item Dialog */}
            <Dialog open={openItemDialog} onOpenChange={setOpenItemDialog}>
                <DialogContent className="sm:max-w-xl p-0 overflow-hidden rounded-3xl">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 w-full" />
                    <Form {...itemForm}>
                        <form onSubmit={itemForm.handleSubmit(v => handleSubmission(v, setOpenItemDialog, itemForm, 'Item'))} className="p-8 space-y-6">
                            <DialogHeader><div className="flex items-center gap-3"><Boxes size={24} className="text-blue-600"/><DialogTitle>Add New Item</DialogTitle></div></DialogHeader>
                            <div className="grid gap-4">
                                <FormField control={itemForm.control} name="item_name" render={({field}) => <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>}/>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={itemForm.control} name="group_head" render={({field}) => <FormItem><FormLabel>Group Head</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/>
                                    <FormField control={itemForm.control} name="uom" render={({field}) => <FormItem><FormLabel>UOM</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/>
                                </div>
                            </div>
                            <DialogFooter><Button type="submit" className="bg-blue-600">Save Item</Button></DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Department Dialog */}
            <Dialog open={openDeptDialog} onOpenChange={setOpenDeptDialog}>
                <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-3xl">
                    <div className="bg-gradient-to-r from-orange-400 to-red-500 h-2 w-full" />
                    <Form {...departmentForm}>
                        <form onSubmit={departmentForm.handleSubmit(v => handleSubmission(v, setOpenDeptDialog, departmentForm, 'Department'))} className="p-8 space-y-6">
                            <DialogHeader><div className="flex items-center gap-3"><LayoutGrid size={24} className="text-orange-500"/><DialogTitle>Add New Department</DialogTitle></div></DialogHeader>
                            <FormField control={departmentForm.control} name="department" render={({field}) => <FormItem><FormLabel>Department Name</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>}/>
                            <DialogFooter><Button type="submit" className="bg-orange-600 w-full">Create Department</Button></DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Company Dialog */}
            <Dialog open={openCompanyDialog} onOpenChange={setOpenCompanyDialog}>
                <DialogContent className="sm:max-w-2xl p-0 overflow-hidden rounded-3xl">
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-600 h-2 w-full" />
                    <Form {...companyForm}>
                        <form onSubmit={companyForm.handleSubmit(v => handleSubmission(v, setOpenCompanyDialog, companyForm, 'Company Profile'))} className="p-8 space-y-6">
                            <DialogHeader><div className="flex items-center gap-3"><Building size={24} className="text-emerald-500"/><DialogTitle>New Corporate Profile</DialogTitle></div></DialogHeader>
                            <ScrollArea className="max-h-[60vh] pr-4 px-1">
                                <div className="grid gap-6">
                                    <FormField control={companyForm.control} name="company_name" render={({field}) => <FormItem><FormLabel className="flex items-center gap-2"><Building size={14}/> Company Name</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>}/>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={companyForm.control} name="company_gstin" render={({field}) => <FormItem><FormLabel className="flex items-center gap-2"><Receipt size={14}/> GSTIN</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/>
                                        <FormField control={companyForm.control} name="company_pan" render={({field}) => <FormItem><FormLabel className="flex items-center gap-2"><Landmark size={14}/> PAN Number</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={companyForm.control} name="company_email" render={({field}) => <FormItem><FormLabel className="flex items-center gap-2"><Mail size={14}/> Email</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/>
                                        <FormField control={companyForm.control} name="company_phone" render={({field}) => <FormItem><FormLabel className="flex items-center gap-2"><Phone size={14}/> Phone</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/>
                                    </div>
                                    <FormField control={companyForm.control} name="company_address" render={({field}) => <FormItem><FormLabel className="flex items-center gap-2"><MapPin size={14}/> Registered Address</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={companyForm.control} name="billing_address" render={({field}) => <FormItem><FormLabel className="flex items-center gap-2"><FileText size={14}/> Billing Address</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/>
                                        <FormField control={companyForm.control} name="destination_address" render={({field}) => <FormItem><FormLabel className="flex items-center gap-2"><Globe size={14}/> Destination Address</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/>
                                    </div>
                                </div>
                            </ScrollArea>
                            <DialogFooter><Button type="submit" className="bg-emerald-600 font-bold px-10">Save Corporate Profile</Button></DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
};
