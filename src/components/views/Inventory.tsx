import Heading from '../element/Heading';
import type { ColumnDef } from '@tanstack/react-table';
import { Pill } from '../ui/pill';
import { Store, Settings2, ArrowRightLeft, Send, Package, Building2, Info, AlertCircle } from 'lucide-react';
import DataTable from '../element/DataTable';
import { useSheets } from '@/context/SheetsContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { InventoryRecord } from '@/services/inventoryService';
import { useCallback, useMemo, useState } from 'react';
import { calculateRealInventory } from '@/lib/inventoryUtils';
import type { InventorySheet } from '@/types/sheets';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DetailRow {
    date: string;
    refNo: string;
    quantity: number;
    party: string;
    projectName: string;
}

export default () => {
    const {
        inventorySheet,
        indentSheet,
        storeInSheet,
        issueSheet,
        inventoryLoading,
        indentLoading,
        storeInLoading,
        issueLoading,
        masterSheet,
        updateAll,
        stockTransferSheet
    } = useSheets();
    const { user } = useAuth();

    const [selectedProject, setSelectedProject] = useState<string>('All');

    const filteredIndents = useMemo(() => {
        if (selectedProject === 'All') return indentSheet || [];
        const sel = selectedProject.trim().toLowerCase();
        return (indentSheet || []).filter((i: any) => (i.firmName || '').trim().toLowerCase() === sel);
    }, [indentSheet, selectedProject]);

    const filteredStoreIns = useMemo(() => {
        if (selectedProject === 'All') return storeInSheet || [];
        const sel = selectedProject.trim().toLowerCase();
        return (storeInSheet || []).filter((s: any) => (s.firmNameMatch || '').trim().toLowerCase() === sel);
    }, [storeInSheet, selectedProject]);

    const filteredIssues = useMemo(() => {
        if (selectedProject === 'All') return issueSheet || [];
        const sel = selectedProject.trim().toLowerCase();
        return (issueSheet || []).filter((is: any) => (is.projectName || '').trim().toLowerCase() === sel);
    }, [issueSheet, selectedProject]);

    const filteredTransfers = useMemo(() => {
        if (!stockTransferSheet) return [];
        if (selectedProject === 'All') return stockTransferSheet;
        const sel = selectedProject.trim().toLowerCase();
        return stockTransferSheet.filter((t: any) => 
            (t.fromProject || '').trim().toLowerCase() === sel || 
            (t.toProject || '').trim().toLowerCase() === sel
        );
    }, [stockTransferSheet, selectedProject]);

    const tableData = useMemo(() => {
        if (!inventorySheet || inventorySheet.length === 0) return [];

        const calculated = calculateRealInventory(
            inventorySheet,
            filteredIndents,
            filteredStoreIns,
            filteredIssues,
            filteredTransfers,
            selectedProject
        ) as unknown as InventoryRecord[];

        if (selectedProject === 'All') return calculated;

        // Filter to only show items with any activity for the selected project
        return calculated.filter(item =>
            (item.indented || 0) > 0 ||
            (item.approved || 0) > 0 ||
            (item.liftingQty || 0) > 0 ||
            (item.outQuantity || 0) > 0 ||
            (item.inTransit || 0) > 0 ||
            (item.purchaseReturn || 0) > 0 ||
            (item.issueReturn || 0) > 0 ||
            (item.stockTransferReceiving || 0) > 0 ||
            (item.stockTransferGiven || 0) > 0
        );
    }, [inventorySheet, filteredIndents, filteredStoreIns, filteredIssues, filteredTransfers, selectedProject]);

    const isLoading = inventoryLoading || indentLoading || storeInLoading || issueLoading;

    const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>({
        date: true,
        refNo: true,
        party: true,
        quantity: true,
        projectName: true,
    });

    const [detailDialog, setDetailDialog] = useState<{
        open: boolean;
        title: string;
        rows: DetailRow[];
    }>({ open: false, title: '', rows: [] });

    const [transferDialog, setTransferDialog] = useState({
        open: false,
        fromProject: '',
        toProject: '',
        itemName: '',
        quantity: 0,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleDetailClick = useCallback((type: string, itemName: string, value: number) => {
        if (value === 0) return;

        let rows: DetailRow[] = [];
        let title = `${type} History: ${itemName}`;

        // Get the UOM from inventorySheet as a reliable fallback
        const productUom = inventorySheet?.find(i => i.itemName === itemName)?.uom || 'N/A';

        switch (type) {
            case 'Indented':
                rows = filteredIndents
                    .filter((i: any) => i.productName === itemName)
                    .map((i: any) => ({
                        date: i.timestamp,
                        refNo: i.indentNumber,
                        quantity: Number(i.quantity || 0),
                        party: i.indenterName || 'N/A',
                        projectName: i.firmName || 'N/A'
                    }));
                break;
            case 'Approved':
                rows = filteredIndents
                    .filter((i: any) => i.productName === itemName && Number(i.approvedQuantity || 0) > 0)
                    .map((i: any) => ({
                        date: i.timestamp,
                        refNo: i.indentNumber,
                        quantity: Number(i.approvedQuantity || 0),
                        party: i.indenterName || 'N/A',
                        projectName: i.firmName || 'N/A'
                    }));
                break;
            case 'Lifting Quantity':
                rows = filteredStoreIns
                    .filter((s: any) => s.productName === itemName && Number(s.receivedQuantity || 0) > 0)
                    .map((s: any) => ({
                        date: s.timestamp,
                        refNo: s.billNo || s.liftNumber,
                        quantity: Number(s.receivedQuantity || 0),
                        party: s.vendorName || 'N/A',
                        projectName: s.firmNameMatch || 'N/A'
                    }));
                break;
            case 'In Transit':
                rows = filteredStoreIns
                    .filter((s: any) => s.productName === itemName && (Number(s.qty || 0) - Number(s.receivedQuantity || 0)) > 0)
                    .map((s: any) => ({
                        date: s.timestamp,
                        refNo: s.billNo || s.liftNumber,
                        quantity: Number(s.qty || 0) - Number(s.receivedQuantity || 0),
                        party: s.vendorName || 'N/A',
                        projectName: s.firmNameMatch || 'N/A'
                    }));
                break;
            case 'Issued':
                rows = filteredIssues
                    .filter((is: any) => is.productName === itemName && Number(is.givenQty || 0) > 0)
                    .map((is: any) => ({
                        date: is.timestamp,
                        refNo: is.issueNo,
                        quantity: Number(is.givenQty || 0),
                        party: is.issueTo || 'N/A',
                        projectName: is.project_name || 'N/A'
                    }));
                break;
            case 'Issue Return':
                rows = filteredIssues
                    .filter((is: any) => is.productName === itemName && Number(is.rejected_damage_qty || 0) > 0)
                    .map((is: any) => ({
                        date: is.timestamp,
                        refNo: is.issueNo,
                        quantity: Number(is.rejected_damage_qty || 0),
                        party: is.return_person_name || 'N/A',
                        projectName: is.project_name || 'N/A'
                    }));
                break;
            case 'Purchase Return':
                rows = filteredStoreIns
                    .filter((s: any) => s.productName === itemName && Number(s.returnQuantity || 0) > 0)
                    .map((s: any) => ({
                        date: s.timestamp,
                        refNo: s.billNo || s.liftNumber,
                        quantity: Number(s.returnQuantity || 0),
                        party: s.vendorName || 'N/A',
                        projectName: s.firmNameMatch || 'N/A'
                    }));
                break;
            case 'Stock Transfer Receiving':
                // Combine transfers from both dedicated table and old store_in 'Transfer' status
                const legacyTransfers = filteredStoreIns
                    .filter((s: any) => s.productName === itemName && s.receivingStatus === 'Transfer')
                    .map((s: any) => ({
                        date: s.timestamp,
                        refNo: s.billNo || s.liftNumber,
                        quantity: Number(s.receivedQuantity || 0),
                        party: s.vendorName || 'N/A',
                        projectName: s.firmNameMatch || 'N/A'
                    }));

                const newTransfersReceiving = filteredTransfers
                    .filter((t: any) => t.productName === itemName && (selectedProject === 'All' || (t.toProject || '').trim().toLowerCase() === selectedProject.trim().toLowerCase()))
                    .map((t: any) => ({
                        date: t.timestamp,
                        refNo: t.transferNo,
                        quantity: Number(t.quantity || 0),
                        party: t.fromProject,
                        projectName: t.toProject || 'N/A'
                    }));

                rows = [...legacyTransfers, ...newTransfersReceiving];
                break;
            case 'Stock Transfer Given':
                rows = filteredTransfers
                    .filter((t: any) => t.productName === itemName && (selectedProject === 'All' || (t.fromProject || '').trim().toLowerCase() === selectedProject.trim().toLowerCase()))
                    .map((t: any) => ({
                        date: t.timestamp,
                        refNo: t.transferNo,
                        quantity: Number(t.quantity || 0),
                        party: t.fromProject,
                        projectName: t.toProject || 'N/A'
                    }));
                break;
        }

        setDetailDialog({ open: true, title, rows: rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) });
    }, [filteredIndents, filteredStoreIns, filteredIssues, filteredTransfers, inventorySheet, selectedProject]);

    const ClickableCell = useMemo(() => ({ value, label, row }: { value: number; label: string; row: any }) => (
        <button
            onClick={() => handleDetailClick(label, row.original.itemName, value)}
            className={`w-full text-center hover:underline hover:text-primary transition-colors ${value > 0 ? 'text-blue-600 font-medium cursor-pointer' : 'text-muted-foreground'}`}
            disabled={value === 0}
        >
            {value}
        </button>
    ), [handleDetailClick]);

    const columns = useMemo<ColumnDef<InventoryRecord>[]>(() => [
        {
            accessorKey: 'itemName',
            header: 'Item',
            cell: ({ row }) => {
                return (
                    <div className="text-wrap max-w-40 text-center">{row.original.itemName}</div>
                );
            },
        },
        { accessorKey: 'groupHead', header: 'Group Head' },
        { accessorKey: 'uom', header: 'UOM' },
        {
            accessorKey: 'rate',
            header: 'Rate',
            cell: ({ row }) => {
                return <>&#8377;{row.original.rate}</>;
            },
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const code = (row.original.status || '').toLowerCase();
                if ((row.original.current || 0) === 0) {
                    return <Pill variant="reject">Out of Stock</Pill>;
                }
                if (code === 'red') {
                    return <Pill variant="pending">Low Stock</Pill>;
                }
                if (code === 'purple') {
                    return <Pill variant="primary">Excess</Pill>;
                }
                return <Pill variant="secondary">In Stock</Pill>;
            },
        },
        {
            accessorKey: 'indented',
            header: 'Indented',
            cell: ({ row }) => <ClickableCell value={row.original.indented} label="Indented" row={row} />
        },
        {
            accessorKey: 'approved',
            header: 'Approved',
            cell: ({ row }) => <ClickableCell value={row.original.approved} label="Approved" row={row} />
        },
        {
            accessorKey: 'purchaseReturn',
            header: 'Purchase Return',
            cell: ({ row }) => <ClickableCell value={row.original.purchaseReturn} label="Purchase Return" row={row} />
        },
        {
            accessorKey: 'liftingQty',
            header: 'Lifting Quantity',
            cell: ({ row }) => <ClickableCell value={row.original.liftingQty} label="Lifting Quantity" row={row} />
        },
        {
            accessorKey: 'inTransit',
            header: 'In Transit',
            cell: ({ row }) => <ClickableCell value={row.original.inTransit} label="In Transit" row={row} />
        },
        {
            accessorKey: 'issueReturn',
            header: 'Issue Return',
            cell: ({ row }) => <ClickableCell value={row.original.issueReturn} label="Issue Return" row={row} />
        },
        {
            accessorKey: 'outQuantity',
            header: 'Issued',
            cell: ({ row }) => <ClickableCell value={row.original.outQuantity} label="Issued" row={row} />
        },
        {
            accessorKey: 'stockTransferGiven',
            header: 'S.T. To',
            cell: ({ row }) => (
                <div className="flex flex-col items-center gap-0.5">
                    <ClickableCell value={row.original.stockTransferGiven} label="Stock Transfer Given" row={row} />
                    {row.original.toProject && (
                        <span className="text-[10px] leading-tight text-muted-foreground truncate max-w-[100px]" title={row.original.toProject}>
                            To: {row.original.toProject}
                        </span>
                    )}
                </div>
            )
        },
        {
            accessorKey: 'stockTransferReceiving',
            header: 'S.T. From',
            cell: ({ row }) => (
                <div className="flex flex-col items-center gap-0.5">
                    <ClickableCell value={row.original.stockTransferReceiving} label="Stock Transfer Receiving" row={row} />
                    {row.original.fromProject && (
                        <span className="text-[10px] leading-tight text-muted-foreground truncate max-w-[100px]" title={row.original.fromProject}>
                            From: {row.original.fromProject}
                        </span>
                    )}
                </div>
            )
        },
        { accessorKey: 'current', header: 'Quantity' },
        {
            accessorKey: 'totalPrice',
            header: 'Total Price',

            cell: ({ row }) => {
                return <>&#8377;{row.original.totalPrice}</>;
            },
        },
    ], [ClickableCell]);

    return (
        <div>
            <Heading
                heading="Inventory"
                subtext="View inveontory"
                action={
                    <div className="flex items-center gap-4">
                        <Button
                            onClick={() => setTransferDialog(prev => ({ ...prev, open: true, fromProject: '', toProject: '', itemName: '', quantity: 0 }))}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 flex items-center gap-2"
                        >
                            <ArrowRightLeft size={18} />
                            Stock Transfer
                        </Button>
                        <div className="h-8 w-px bg-border" />
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Project:</span>
                            <Select value={selectedProject} onValueChange={setSelectedProject}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Select Project" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="All">All Projects</SelectItem>
                                    {masterSheet?.firms?.map((firm) => (
                                        <SelectItem key={firm} value={firm}>
                                            {firm}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                }
            >
                <Store size={50} className="text-primary" />
            </Heading>

            <DataTable
                data={tableData}
                columns={columns}
                dataLoading={isLoading}
                searchFields={['itemName', 'groupHead', 'uom', 'status']}
                className="h-[80dvh]"
            />

            <Dialog open={detailDialog.open} onOpenChange={(open) => setDetailDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="max-w-[95vw] lg:max-w-[90vw] xl:max-w-[1400px] max-h-[90dvh] flex flex-col">
                    <DialogHeader className="flex flex-row items-center justify-between space-x-4">
                        <DialogTitle>{detailDialog.title}</DialogTitle>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="ml-auto flex h-8 items-center gap-1 px-2 text-xs">
                                    <Settings2 size={14} />
                                    <span>View Columns</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem
                                    checked={visibleCols.date}
                                    onCheckedChange={(checked) => setVisibleCols(v => ({ ...v, date: !!checked }))}
                                >
                                    Date
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={visibleCols.refNo}
                                    onCheckedChange={(checked) => setVisibleCols(v => ({ ...v, refNo: !!checked }))}
                                >
                                    Reference
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={visibleCols.party}
                                    onCheckedChange={(checked) => setVisibleCols(v => ({ ...v, party: !!checked }))}
                                >
                                    Party/Person
                                </DropdownMenuCheckboxItem>

                                <DropdownMenuCheckboxItem
                                    checked={visibleCols.quantity}
                                    onCheckedChange={(checked) => setVisibleCols(v => ({ ...v, quantity: !!checked }))}
                                >
                                    Quantity
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={visibleCols.projectName}
                                    onCheckedChange={(checked) => setVisibleCols(v => ({ ...v, projectName: !!checked }))}
                                >
                                    Project Name
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto mt-4 border rounded-lg">
                        <Table className="min-w-[900px]">
                            <TableHeader>
                                <TableRow>
                                    {visibleCols.date && <TableHead>Date</TableHead>}
                                    {visibleCols.refNo && <TableHead>Reference</TableHead>}
                                    {visibleCols.party && (
                                        <TableHead>{detailDialog.title.includes('Stock Transfer') ? 'From' : 'Party/Person'}</TableHead>
                                    )}
                                    {visibleCols.projectName && (
                                        <TableHead>{detailDialog.title.includes('Stock Transfer') ? 'To' : 'Project'}</TableHead>
                                    )}
                                    {visibleCols.quantity && <TableHead className="text-right">Qty</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {detailDialog.rows.length > 0 ? (
                                    detailDialog.rows.map((row, idx) => (
                                        <TableRow key={idx}>
                                            {visibleCols.date && (
                                                <TableCell className="whitespace-nowrap italic">
                                                    {row.date ? format(new Date(row.date), 'dd/MM/yyyy HH:mm') : 'N/A'}
                                                </TableCell>
                                            )}
                                            {visibleCols.refNo && <TableCell className="font-mono text-sm whitespace-nowrap">{row.refNo}</TableCell>}
                                            {visibleCols.party && <TableCell className="whitespace-nowrap">{row.party}</TableCell>}
                                            {visibleCols.projectName && <TableCell className="whitespace-nowrap">{row.projectName}</TableCell>}
                                            {visibleCols.quantity && <TableCell className="text-right font-bold">{row.quantity}</TableCell>}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground italic">
                                            No transactions found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={transferDialog.open} onOpenChange={(open) => setTransferDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl">
                    <div className="h-2 w-full bg-gradient-to-r from-primary to-primary/60" />
                    <div className="p-6 space-y-6 flex-1 overflow-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                                <ArrowRightLeft className="text-primary" size={24} />
                                Stock Transfer
                            </DialogTitle>
                        </DialogHeader>

                        <div className="grid gap-6 pb-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                        <Building2 size={12} /> From Project
                                    </Label>
                                    <Select
                                        value={transferDialog.fromProject}
                                        onValueChange={(val) => setTransferDialog(prev => ({ ...prev, fromProject: val, itemName: '', quantity: 0 }))}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
                                        <SelectContent>
                                            {masterSheet?.firms?.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                        <Building2 size={12} /> To Project
                                    </Label>
                                    <Select
                                        value={transferDialog.toProject}
                                        onValueChange={(val) => setTransferDialog(prev => ({ ...prev, toProject: val }))}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Destination" /></SelectTrigger>
                                        <SelectContent>
                                            {masterSheet?.firms?.filter(f => f !== transferDialog.fromProject).map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                    <Package size={12} /> Select Item
                                </Label>
                                <Select
                                    value={transferDialog.itemName}
                                    onValueChange={(val) => setTransferDialog(prev => ({ ...prev, itemName: val }))}
                                    disabled={!transferDialog.fromProject}
                                >
                                    <SelectTrigger><SelectValue placeholder={transferDialog.fromProject ? "Select Item" : "Select Source First"} /></SelectTrigger>
                                    <SelectContent>
                                        {(() => {
                                            const sourceInv = calculateRealInventory(
                                                inventorySheet || [],
                                                (indentSheet || []).filter((i: any) => i.firmName === transferDialog.fromProject),
                                                (storeInSheet || []).filter((s: any) => s.firmNameMatch === transferDialog.fromProject),
                                                (issueSheet || []).filter((is: any) => is.projectName === transferDialog.fromProject),
                                                (stockTransferSheet || []).filter((t: any) => t.toProject === transferDialog.fromProject || t.fromProject === transferDialog.fromProject),
                                                transferDialog.fromProject
                                            );
                                            return sourceInv.filter(i => (i.current || 0) > 0).map(i => (
                                                <SelectItem key={i.itemName} value={i.itemName}>{i.itemName} ({i.current} {i.uom} available)</SelectItem>
                                            ));
                                        })()}
                                    </SelectContent>
                                </Select>
                            </div>

                            {transferDialog.itemName && (
                                <div className="grid grid-cols-2 gap-4 items-end animate-in slide-in-from-top-2 duration-300">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quantity</Label>
                                        <Input
                                            type="number"
                                            value={transferDialog.quantity || ''}
                                            onChange={(e) => setTransferDialog(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <Button
                                        className="w-full font-bold h-10 shadow-lg shadow-primary/20"
                                        disabled={isSubmitting || !transferDialog.quantity || !transferDialog.toProject}
                                        onClick={async () => {
                                            setIsSubmitting(true);
                                            try {
                                                const sourceInv = calculateRealInventory(
                                                    inventorySheet || [],
                                                    (indentSheet || []).filter((i: any) => i.firmName === transferDialog.fromProject),
                                                    (storeInSheet || []).filter((s: any) => s.firmNameMatch === transferDialog.fromProject),
                                                    (issueSheet || []).filter((is: any) => is.projectName === transferDialog.fromProject),
                                                    (stockTransferSheet || []).filter((t: any) => t.toProject === transferDialog.fromProject || t.fromProject === transferDialog.fromProject),
                                                    transferDialog.fromProject
                                                );
                                                const selected = sourceInv.find(i => i.itemName === transferDialog.itemName);
                                                if (selected && transferDialog.quantity > selected.current) {
                                                    toast.error("Insufficient stock!");
                                                    return;
                                                }

                                                const timestamp = new Date().toISOString();
                                                const ref = `TRF-${Date.now()}`;

                                                // Insert into dedicated stock_transfers table
                                                const { error } = await supabase.from('stock_transfers').insert([{
                                                    transfer_no: ref,
                                                    from_project: transferDialog.fromProject,
                                                    to_project: transferDialog.toProject,
                                                    product_name: transferDialog.itemName,
                                                    uom: selected?.uom,
                                                    group_head: selected?.groupHead || '',
                                                    quantity: transferDialog.quantity,
                                                    remark: 'Internal Stock Transfer',
                                                    timestamp
                                                }]);

                                                if (error) throw error;

                                                toast.success("Transfer Successful!");
                                                setTransferDialog(prev => ({ ...prev, open: false, itemName: '', quantity: 0, toProject: '' }));
                                                updateAll();
                                            } catch (err: any) {
                                                toast.error("Error: " + err.message);
                                            } finally {
                                                setIsSubmitting(false);
                                            }
                                        }}
                                    >
                                        {isSubmitting ? "Processing..." : <><Send size={16} className="mr-2" /> Confirm</>}
                                    </Button>
                                </div>
                            )}

                            <Card className="bg-primary/5 border-primary/20">
                                <CardContent className="p-3 text-[11px] text-muted-foreground flex gap-2 items-start">
                                    <Info size={14} className="text-primary shrink-0 mt-0.5" />
                                    <p>This action will deduct quantity from the source project and record an incoming transfer for the destination project.</p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
