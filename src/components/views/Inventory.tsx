import Heading from '../element/Heading';
import type { ColumnDef } from '@tanstack/react-table';
import { Pill } from '../ui/pill';
import { Store, Settings2 } from 'lucide-react';
import DataTable from '../element/DataTable';
import { useSheets } from '@/context/SheetsContext';
import type { InventoryRecord } from '@/services/inventoryService';
import { useMemo, useState } from 'react';
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
import { format } from "date-fns";

interface DetailRow {
    date: string;
    refNo: string;
    quantity: number;
    party: string;
    uom: string;
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
        issueLoading
    } = useSheets();

    const tableData = useMemo(() => {
        if (!inventorySheet || inventorySheet.length === 0) return [];
        
        return calculateRealInventory(
            inventorySheet,
            indentSheet || [],
            storeInSheet || [],
            issueSheet || []
        ) as unknown as InventoryRecord[];
    }, [inventorySheet, indentSheet, storeInSheet, issueSheet]);

    const isLoading = inventoryLoading || indentLoading || storeInLoading || issueLoading;

    const [detailDialog, setDetailDialog] = useState<{
        open: boolean;
        title: string;
        rows: DetailRow[];
    }>({ open: false, title: '', rows: [] });

    const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>({
        date: true,
        refNo: true,
        party: true,
        uom: true,
        quantity: true,
    });

    const handleDetailClick = (type: string, itemName: string, value: number) => {
        if (value === 0) return;

        let rows: DetailRow[] = [];
        let title = `${type} History: ${itemName}`;

        switch (type) {
            case 'Indented':
                rows = (indentSheet || [])
                    .filter(i => i.productName === itemName)
                    .map(i => ({
                        date: i.timestamp,
                        refNo: i.indentNumber,
                        quantity: Number(i.quantity || 0),
                        party: i.indenterName || 'N/A',
                        uom: i.uom || 'N/A'
                    }));
                break;
            case 'Approved':
                rows = (indentSheet || [])
                    .filter(i => i.productName === itemName && Number(i.approvedQuantity || 0) > 0)
                    .map(i => ({
                        date: i.timestamp,
                        refNo: i.indentNumber,
                        quantity: Number(i.approvedQuantity || 0),
                        party: i.indenterName || 'N/A',
                        uom: i.uom || 'N/A'
                    }));
                break;
            case 'Lifting Quantity':
                rows = (storeInSheet || [])
                    .filter(s => s.productName === itemName && Number(s.receivedQuantity || 0) > 0)
                    .map(s => ({
                        date: s.timestamp,
                        refNo: s.billNo || s.liftNumber,
                        quantity: Number(s.receivedQuantity || 0),
                        party: s.vendorName || 'N/A',
                        uom: s.unitOfMeasurement || 'N/A'
                    }));
                break;
            case 'In Transit':
                rows = (storeInSheet || [])
                    .filter(s => s.productName === itemName && (Number(s.qty || 0) - Number(s.receivedQuantity || 0)) > 0)
                    .map(s => ({
                        date: s.timestamp,
                        refNo: s.billNo || s.liftNumber,
                        quantity: Number(s.qty || 0) - Number(s.receivedQuantity || 0),
                        party: s.vendorName || 'N/A',
                        uom: s.unitOfMeasurement || 'N/A'
                    }));
                break;
            case 'Issued':
                rows = (issueSheet || [])
                    .filter(is => is.productName === itemName && Number(is.givenQty || 0) > 0)
                    .map(is => ({
                        date: is.timestamp,
                        refNo: is.issueNo,
                        quantity: Number(is.givenQty || 0),
                        party: is.issueTo || 'N/A',
                        uom: is.uom || 'N/A'
                    }));
                break;
            case 'Issue Return':
                rows = (issueSheet || [])
                    .filter(is => is.productName === itemName && Number(is.rejected_damage_qty || 0) > 0)
                    .map(is => ({
                        date: is.timestamp,
                        refNo: is.issueNo,
                        quantity: Number(is.rejected_damage_qty || 0),
                        party: is.return_person_name || 'N/A',
                        uom: is.uom || 'N/A'
                    }));
                break;
            case 'Purchase Return':
                rows = (storeInSheet || [])
                    .filter(s => s.productName === itemName && Number(s.returnQuantity || 0) > 0)
                    .map(s => ({
                        date: s.timestamp,
                        refNo: s.billNo || s.liftNumber,
                        quantity: Number(s.returnQuantity || 0),
                        party: s.vendorName || 'N/A',
                        uom: s.unitOfMeasurement || 'N/A'
                    }));
                break;
        }

        setDetailDialog({ open: true, title, rows: rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) });
    };

    const ClickableCell = ({ value, label, row }: { value: number; label: string; row: any }) => (
        <button
            onClick={() => handleDetailClick(label, row.original.itemName, value)}
            className={`w-full text-center hover:underline hover:text-primary transition-colors ${value > 0 ? 'text-blue-600 font-medium cursor-pointer' : 'text-muted-foreground'}`}
            disabled={value === 0}
        >
            {value}
        </button>
    );

    const columns: ColumnDef<InventoryRecord>[] = [
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
                const code = row.original.status.toLowerCase();
                if (row.original.current === 0) {
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
        { accessorKey: 'current', header: 'Quantity' },
        {
            accessorKey: 'totalPrice',
            header: 'Total Price',

            cell: ({ row }) => {
                return <>&#8377;{row.original.totalPrice}</>;
            },
        },
    ];

    return (
        <div>
            <Heading heading="Inventory" subtext="View inveontory">
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
                <DialogContent className="max-w-4xl max-h-[80dvh] flex flex-col">
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
                                    checked={visibleCols.uom}
                                    onCheckedChange={(checked) => setVisibleCols(v => ({ ...v, uom: !!checked }))}
                                >
                                    UOM
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={visibleCols.quantity}
                                    onCheckedChange={(checked) => setVisibleCols(v => ({ ...v, quantity: !!checked }))}
                                >
                                    Quantity
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto mt-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {visibleCols.date && <TableHead>Date</TableHead>}
                                    {visibleCols.refNo && <TableHead>Reference</TableHead>}
                                    {visibleCols.party && <TableHead>Party/Person</TableHead>}
                                    {visibleCols.uom && <TableHead>UOM</TableHead>}
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
                                            {visibleCols.refNo && <TableCell className="font-mono text-sm">{row.refNo}</TableCell>}
                                            {visibleCols.party && <TableCell>{row.party}</TableCell>}
                                            {visibleCols.uom && <TableCell>{row.uom}</TableCell>}
                                            {visibleCols.quantity && <TableCell className="text-right font-medium">{row.quantity}</TableCell>}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={Object.values(visibleCols).filter(Boolean).length} className="text-center py-10 text-muted-foreground">
                                            No transaction history found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
