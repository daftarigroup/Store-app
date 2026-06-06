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
import { useState, useRef, type ReactNode, useEffect } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { ClipLoader } from 'react-spinners';
import { HorizontalScrollIndicator } from '../ui/horizontal-scroll-indicator';
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
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isScrollableHorizontally, setIsScrollableHorizontally] = useState(false);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        enableRowSelection: !!onRowSelectionChange,
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

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const updateScrollable = () => {
            setIsScrollableHorizontally(el.scrollWidth > el.clientWidth);
        };

        updateScrollable();

        // Listen to scroll and resize
        window.addEventListener('resize', updateScrollable);
        el.addEventListener('scroll', updateScrollable);

        const ro = new ResizeObserver(updateScrollable);
        ro.observe(el);

        const firstChild = el.firstElementChild;
        if (firstChild) ro.observe(firstChild);

        // Add custom wheel event listener to translate vertical scroll to horizontal scroll
        const handleWheel = (e: WheelEvent) => {
            const isOverHeader = (e.target as HTMLElement).closest('thead') !== null;
            const noVerticalScroll = el.scrollHeight <= el.clientHeight;

            if (e.deltaY !== 0 && (e.shiftKey || isOverHeader || noVerticalScroll)) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
            }
        };

        el.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            window.removeEventListener('resize', updateScrollable);
            el.removeEventListener('scroll', updateScrollable);
            ro.disconnect();
            el.removeEventListener('wheel', handleWheel);
        };
    }, []);

    return (
        <div className="p-5 grid gap-4">
            <div className="flex justify-between items-center w-full gap-3">
                <div className="flex items-center gap-2">
                    {searchFields.length !== 0 && (
                        <Input
                            placeholder={`Search...`}
                            value={globalFilter}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                            className="w-64 h-9"
                        />
                    )}
                    {isScrollableHorizontally && (
                        <div className="flex items-center gap-1 border-l pl-2 ml-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
                                title="Scroll Left (or hover header & scroll wheel)"
                            >
                                <ChevronLeft size={16} />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
                                title="Scroll Right (or hover header & scroll wheel)"
                            >
                                <ChevronRight size={16} />
                            </Button>
                            <span className="text-[10px] text-muted-foreground ml-1 hidden sm:inline">
                                Tip: Hover header & scroll wheel
                            </span>
                        </div>
                    )}
                </div>
                {extraActions && extraActions}
            </div>

            <div className="relative w-full min-w-0 overflow-hidden">
                <div
                    ref={scrollRef}
                    className={cn('rounded-sm border h-[74dvh] w-full overflow-auto scroll-smooth pb-4', className)}
                >
                    <Table className="min-w-max">
                        <TableHeader>
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
                </div>
                <div className="absolute bottom-1.5 inset-x-1 z-10 pointer-events-none">
                    <HorizontalScrollIndicator containerRef={scrollRef} className="pointer-events-auto" />
                </div>
            </div>
        </div>
    );
}
