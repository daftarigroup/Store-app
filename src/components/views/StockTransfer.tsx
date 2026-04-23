import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowRightLeft, Building2, Package, Send, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useSheets } from '@/context/SheetsContext';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { Button } from '../ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '../ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { calculateRealInventory } from '@/lib/inventoryUtils';
import { Pill } from '../ui/pill';

const transferSchema = z.object({
    fromProject: z.string().min(1, 'Please select source project'),
    toProject: z.string().min(1, 'Please select destination project'),
    itemName: z.string().min(1, 'Please select an item'),
    quantity: z.coerce.number().positive('Quantity must be greater than zero'),
    remark: z.string().optional(),
});

type TransferFormValues = z.infer<typeof transferSchema>;

export default () => {
    const { masterSheet, inventorySheet, indentSheet, storeInSheet, issueSheet, updateAll } = useSheets();
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<TransferFormValues>({
        resolver: zodResolver(transferSchema),
        defaultValues: {
            fromProject: '',
            toProject: '',
            itemName: '',
            quantity: 0,
            remark: '',
        },
    });

    const fromProject = form.watch('fromProject');
    const itemName = form.watch('itemName');

    // Filtered inventory based on "From Project"
    const sourceInventory = useMemo(() => {
        if (!fromProject || !inventorySheet) return [];
        
        const filteredIndents = (indentSheet || []).filter((i: any) => i.firmName === fromProject);
        const filteredStoreIns = (storeInSheet || []).filter((s: any) => s.firmNameMatch === fromProject);
        const filteredIssues = (issueSheet || []).filter((is: any) => is.projectName === fromProject);

        return calculateRealInventory(
            inventorySheet,
            filteredIndents,
            filteredStoreIns,
            filteredIssues
        );
    }, [fromProject, inventorySheet, indentSheet, storeInSheet, issueSheet]);

    // Available items in the source project that have stock > 0
    const availableItems = useMemo(() => {
        return sourceInventory.filter(item => (item.current || 0) > 0);
    }, [sourceInventory]);

    // Current selected item details
    const selectedItem = useMemo(() => {
        return sourceInventory.find(i => i.itemName === itemName);
    }, [sourceInventory, itemName]);

    async function onSubmit(values: TransferFormValues) {
        if (values.fromProject === values.toProject) {
            toast.error("Source and Destination projects cannot be the same.");
            return;
        }

        if (selectedItem && values.quantity > selectedItem.current) {
            toast.error(`Not enough stock. Available: ${selectedItem.current} ${selectedItem.uom}`);
            return;
        }

        setIsSubmitting(true);
        const timestamp = new Date().toISOString();
        const transferNo = `TRF-${Date.now()}`;

        try {
            // 1. Create ISSUE record for Source Project (Giver)
            const issueRecord = {
                timestamp,
                issue_no: transferNo,
                issue_to: `Transfer to ${values.toProject}`,
                uom: selectedItem?.uom || '',
                product_name: values.itemName,
                quantity: values.quantity,
                department: 'Stock Transfer',
                group_head: selectedItem?.groupHead || '',
                planned1: timestamp,
                actual1: timestamp,
                status: 'Approved',
                given_qty: values.quantity,
                project_name: values.fromProject,
                issue_person_name: user?.name || 'System',
                remark: values.remark || 'Internal Stock Transfer',
            };

            const { error: issueError } = await supabase.from('issue').insert([issueRecord]);
            if (issueError) throw issueError;

            // 2. Create STORE IN record for Destination Project (Receiver)
            const storeInRecord = {
                timestamp,
                lift_number: transferNo,
                indent_no: transferNo,
                bill_no: 'TRANSFER',
                vendor_name: `Transfer from ${values.fromProject}`,
                product_name: values.itemName,
                qty: values.quantity,
                receiving_status: 'Transfer',
                received_quantity: values.quantity,
                actual6: timestamp,
                firm_name_match: values.toProject,
                unit_of_measurement: selectedItem?.uom || '',
                remark: values.remark || 'Internal Stock Transfer',
                hod_status: 'Approved',
                hod_actual: timestamp,
            };

            const { error: storeInError } = await supabase.from('store_in').insert([storeInRecord]);
            if (storeInError) throw storeInError;

            toast.success("Stock transfer successful!");
            form.reset({
                fromProject: values.fromProject, // Keep source for convenience
                toProject: '',
                itemName: '',
                quantity: 0,
                remark: '',
            });
            updateAll(true); // Silent update
        } catch (error: any) {
            console.error('Transfer Error:', error);
            toast.error("Failed to process transfer: " + (error.message || "Unknown error"));
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="container mx-auto p-4 sm:p-8 max-w-4xl space-y-8 animate-in fade-in duration-500">
            <Heading 
                heading="Stock Transfer" 
                subtext="Move materials between project locations seamlessly"
            >
                <ArrowRightLeft size={50} className="text-primary" />
            </Heading>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <Card className="border-none shadow-2xl bg-background/50 backdrop-blur-xl ring-1 ring-border/50 overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b">
                            <CardTitle className="flex items-center gap-2">
                                <Package className="text-primary" size={20} />
                                Transfer Details
                            </CardTitle>
                            <CardDescription>Select the source, destination, and item to transfer</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField
                                            control={form.control}
                                            name="fromProject"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="flex items-center gap-2">
                                                        <Building2 size={16} className="text-muted-foreground" />
                                                        Source Project (From)
                                                    </FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="bg-background/50">
                                                                <SelectValue placeholder="Select Source" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {masterSheet?.firms?.map(firm => (
                                                                <SelectItem key={firm} value={firm}>{firm}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="toProject"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="flex items-center gap-2">
                                                        <Building2 size={16} className="text-muted-foreground" />
                                                        Destination Project (To)
                                                    </FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="bg-background/50">
                                                                <SelectValue placeholder="Select Destination" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {masterSheet?.firms?.filter(f => f !== fromProject).map(firm => (
                                                                <SelectItem key={firm} value={firm}>{firm}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="itemName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="flex items-center gap-2">
                                                    <Package size={16} className="text-muted-foreground" />
                                                    Select Item
                                                </FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value} disabled={!fromProject}>
                                                    <FormControl>
                                                        <SelectTrigger className="bg-background/50">
                                                            <SelectValue placeholder={fromProject ? "Select an item" : "Select source project first"} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {availableItems.map(item => (
                                                            <SelectItem key={item.itemName} value={item.itemName}>
                                                                {item.itemName} ({item.current} {item.uom} available)
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormDescription>Only items with available stock in the source project are shown.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                                        <FormField
                                            control={form.control}
                                            name="quantity"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Quantity to Transfer</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Input 
                                                                type="number" 
                                                                placeholder="0.00" 
                                                                className="bg-background/50 pr-12"
                                                                {...field} 
                                                            />
                                                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-muted-foreground text-sm">
                                                                {selectedItem?.uom || '-'}
                                                            </div>
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <Button 
                                            type="submit" 
                                            className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                                            disabled={isSubmitting}
                                        >
                                            {isSubmitting ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                                    Processing...
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <Send size={18} />
                                                    Confirm Transfer
                                                </div>
                                            )}
                                        </Button>
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="remark"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Remarks (Optional)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Reason for transfer..." className="bg-background/50" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="border-none shadow-xl bg-primary/5 backdrop-blur-sm ring-1 ring-primary/20">
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Info size={16} className="text-primary" />
                                Transfer Logic
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-4 text-muted-foreground leading-relaxed">
                            <p>
                                <span className="font-semibold text-foreground">Source Project:</span> Stock is deducted as an 
                                <span className="mx-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-500 border border-red-500/20">Issued</span> 
                                transaction.
                            </p>
                            <p>
                                <span className="font-semibold text-foreground">Destination Project:</span> Stock is added as a 
                                <span className="mx-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Stock Transfer</span> 
                                transaction.
                            </p>
                            <div className="pt-2 border-t border-primary/10">
                                <p className="text-xs italic">All transfers are logged and visible in the Inventory history popup.</p>
                            </div>
                        </CardContent>
                    </Card>

                    {selectedItem && (
                        <Card className="border-none shadow-xl bg-secondary/30 backdrop-blur-sm animate-in slide-in-from-right-4 duration-300">
                            <CardHeader>
                                <CardTitle className="text-sm font-semibold">Current Stock at Source</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Item:</span>
                                    <span className="font-medium">{selectedItem.itemName}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Available:</span>
                                    <span className="text-xl font-bold text-primary">{selectedItem.current} {selectedItem.uom}</span>
                                </div>
                                {selectedItem.current < 5 && (
                                    <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
                                        <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-destructive">Low Stock Warning</p>
                                            <p className="text-[10px] text-destructive/80">Transferring might deplete source inventory below critical levels.</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};
