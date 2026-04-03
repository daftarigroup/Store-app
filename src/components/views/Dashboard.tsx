import Heading from '../element/Heading';
import {
    Calendar as CalendarIcon,
    ClipboardList,
    LayoutDashboard,
    PackageCheck,
    Truck,
    Warehouse,
    CreditCard,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ChartContainer, ChartTooltip, type ChartConfig } from '../ui/chart';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import { useEffect, useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { format } from 'date-fns';
import { Calendar } from '../ui/calendar';
import { ComboBox } from '../ui/combobox';
import { fetchIndentRecords, type IndentRecord } from '@/services/indentService';
import { fetchStoreInRecords, type StoreInRecord } from '@/services/storeInService';
import { fetchIssueRecords, type IssueRecord } from '@/services/issueService';
import { fetchMasterOptions } from '@/services/masterService';
import { fetchPoMaster } from '@/services/poService';
import { fetchInventoryRecords } from '@/services/inventoryService';
import { Line, LineChart, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, Area, AreaChart } from 'recharts';
import { useSheets } from '@/context/SheetsContext';

interface ChartDataItem {
    name: string;
    quantity: number;
    frequency: number;
}

export default function Dashboard() {
    const {
        pcReportSheet,
        allLoading: contextAllLoading
    } = useSheets();

    const [indents, setIndents] = useState<IndentRecord[]>([]);
    const [storeIns, setStoreIns] = useState<StoreInRecord[]>([]);
    const [issues, setIssues] = useState<IssueRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [chartData, setChartData] = useState<ChartDataItem[]>([]);
    const [topVendorsData, setTopVendors] = useState<VendorDataItem[]>([]);
    const [indent, setIndent] = useState<StatsData>({ count: 0, quantity: 0 });
    const [purchase, setPurchase] = useState<StatsData>({ count: 0, quantity: 0 });
    const [out, setOut] = useState<StatsData>({ count: 0, quantity: 0 });
    const [poTotal, setPoTotal] = useState<number>(0);
    const [poMasterData, setPoMasterData] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<AlertsData>({ lowStock: 0, outOfStock: 0 });

    const [trendData, setTrendData] = useState<TrendDataItem[]>([]);
    const [deptData, setDeptData] = useState<DeptDataItem[]>([]);
    const [statusData, setStatusData] = useState<StatusDataItem[]>([]);

    const [startDate, setStartDate] = useState<Date>();
    const [endDate, setEndDate] = useState<Date>();
    const [filteredVendors, setFilteredVendors] = useState<string[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<string[]>([]);
    const [filteredDepartments, setFilteredDepartments] = useState<string[]>([]);
    const [allVendors, setAllVendors] = useState<string[]>([]);
    const [allProducts, setAllProducts] = useState<string[]>([]);
    const [allDepartments, setAllDepartments] = useState<string[]>([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                setIsLoading(true);
                const [iData, sData, issueData, mData, poData, invData] = await Promise.all([
                    fetchIndentRecords(),
                    fetchStoreInRecords(),
                    fetchIssueRecords(),
                    fetchMasterOptions(),
                    fetchPoMaster(),
                    fetchInventoryRecords()
                ]);
                setIndents(iData);
                setStoreIns(sData);
                setIssues(issueData);
                setAllVendors(mData.vendorNames);
                setAllDepartments(mData.departments);
                setPoMasterData(poData);

                // Initial total PO calculations
                const totalVal = poData.reduce((sum, p) => sum + (Number(p.totalPoAmount) || 0), 0);
                setPoTotal(totalVal);

                // Calculate stock alerts from inventory
                const low = invData.filter(i => (i.current || 0) < 5 && (i.current || 0) > 0).length;
                const outOf = invData.filter(i => (i.current || 0) <= 0).length;
                setAlerts({ lowStock: low, outOfStock: outOf });

            } catch (error) {
                console.error("Error loading dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    useEffect(() => {
        if (isLoading) return;

        // Get unique products from Indents

        const products = Array.from(
            new Set(
                indents
                    .filter((item) => item.product_name)
                    .map((item) => item.product_name || '')
            )
        );
        setAllProducts(products);

        // Filter data by date range, vendors, and products
        const filterByDateAndSelection = (item: IndentRecord) => {
            let valid = true;

            if (startDate && item.actual1) {
                const itemDate = new Date(item.actual1);
                valid = valid && itemDate >= startDate;
            }

            if (endDate && item.actual1) {
                const itemDate = new Date(item.actual1);
                valid = valid && itemDate <= endDate;
            }

            if (filteredVendors.length > 0 && item.vendor_name) {
                valid = valid && filteredVendors.includes(String(item.vendor_name));
            }

            if (filteredProducts.length > 0 && item.product_name) {
                valid = valid && filteredProducts.includes(item.product_name);
            }

            if (filteredDepartments.length > 0 && item.department) {
                valid = valid && filteredDepartments.includes(item.department);
            }

            return valid;
        };

        // Calculate Approved Indents (actual1 is filled)
        const approvedIndents = indents.filter(
            (item) => item.actual1 && filterByDateAndSelection(item)
        );
        const totalApprovedQuantity = approvedIndents.reduce(
            (sum, item) => sum + (item.approved_quantity || 0),
            0
        );
        setIndent({ count: approvedIndents.length, quantity: totalApprovedQuantity });

        // Calculate Purchases (Store In - Received items)
        const filterStoreIn = (item: StoreInRecord) => {
            let valid = true;

            // Date filtering
            if (startDate && item.timestamp) {
                const itemDate = new Date(item.timestamp);
                valid = valid && itemDate >= startDate;
            }
            if (endDate && item.timestamp) {
                const itemDate = new Date(item.timestamp);
                valid = valid && itemDate <= endDate;
            }

            if (filteredVendors.length > 0 && item.vendorName) {
                valid = valid && filteredVendors.includes(item.vendorName);
            }
            if (filteredProducts.length > 0 && item.productName) {
                valid = valid && filteredProducts.includes(item.productName);
            }
            return valid;
        };

        // Assuming Purchases = Received items (Stage 6)
        const purchases = storeIns.filter(item => item.actual6 && filterStoreIn(item));
        const totalPurchasedQuantity = purchases.reduce(
            (sum, item) => sum + (item.receivedQuantity || 0),
            0
        );
        setPurchase({ count: purchases.length, quantity: totalPurchasedQuantity });

        // Calculate Out/Issued (from Issue Records)
        // Using Issue Service for "Issued" stats
        const filterIssue = (item: IssueRecord) => {
            let valid = true;

            // Date filtering
            if (startDate && item.actual1) {
                const itemDate = new Date(item.actual1);
                valid = valid && itemDate >= startDate;
            }
            if (endDate && item.actual1) {
                const itemDate = new Date(item.actual1);
                valid = valid && itemDate <= endDate;
            }

            // Issue record might not have vendor name in the same way, but has product name
            if (filteredProducts.length > 0 && item.product_name) {
                valid = valid && filteredProducts.includes(item.product_name);
            }
            return valid;
        }

        const issued = issues.filter(item => item.actual1 && filterIssue(item)); // actual1 is issue date
        const totalIssuedQuantity = issued.reduce(
            (sum, item) => sum + (item.given_qty || 0),
            0
        );
        setOut({ count: issued.length, quantity: totalIssuedQuantity });

        // Trend Data Calculation (last 7 days or date range)
        const dateRange: string[] = [];
        const today = new Date();
        const start = startDate || new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const end = endDate || today;

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dateRange.push(format(new Date(d), 'yyyy-MM-dd'));
        }

        const trendMap: Record<string, TrendDataItem> = {};
        dateRange.forEach(d => {
            trendMap[d] = { date: format(new Date(d), 'MMM dd'), indents: 0, purchases: 0, issues: 0 };
        });

        indents.forEach(i => {
            if (i.timestamp) {
                const d = format(new Date(i.timestamp), 'yyyy-MM-dd');
                if (trendMap[d]) trendMap[d].indents += 1;
            }
        });

        // Calculate Top Vendors (based on PO Master for better volume representation)
        const vendorMap: Record<string, { orders: number; quantity: number }> = {};

        // Use PO Master for volume if available, or stay with Store In if preferred. 
        // Let's use PO totals for "Volume".
        poMasterData.forEach((item) => {
            const vendorName = String(item.partyName || '');
            if (vendorName) {
                if (!vendorMap[vendorName]) {
                    vendorMap[vendorName] = { orders: 0, quantity: 0 };
                }
                vendorMap[vendorName].orders += 1;
                vendorMap[vendorName].quantity += Number(item.totalPoAmount || 0);
            }
        });

        const topVendors = Object.entries(vendorMap)
            .map(([name, data]) => ({
                name,
                orders: data.orders,
                quantity: data.quantity, // This is now total amount
            }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);

        setTopVendors(topVendors);

        storeIns.forEach(s => {
            if (s.timestamp) {
                const d = format(new Date(s.timestamp), 'yyyy-MM-dd');
                if (trendMap[d]) trendMap[d].purchases += 1;
            }
        });

        issues.forEach(iss => {
            if (iss.actual1) {
                const d = format(new Date(iss.actual1), 'yyyy-MM-dd');
                if (trendMap[d]) trendMap[d].issues += 1;
            }
        });

        setTrendData(Object.values(trendMap));

        // Department Breakdown
        const deptMap: Record<string, number> = {};
        indents.forEach(i => {
            const dept = i.department || 'Unknown';
            deptMap[dept] = (deptMap[dept] || 0) + 1;
        });
        setDeptData(Object.entries(deptMap).map(([name, value]) => ({ name, value })));

        // Status Breakdown
        const statusMap: Record<string, number> = {
            'Pending Approval': indents.filter(i => !i.actual1).length,
            'Vendor Assigned': indents.filter(i => i.actual1 && !i.actual2).length,
            'PO Created': indents.filter(i => i.actual4).length,
            'Material Received': storeIns.filter(s => s.actual6).length,
            'HOD Check': storeIns.filter(s => s.plannedHod && !s.actualHod).length,
        };
        setStatusData(Object.entries(statusMap).map(([name, value]) => ({ name, value })));

    }, [startDate, endDate, filteredProducts, filteredVendors, indents, storeIns, issues, isLoading]);

    const chartConfig = {
        quantity: {
            label: 'Quantity',
            color: 'var(--color-primary)',
        },
    } satisfies ChartConfig;

    return (
        <div>
            <Heading heading="Dashboard" subtext="View your analytics">
                <LayoutDashboard size={50} className="text-primary" />
            </Heading>

            <div className="grid gap-3 m-3">
                <div className="gap-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                data-empty={!startDate}
                                className="data-[empty=true]:text-muted-foreground w-full min-w-0 justify-start text-left font-normal"
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {startDate ? (
                                    format(startDate, 'PPP')
                                ) : (
                                    <span>Pick a start date</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
                        </PopoverContent>
                    </Popover>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                data-empty={!endDate}
                                className="data-[empty=true]:text-muted-foreground w-full min-w-0 justify-start text-left font-normal"
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {endDate ? format(endDate, 'PPP') : <span>Pick an end date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={endDate} onSelect={setEndDate} />
                        </PopoverContent>
                    </Popover>
                    <ComboBox
                        multiple
                        options={allVendors.map((v) => ({ label: v, value: v }))}
                        value={filteredVendors}
                        onChange={setFilteredVendors}
                        placeholder="Select Vendors"
                    />
                    <ComboBox
                        multiple
                        options={allProducts.map((v) => ({ label: v, value: v }))}
                        value={filteredProducts}
                        onChange={setFilteredProducts}
                        placeholder="Select Products"
                    />
                    <ComboBox
                        multiple
                        options={allDepartments.map((v) => ({ label: v, value: v }))}
                        value={filteredDepartments}
                        onChange={setFilteredDepartments}
                        placeholder="Select Departments"
                    />
                </div>

                <div className="grid md:grid-cols-4 gap-3 lg:grid-cols-5">
                    <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/20 border-blue-200">
                        <CardContent className="pt-6">
                            <div className="text-blue-600 flex justify-between">
                                <p className="font-semibold">Procurement Indents</p>
                                <ClipboardList size={22} />
                            </div>
                            <p className="text-4xl font-black text-blue-900 mt-2">{indent.count}</p>
                            <div className="text-blue-600 flex justify-between mt-2 border-t border-blue-200 pt-2">
                                <p className="text-xs font-medium uppercase tracking-wider">Quantity</p>
                                <p className="font-bold">{indent.quantity}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/20 border-indigo-200">
                        <CardContent className="pt-6">
                            <div className="text-indigo-600 flex justify-between">
                                <p className="font-semibold">Total PO Value</p>
                                <CreditCard size={22} className="text-indigo-600" />
                            </div>
                            <p className="text-4xl font-black text-indigo-900 mt-2 text-ellipsis overflow-hidden">
                                ₹{poTotal > 100000 ? (poTotal / 100000).toFixed(2) + 'L' : poTotal.toLocaleString()}
                            </p>
                            <div className="text-indigo-600 flex justify-between mt-2 border-t border-indigo-200 pt-2">
                                <p className="text-xs font-medium uppercase tracking-wider">Avg/PO</p>
                                <p className="font-bold">₹{indent.count > 0 ? (poTotal / indent.count).toFixed(0) : 0}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-green-500/10 to-green-600/20 border-green-200">
                        <CardContent className="pt-6">
                            <div className="text-green-600 flex justify-between">
                                <p className="font-semibold">Items Received</p>
                                <Truck size={22} />
                            </div>
                            <p className="text-4xl font-black text-green-900 mt-2">{purchase.count}</p>
                            <div className="text-green-600 flex justify-between mt-2 border-t border-green-200 pt-2">
                                <p className="text-xs font-medium uppercase tracking-wider">Total Qty</p>
                                <p className="font-bold">{purchase.quantity}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/20 border-orange-200">
                        <CardContent className="pt-6">
                            <div className="text-orange-600 flex justify-between">
                                <p className="font-semibold">Stock Issued</p>
                                <PackageCheck size={22} />
                            </div>
                            <p className="text-4xl font-black text-orange-900 mt-2">{out.count}</p>
                            <div className="text-orange-600 flex justify-between mt-2 border-t border-orange-200 pt-2">
                                <p className="text-xs font-medium uppercase tracking-wider">Issue Qty</p>
                                <p className="font-bold">{out.quantity}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-red-500/10 to-red-600/20 border-red-200 text-red-600 md:col-span-4 lg:col-span-1">
                        <CardContent className="pt-6">
                            <div className="flex justify-between">
                                <p className="font-semibold">Stock Alerts</p>
                                <Warehouse size={22} />
                            </div>
                            <p className="text-4xl font-black text-red-900 mt-2">
                                {alerts.outOfStock}
                            </p>
                            <div className="text-red-600 flex justify-between mt-2 border-t border-red-200 pt-2">
                                <p className="text-xs font-medium uppercase tracking-wider">Low Stock</p>
                                <p className="font-bold">{alerts.lowStock}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-xl">Procurement & Outflow Trends</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData}>
                                    <defs>
                                        <linearGradient id="colorIndents" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={10} />
                                    <YAxis axisLine={false} tickLine={false} tickMargin={10} />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="indents" stroke="#3b82f6" fillOpacity={1} fill="url(#colorIndents)" strokeWidth={3} name="Indents" />
                                    <Area type="monotone" dataKey="purchases" stroke="#10b981" fillOpacity={1} fill="url(#colorPurchases)" strokeWidth={3} name="Purchases" />
                                    <Area type="monotone" dataKey="issues" stroke="#f97316" fillOpacity={0} strokeWidth={2} strokeDasharray="5 5" name="Stock Issued" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl">Departmental Indenting</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px] flex flex-col justify-center items-center">
                            <ResponsiveContainer width="100%" height="80%">
                                <PieChart>
                                    <Pie
                                        data={deptData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {deptData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#f97316'][index % 6]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full text-xs mt-2 overflow-y-auto max-h-20">
                                {deptData.map((d, i) => (
                                    <div key={i} className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#f97316'][i % 6] }}></div>
                                        <span className="truncate">{d.name} ({d.value})</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Card className="lg:col-span-1">
                        <CardHeader>
                            <CardTitle className="text-xl">Workflow Status Distribution</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={statusData} layout="vertical">
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{ fill: 'transparent' }} />
                                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                                        <LabelList dataKey="value" position="right" style={{ fontSize: '10px' }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xl">Top Vendors by Volume</CardTitle>
                            <Button variant="ghost" size="sm" className="text-xs text-blue-600">View All Vendors</Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {topVendorsData.length > 0 ? (
                                    topVendorsData.map((vendor, i) => (
                                        <div key={i} className="flex items-center">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs mr-3">
                                                {i + 1}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold text-slate-700 leading-none">{vendor.name}</p>
                                                <p className="text-xs text-slate-500 mt-1">{vendor.orders} Orders processed</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-slate-900">
                                                    ₹{vendor.quantity > 100000 ? (vendor.quantity / 100000).toFixed(1) + 'L' : vendor.quantity.toLocaleString()}
                                                </p>
                                                <p className="text-[10px] text-slate-400 uppercase font-medium">Value</p>
                                            </div>
                                            <div className="ml-4 w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500"
                                                    style={{ width: `${(vendor.quantity / topVendorsData[0].quantity) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center text-muted-foreground py-10 italic">
                                        No vendor performance data available
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* PC Reports Section */}
                <div className="grid grid-cols-1 gap-3">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl">PC Report Stage Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                                {pcReportSheet.map((pc, i) => (
                                    <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <p className="text-[10px] uppercase font-bold text-slate-500 mb-1 truncate" title={pc.stage}>
                                            {pc.stage}
                                        </p>
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-xl font-black text-slate-800">{pc.totalPending}</p>
                                                <p className="text-[9px] text-red-500 font-medium">Pending</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-green-600">{pc.totalComplete}</p>
                                                <p className="text-[9px] text-green-500 font-medium">Done</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

// Interfaces needed to keep the file valid
interface VendorDataItem {
    name: string;
    orders: number;
    quantity: number;
}

interface StatsData {
    count: number;
    quantity: number;
}

interface AlertsData {
    lowStock: number;
    outOfStock: number;
}

interface TrendDataItem {
    date: string;
    indents: number;
    purchases: number;
    issues: number;
}

interface DeptDataItem {
    name: string;
    value: number;
}

interface StatusDataItem {
    name: string;
    value: number;
}