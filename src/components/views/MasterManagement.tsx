import { Plus, Building2, Mail, MapPin, Receipt, Package, RefreshCw, FileSpreadsheet, Store, Boxes, LayoutGrid, ClipboardList, Tag, Building, Phone, Globe, FileText, Landmark, Trash, Pencil } from 'lucide-react';
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
import { fetchMasterRecords, insertMasterData, updateMasterData, deleteMasterData } from '@/services/masterService';
import { Card, CardContent } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';

const vendorSchema = z.object({ vendor_name: z.string().min(1, 'Required'), vendor_gstin: z.string().optional(), vendor_address: z.string().optional(), vendor_email: z.string().email().or(z.literal('')) });
const itemSchema = z.object({ item_name: z.string().min(1, 'Required'), group_head: z.string().min(1, 'Required'), uom: z.string().optional() });
const departmentSchema = z.object({ department: z.string().min(1, 'Required') });
const companySchema = z.object({ company_name: z.string().min(1, 'Required'), company_gstin: z.string().optional(), company_pan: z.string().optional(), company_email: z.string().email().or(z.literal('')), company_phone: z.string().optional(), company_address: z.string().optional(), billing_address: z.string().optional(), destination_address: z.string().optional() });

export default () => {
    const [allRecords, setAllRecords] = useState<any[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [activeTab, setActiveTab] = useState('vendors');
    const [openDialog, setOpenDialog] = useState<string | null>(null);

    const vForm = useForm<z.infer<typeof vendorSchema>>({ resolver: zodResolver(vendorSchema), defaultValues: { vendor_name: '', vendor_gstin: '', vendor_address: '', vendor_email: '' } });
    const iForm = useForm<z.infer<typeof itemSchema>>({ resolver: zodResolver(itemSchema), defaultValues: { item_name: '', group_head: '', uom: '' } });
    const dForm = useForm<z.infer<typeof departmentSchema>>({ resolver: zodResolver(departmentSchema), defaultValues: { department: '' } });
    const cForm = useForm<z.infer<typeof companySchema>>({ resolver: zodResolver(companySchema), defaultValues: { company_name: '', company_gstin: '', company_pan: '', company_email: '', company_phone: '', company_address: '', billing_address: '', destination_address: '' } });

    useEffect(() => { loadData(); }, []);
    useEffect(() => {
        if (!editingRecord) return;
        const normalized = { ...editingRecord };
        if (openDialog === 'vendor') vForm.reset(normalized);
        if (openDialog === 'item') iForm.reset(normalized);
        if (openDialog === 'dept') dForm.reset(normalized);
        if (openDialog === 'company') cForm.reset(normalized);
    }, [editingRecord, openDialog]);

    async function loadData() { setDataLoading(true); try { setAllRecords(await fetchMasterRecords()); } finally { setDataLoading(false); } }

    const handleDelete = async (record: any) => {
        if (confirm('Permanently delete this record?')) {
            const res = await deleteMasterData(record.created_at);
            if (res.success) { toast.success('Deleted'); loadData(); } else toast.error('Delete failed');
        }
    };

    const handleDeleteByDept = async (deptName: string) => {
        if (confirm(`Remove department "${deptName}"? (Standalone entries deleted, Item entries cleared)`)) {
            const targets = allRecords.filter(r => r.department === deptName);
            const ops = targets.map(t => (!t.item_name && !t.vendor_name && !t.company_name) ? deleteMasterData(t.created_at) : updateMasterData(t.created_at, { department: null }));
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
        { id: 'actions', cell: ({ row }) => (
            <div className="flex items-center gap-1 justify-end pr-4">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setEditingRecord(row.original); setOpenDialog('dept'); }}><Pencil size={14} /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteByDept(row.original.department)}><Trash size={14} /></Button>
            </div>
        )}
    ];

    const companyColumns: ColumnDef<any>[] = [
        { accessorKey: 'company_name', header: 'Company Name', cell: ({ row }) => <div className="flex items-center gap-2 font-medium"><Building size={16} className="text-emerald-500" />{row.original.company_name}</div> },
        { accessorKey: 'company_gstin', header: 'GSTIN' },
        { accessorKey: 'company_address', header: 'Address', cell: ({ row }) => <span className="text-xs truncate max-w-[150px] block">{row.original.company_address || '--'}</span> },
        { id: 'actions', cell: ({ row }) => getActions(row.original, 'company') }
    ];

    const onSubmit = async (values: any, type: string) => {
        let res;
        if (editingRecord) {
            if (type === 'dept') {
                const targets = allRecords.filter(r => r.department === editingRecord.department);
                const updates = targets.map(t => updateMasterData(t.created_at, { department: values.department }));
                const results = await Promise.all(updates);
                res = { success: results.every(r => r.success) };
            } else {
                res = await updateMasterData(editingRecord.created_at, values);
            }
        } else {
            res = await insertMasterData(values);
        }
        if (res.success) { toast.success('Saved'); setOpenDialog(null); setEditingRecord(null); loadData(); }
    };

    const vendorsData = allRecords.filter(r => r.vendor_name);
    const itemsData = allRecords.filter(r => r.item_name);
    const departmentsData = Array.from(new Set(allRecords.map(r => r.department).filter(Boolean))).map(name => {
        const original = allRecords.find(r => r.department === name);
        return { department: name, created_at: original?.created_at };
    });
    const companiesData = allRecords.filter(r => r.company_name);

    return (
        <div className="h-full space-y-6 flex flex-col">
            <Heading heading="Master Registry" subtext="Universal repository for Vendors, Items, Departments, and Corporate Profiles"><div className="bg-gradient-to-br from-indigo-500 to-cyan-500 p-3 rounded-2xl text-white"><FileSpreadsheet size={40} /></div></Heading>

            <Tabs defaultValue="vendors" className="flex-1 flex flex-col" onValueChange={setActiveTab}>
                <TabsList className="bg-muted/30 p-1 rounded-xl border border-border/50 mb-4 max-w-fit h-12">
                    <TabsTrigger value="vendors" className="gap-2 px-6"><Building2 size={16} /> Vendors</TabsTrigger>
                    <TabsTrigger value="items" className="gap-2 px-6"><Boxes size={16} /> Items</TabsTrigger>
                    <TabsTrigger value="departments" className="gap-2 px-6"><LayoutGrid size={16} /> Departments</TabsTrigger>
                    <TabsTrigger value="companies" className="gap-2 px-6"><Building size={16} /> Companies</TabsTrigger>
                </TabsList>

                <TabsContent value="vendors" className="flex-1 outline-none"><DataTable data={vendorsData} columns={vendorColumns} searchFields={['vendor_name']} dataLoading={dataLoading} extraActions={<Button className="bg-indigo-600" onClick={() => {vForm.reset(); setEditingRecord(null); setOpenDialog('vendor');}}><Plus size={18}/> Add Vendor</Button>}/></TabsContent>
                <TabsContent value="items" className="flex-1 outline-none"><DataTable data={itemsData} columns={itemColumns} searchFields={['item_name']} dataLoading={dataLoading} extraActions={<Button className="bg-blue-600" onClick={() => {iForm.reset(); setEditingRecord(null); setOpenDialog('item');}}><Plus size={18}/> Add Item</Button>}/></TabsContent>
                <TabsContent value="departments" className="flex-1 outline-none"><DataTable data={departmentsData} columns={departmentColumns} searchFields={['department']} dataLoading={dataLoading} extraActions={<Button className="bg-orange-600" onClick={() => {dForm.reset(); setEditingRecord(null); setOpenDialog('dept');}}><Plus size={18}/> Add Dept</Button>}/></TabsContent>
                <TabsContent value="companies" className="flex-1 outline-none"><DataTable data={companiesData} columns={companyColumns} searchFields={['company_name']} dataLoading={dataLoading} extraActions={<Button className="bg-emerald-600" onClick={() => {cForm.reset(); setEditingRecord(null); setOpenDialog('company');}}><Plus size={18}/> Add Company</Button>}/></TabsContent>
            </Tabs>

            <Dialog open={!!openDialog} onOpenChange={(o) => { if(!o) {setOpenDialog(null); setEditingRecord(null);} }}>
                <DialogContent className={cn("sm:max-w-xl p-0 overflow-hidden rounded-3xl", openDialog === 'company' && "sm:max-w-2xl")}>
                    <div className={cn("h-2 w-full bg-gradient-to-r", openDialog === 'vendor' ? "from-indigo-600 to-cyan-600" : openDialog === 'item' ? "from-blue-600 to-indigo-600" : openDialog === 'dept' ? "from-orange-400 to-red-500" : "from-emerald-500 to-teal-600")} />
                    <div className="p-8 space-y-6">
                        <DialogHeader><DialogTitle>{editingRecord ? 'Edit' : 'Add'} {openDialog?.toUpperCase()}</DialogTitle></DialogHeader>
                        <ScrollArea className="max-h-[60vh]">
                            {openDialog === 'vendor' && <Form {...vForm}><form onSubmit={vForm.handleSubmit(v => onSubmit(v, 'vendor'))} className="grid gap-4"><FormField control={vForm.control} name="vendor_name" render={({field}) => <FormItem><FormLabel>Vendor Name</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>}/><FormField control={vForm.control} name="vendor_gstin" render={({field}) => <FormItem><FormLabel>GSTIN</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/><FormField control={vForm.control} name="vendor_email" render={({field}) => <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/><FormField control={vForm.control} name="vendor_address" render={({field}) => <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/><Button type="submit">Save Vendor</Button></form></Form>}
                            {openDialog === 'item' && <Form {...iForm}><form onSubmit={iForm.handleSubmit(v => onSubmit(v, 'item'))} className="grid gap-4"><FormField control={iForm.control} name="item_name" render={({field}) => <FormItem><FormLabel>Item Name</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>}/><FormField control={iForm.control} name="group_head" render={({field}) => <FormItem><FormLabel>Group Head</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/><FormField control={iForm.control} name="uom" render={({field}) => <FormItem><FormLabel>UOM</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/><Button type="submit">Save Item</Button></form></Form>}
                            {openDialog === 'dept' && <Form {...dForm}><form onSubmit={dForm.handleSubmit(v => onSubmit(v, 'dept'))} className="grid gap-4"><FormField control={dForm.control} name="department" render={({field}) => <FormItem><FormLabel>Department Name</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>}/><Button type="submit">Save Department</Button></form></Form>}
                            {openDialog === 'company' && <Form {...cForm}><form onSubmit={cForm.handleSubmit(v => onSubmit(v, 'company'))} className="grid gap-6"><FormField control={cForm.control} name="company_name" render={({field}) => <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>}/><div className="grid grid-cols-2 gap-4"><FormField control={cForm.control} name="company_gstin" render={({field}) => <FormItem><FormLabel>GSTIN</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/><FormField control={cForm.control} name="company_pan" render={({field}) => <FormItem><FormLabel>PAN</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/><FormField control={cForm.control} name="company_email" render={({field}) => <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/><FormField control={cForm.control} name="company_phone" render={({field}) => <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/><FormField control={cForm.control} name="company_address" render={({field}) => <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/><FormField control={cForm.control} name="billing_address" render={({field}) => <FormItem><FormLabel>Billing</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>}/></div><Button type="submit">Save Company</Button></form></Form>}
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
