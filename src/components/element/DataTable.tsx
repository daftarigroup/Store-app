'use client';

import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    useReactTable,
} from '@tanstack/react-table';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useState, type ReactNode } from 'react';
import { Input } from '../ui/input';
import { Package } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { ClipLoader } from 'react-spinners';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    searchFields?: string[];
    dataLoading?: boolean;
    children?: ReactNode;
    className?: string;
    extraActions?: ReactNode;
    rowSelection?: Record<string, boolean>;
    onRowSelectionChange?: (updater: any) => void;
    getRowId?: (row: TData) => string;
    meta?: any;
}

function globalFilterFn<TData>(row: TData, columnIds: string[], filterValue: string) {
    return columnIds.some((columnId) => {
        const value = (row as any)[columnId];
        return String(value ?? '')
            .toLowerCase()
            .includes(filterValue.toLowerCase());
    });
}

export default function DataTable<TData, TValue>({
    columns,
    data,
    searchFields = [],
    dataLoading,
    children: _children, // <-- underscore avoids TS unused variable error
    className,
    extraActions,
    rowSelection = {},
    onRowSelectionChange,
    getRowId,
    meta,
}: DataTableProps<TData, TValue>) {
    const [globalFilter, setGlobalFilter] = useState('');
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: (row, _, filterValue) =>
            row?.original ? globalFilterFn(row.original, searchFields || [], filterValue) : false,
        getRowId,
        meta,
        state: {
            globalFilter,
            rowSelection: rowSelection || {},
        },
        onGlobalFilterChange: setGlobalFilter,
        onRowSelectionChange: onRowSelectionChange,
    });

    return (
        <div className="p-5 grid gap-4">
            <div className="flex justify-between items-center w-full gap-3">
                {searchFields.length !== 0 && (
                    <div className="flex items-center w-full">
                        <Input
                            placeholder={`Search...`}
                            value={globalFilter}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                            className="w-230"
                        />
                    </div>
                )}
                {extraActions && extraActions}
            </div>

            <div className="relative max-w-full overflow-x-auto">
                <ScrollArea className={cn('rounded-sm border h-[74dvh] w-full', className)}>
                    <Table className="min-w-max">
                        <TableHeader className="sticky top-0 z-10 bg-muted">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        return (
                                            <TableHead key={header.id}>
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                            </TableHead>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>

                        <TableBody>
                            {dataLoading ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell
                                        colSpan={columns?.length || 0}
                                        className="h-50 text-center"
                                    >
                                        <div className="flex justify-center items-center w-full py-20">
                                            <ClipLoader color="#9333ea" size={40} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    row && (
                                        <TableRow
                                            key={row.id}
                                            data-state={row.getIsSelected?.() && 'selected'}
                                            className="p-1"
                                        >
                                            {row.getVisibleCells?.().map((cell) => (
                                                cell && (
                                                    <TableCell key={cell.id}>
                                                        {flexRender(
                                                            cell.column.columnDef.cell,
                                                            cell.getContext()
                                                        )}
                                                    </TableCell>
                                                )
                                            ))}
                                        </TableRow>
                                    )
                                ))
                            ) : (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell
                                        colSpan={columns?.length || 0}
                                        className="h-50 text-center text-xl"
                                    >
                                        <div className="flex flex-col justify-center items-center w-full gap-1">
                                            <Package className="text-gray-400" size={50} />
                                            <p className="text-muted-foreground font-semibold">
                                                No Indents Found.
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
        </div>
    );
}
