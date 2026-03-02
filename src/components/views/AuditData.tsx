import { Package2, Calculator, FileCheck, AlertTriangle, RotateCcw, ShieldCheck, CheckSquare } from 'lucide-react';
import Heading from '../element/Heading';
import { useEffect, useState, useMemo } from 'react';
import type { ColumnDef, Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useAuth } from '@/context/AuthContext';
import { formatDateTime, parseCustomDate } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { Textarea } from '../ui/textarea';
import {
  fetchTallyEntryRecords,
  updateTallyEntryRecord,
  type TallyEntryRecord,
} from '@/services/tallyEntryService';

// Helper function to format date to dd/mm/yy
const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  try {
    const dateObj = new Date(dateString);
    if (isNaN(dateObj.getTime())) return dateString;
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = String(dateObj.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
};

// Define Stage interface
interface StageConfig {
  name: string;
  plannedField: string;
  actualField: string;
  statusField: string;
  remarksField: string;
  color: string;
  icon: any;
  description: string;
  formTitle: string;
  statusOptions: string[];
}

// Define Stages object with proper typing
const STAGES: Record<string, StageConfig> = {
  AUDIT: {
    name: 'Audit Data',
    plannedField: 'planned1',
    actualField: 'actual1',
    statusField: 'status1',
    remarksField: 'remarks1',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: FileCheck,
    description: 'Initial audit verification',
    formTitle: 'Process Audit Data',
    statusOptions: ['Done', 'Not Done']
  },
  RECTIFY: {
    name: 'Rectify Mistake',
    plannedField: 'planned2',
    actualField: 'actual2',
    statusField: 'status2',
    remarksField: 'remarks2',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: AlertTriangle,
    description: 'Correct mistakes and add bilty',
    formTitle: 'Rectify The Mistake',
    statusOptions: ['Done', 'Not Done']
  },
  REAUDIT: {
    name: 'Reaudit Data',
    plannedField: 'planned3',
    actualField: 'actual3',
    statusField: 'status3',
    remarksField: 'remarks3',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: RotateCcw,
    description: 'Re-audit after corrections',
    formTitle: 'Reauditing Data',
    statusOptions: ['Done', 'Not Done']
  },
  TALLY_ENTRY: {
    name: 'Tally Entry',
    plannedField: 'planned4',
    actualField: 'actual4',
    statusField: 'status4',
    remarksField: 'remarks4',
    color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    icon: Calculator,
    description: 'Enter data into tally system',
    formTitle: 'Tally Entry',
    statusOptions: ['Done', 'Not Done']
  },
  AGAIN_AUDIT: {
    name: 'Again Audit',
    plannedField: 'planned5',
    actualField: 'actual5',
    statusField: 'status5',
    remarksField: 'remarks5',
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    icon: ShieldCheck,
    description: 'Final audit verification after tally',
    formTitle: 'Again Audit',
    statusOptions: ['Done', 'Not Done']
  },
  COMPLETED: {
    name: 'Completed',
    plannedField: '',
    actualField: '',
    statusField: '',
    remarksField: '',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckSquare,
    description: 'All stages completed',
    formTitle: '',
    statusOptions: []
  }
};

// Update the ProcessedTallyData interface to include all remarks fields
interface ProcessedTallyData {
  id: number;
  indentNumber: string;
  indentDate: string;
  purchaseDate: string;
  materialInDate: string;
  plannedDate: string;
  productName: string;
  firmNameMatch: string;
  billNo: string;
  qty: number;
  partyName: string;
  billAmt: number;
  billImage: string;
  billRecievedLater: string;
  location: string;
  typeOfBills: string;
  productImage: string;
  area: string;
  indentedFor: string;
  approvedPartyName: string;
  rate: number;
  indentQty: number;
  totalRate: number;
  liftNumber: string;
  poNumber: string;
  currentStage: keyof typeof STAGES | string;
  isCompleted: boolean;

  // Add all remarks fields
  remarks1: string;
  remarks2: string;
  remarks3: string;
  remarks4: string;
  remarks5: string;

  // Add status fields for display
  status1: string;
  status2: string;
  status3: string;
  status4: string;
  status5: string;
  timestamp: string;
}

// Define form values type
interface FormValues {
  status: string | undefined;
  remarks: string;
}

export default function PcReportTable() {
  const [allData, setAllData] = useState<ProcessedTallyData[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ProcessedTallyData | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('ALL');

  const fetchAllData = async () => {
    setDataLoading(true);
    try {
      const records = await fetchTallyEntryRecords();

      const filteredByFirm = records.filter((item) => {
        return user.firmNameMatch.toLowerCase() === "all" || item.firmNameMatch === user.firmNameMatch;
      });

      const processedData = filteredByFirm.map((item) => {
        const hasValue = (value: any): boolean => {
          return value !== undefined && value !== null && value !== '' && String(value).trim() !== '';
        };

        // Determine current stage
        let currentStage: keyof typeof STAGES = 'AUDIT';
        let plannedDate = '';
        let isCompleted = false;

        if (hasValue(item.planned1) && !hasValue(item.actual1)) {
          currentStage = 'AUDIT';
          plannedDate = item.planned1;
        } else if (hasValue(item.planned2) && !hasValue(item.actual2)) {
          currentStage = 'RECTIFY';
          plannedDate = item.planned2;
        } else if (hasValue(item.planned3) && !hasValue(item.actual3)) {
          currentStage = 'REAUDIT';
          plannedDate = item.planned3;
        } else if (hasValue(item.planned4) && !hasValue(item.actual4)) {
          currentStage = 'TALLY_ENTRY';
          plannedDate = item.planned4;
        } else if (hasValue(item.planned5) && !hasValue(item.actual5)) {
          currentStage = 'AGAIN_AUDIT';
          plannedDate = item.planned5;
        } else if (hasValue(item.actual5)) {
          currentStage = 'COMPLETED';
          isCompleted = true;
          plannedDate = item.planned5 || item.planned4 || item.planned3 || item.planned2 || item.planned1;
        } else {
          return null;
        }

        return {
          id: item.id,
          indentNumber: item.indentNumber,
          indentDate: '', // Not in TallyEntryRecord but was in SheetItem?
          purchaseDate: '',
          materialInDate: item.materialInDate,
          plannedDate: plannedDate,
          productName: item.productName,
          firmNameMatch: item.firmNameMatch,
          billNo: item.billNo,
          qty: item.qty,
          partyName: item.partyName,
          billAmt: item.billAmt,
          billImage: item.billImage,
          billRecievedLater: item.billRecievedLater,
          location: item.location,
          typeOfBills: item.typeOfBills,
          productImage: item.productImage,
          area: item.area,
          indentedFor: item.indentedFor,
          approvedPartyName: item.approvedPartyName,
          rate: item.rate,
          indentQty: item.indentQty,
          totalRate: item.totalRate,
          liftNumber: item.liftNumber,
          poNumber: item.poNumber,
          currentStage,
          isCompleted,
          remarks1: item.remarks1,
          remarks2: item.remarks2,
          remarks3: item.remarks3,
          remarks4: item.remarks4,
          remarks5: item.remarks5,
          status1: item.status1,
          status2: item.status2,
          status3: item.status3,
          status4: item.status4,
          status5: item.status5,
          timestamp: item.timestamp || '',
        };
      }).filter((item): item is ProcessedTallyData => item !== null);

      setAllData(processedData);
    } catch (error) {
      console.error('Failed to fetch tally entry records:', error);
      toast.error('Failed to load data');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [user.firmNameMatch]);

  // Filter data based on active tab
  const filteredData = useMemo(() => {
    let filtered = allData;

    // Filter by stage if not "ALL" or "COMPLETED"
    if (activeTab === 'COMPLETED') {
      filtered = filtered.filter(item => item.isCompleted);
    } else if (activeTab !== 'ALL') {
      filtered = filtered.filter(item =>
        !item.isCompleted && item.currentStage === activeTab
      );
    } else {
      // ALL shows all pending items (not completed)
      filtered = filtered.filter(item => !item.isCompleted);
    }

    return filtered;
  }, [allData, activeTab]);

  // Get stage counts
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: allData.filter(item => !item.isCompleted).length,
      COMPLETED: allData.filter(item => item.isCompleted).length
    };

    ['AUDIT', 'RECTIFY', 'REAUDIT', 'TALLY_ENTRY', 'AGAIN_AUDIT'].forEach(stage => {
      counts[stage] = allData.filter(item =>
        !item.isCompleted && item.currentStage === stage
      ).length;
    });

    return counts;
  }, [allData]);

  // Get schema based on stage
  const formSchema = z.object({
    status: z.string().min(1, 'Please select a status'),
    remarks: z.string().min(1, 'Remarks are required'),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: '',
      remarks: '',
    },
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!openDialog) {
      form.reset({
        status: undefined,
        remarks: ''
      });
    }
  }, [openDialog, form]);

  // Handle item selection
  const handleItemSelect = (item: ProcessedTallyData) => {
    setSelectedRow(item);
    form.reset({
      status: '',
      remarks: '',
    });
    setOpenDialog(true);
  };

  // Handle form submission
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!selectedRow) {
      toast.error('No row selected!');
      return;
    }

    try {
      console.log('🔄 Starting form submission...');

      const currentDateTime = new Date().toISOString();
      const stageConfig = STAGES[selectedRow.currentStage];

      // Prepare updates for current stage
      const updates: Record<string, any> = {
        [stageConfig.statusField]: values.status || '',
        [stageConfig.remarksField]: values.remarks
      };

      // Handle workflow logic: Set the actual completion date to fire database triggers
      if (values.status === 'Done') {
        // For all stages, 'Done' marks the stage as complete
        updates[stageConfig.actualField] = currentDateTime;
        console.log(`✅ Stage ${selectedRow.currentStage} marked as Done`);
      } else if (selectedRow.currentStage === 'AUDIT' && values.status === 'Not Done') {
        // Special Case: Audit Data 'Not Done' also marks the stage as complete
        // This triggers the 'planned2' update (Rectify Mistake) via DB trigger
        updates[stageConfig.actualField] = currentDateTime;
        console.log('➡️ Audit marked as Not Done, triggering Rectification flow');
      }
      // Note: For other stages, 'Not Done' keeps the item in the current stage
      // as the actual date is not updated.

      await updateTallyEntryRecord(selectedRow.indentNumber, updates);

      console.log('✅ Update successful');
      toast.success(`Status updated for Indent ${selectedRow.indentNumber}`);

      setOpenDialog(false);
      setTimeout(() => {
        fetchAllData();
      }, 1000);

    } catch (err) {
      console.error('❌ Error in onSubmit:', err);
      toast.error('Failed to update status. Please try again.');
    }
  }

  function onError(errors: any) {
    console.log(errors);
    toast.error('Please fill all required fields');
  }

  // Columns for pending items (showing ALL columns like your Audit Data page)
  const pendingColumns: ColumnDef<ProcessedTallyData>[] = [
    {
      id: 'actions',
      header: 'Action',
      cell: ({ row }: { row: Row<ProcessedTallyData> }) => {
        const rowData = row.original;
        const stageInfo = STAGES[rowData.currentStage];
        const IconComponent = stageInfo?.icon;

        return (
          <DialogTrigger asChild>
            <Button
              variant="outline"
              onClick={() => handleItemSelect(rowData)}
              className="flex items-center gap-2"
            >
              {IconComponent && <IconComponent className="w-4 h-4" />}
              Process
            </Button>
          </DialogTrigger>
        );
      },
    },
    {
      accessorKey: 'timestamp',
      header: 'Timestamp',
      cell: ({ getValue }) => <div>{getValue() ? formatDateTime(parseCustomDate(getValue())) : '-'}</div>,
    },
    {
      accessorKey: 'indentNumber',
      header: 'Indent No.'
    },
    {
      accessorKey: 'currentStage',
      header: 'Current Stage',
      cell: ({ row }) => {
        const stage = row.original.currentStage;
        const stageInfo = STAGES[stage];

        return (
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${stageInfo?.color || 'bg-gray-100 text-gray-800'}`}>
            {stageInfo?.name}
          </span>
        );
      },
    },
    {
      accessorKey: 'liftNumber',
      header: 'Lift Number',
      cell: ({ row }) => row.original.liftNumber || ''
    },
    {
      accessorKey: 'poNumber',
      header: 'Po Number',
      cell: ({ row }) => row.original.poNumber || ''
    },
    {
      accessorKey: 'materialInDate',
      header: 'Material In Date',
      cell: ({ row }) => formatDate(row.original.materialInDate)
    },
    {
      accessorKey: 'plannedDate',
      header: 'Planned Date',
      cell: ({ row }) => formatDate(row.original.plannedDate)
    },
    { accessorKey: 'productName', header: 'Product Name' },
    { accessorKey: 'billNo', header: 'Bill No.' },
    { accessorKey: 'qty', header: 'Qty' },
    { accessorKey: 'partyName', header: 'Party Name' },
    { accessorKey: 'billAmt', header: 'Bill Amt' },
    {
      accessorKey: 'billImage',
      header: 'Bill Image',
      cell: ({ row }) => {
        const image = row.original.billImage;
        return image ? (
          <a href={image} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            View
          </a>
        ) : null;
      },
    },
    { accessorKey: 'billReceivedLater', header: 'Bill Received Later' },
    { accessorKey: 'notReceivedBillNo', header: 'Not Received Bill No.' },
    { accessorKey: 'location', header: 'Location' },
    { accessorKey: 'typeOfBills', header: 'Type Of Bills' },
    {
      accessorKey: 'productImage',
      header: 'Product Image',
      cell: ({ row }) => {
        const image = row.original.productImage;
        return image ? (
          <a href={image} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            View
          </a>
        ) : null;
      },
    },
    { accessorKey: 'area', header: 'Area' },
    { accessorKey: 'indentedFor', header: 'Indented For' },
    { accessorKey: 'approvedPartyName', header: 'Approved Party Name' },
    { accessorKey: 'rate', header: 'Rate' },
    { accessorKey: 'indentQty', header: 'Indent Qty' },
    { accessorKey: 'totalRate', header: 'Total Rate' },

    // Add status and remarks columns for each stage
    {
      accessorKey: 'status1',
      header: 'Audit Status',
      cell: ({ row }) => {
        const status = row.original.status1;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks1',
      header: 'Audit Remarks',
      cell: ({ row }) => {
        const remarks = row.original.remarks1;
        return remarks ? (
          <div className="max-w-xs truncate" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'status2',
      header: 'Rectify Status',
      cell: ({ row }) => {
        const status = row.original.status2;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks2',
      header: 'Rectify Remarks',
      cell: ({ row }) => {
        const remarks = row.original.remarks2;
        return remarks ? (
          <div className="max-w-xs truncate" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'status3',
      header: 'Reaudit Status',
      cell: ({ row }) => {
        const status = row.original.status3;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks3',
      header: 'Reaudit Remarks',
      cell: ({ row }) => {
        const remarks = row.original.remarks3;
        return remarks ? (
          <div className="max-w-xs truncate" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'status4',
      header: 'Tally Status',
      cell: ({ row }) => {
        const status = row.original.status4;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks4',
      header: 'Tally Remarks',
      cell: ({ row }) => {
        const remarks = row.original.remarks4;
        return remarks ? (
          <div className="max-w-xs truncate" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'status5',
      header: 'Again Audit Status',
      cell: ({ row }) => {
        const status = row.original.status5;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks5',
      header: 'Again Audit Remarks',
      cell: ({ row }) => {
        const remarks = row.original.remarks5;
        return remarks ? (
          <div className="max-w-xs truncate" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
  ];

  // Update completedColumns to show all status and remarks
  const completedColumns: ColumnDef<ProcessedTallyData>[] = [
    {
      accessorKey: 'timestamp',
      header: 'Timestamp',
      cell: ({ getValue }) => <div>{getValue() ? formatDateTime(parseCustomDate(getValue())) : '-'}</div>,
    },
    {
      accessorKey: 'indentNumber',
      header: 'Indent No.'
    },
    {
      accessorKey: 'firmNameMatch',
      header: 'Firm Name'
    },
    {
      accessorKey: 'plannedDate',
      header: 'Completed Date',
      cell: ({ row }) => formatDate(row.original.plannedDate)
    },
    { accessorKey: 'productName', header: 'Product Name' },
    { accessorKey: 'billNo', header: 'Bill No' },
    { accessorKey: 'qty', header: 'Quantity' },
    { accessorKey: 'partyName', header: 'Party Name' },
    { accessorKey: 'billAmt', header: 'Bill Amount' },
    {
      accessorKey: 'status1',
      header: 'Audit Status',
      cell: ({ row }) => {
        const status = row.original.status1;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks1',
      header: 'Audit Remarks',
      cell: ({ row }) => {
        const remarks = row.original.remarks1;
        return remarks ? (
          <div className="max-w-xs truncate" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'status2',
      header: 'Rectify Status',
      cell: ({ row }) => {
        const status = row.original.status2;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks2',
      header: 'Rectify Remarks',
      cell: ({ row }) => {
        const remarks = row.original.remarks2;
        return remarks ? (
          <div className="max-w-xs truncate" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'status3',
      header: 'Reaudit Status',
      cell: ({ row }) => {
        const status = row.original.status3;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks3',
      header: 'Reaudit Remarks',
      cell: ({ row }) => {
        const remarks = row.original.remarks3;
        return remarks ? (
          <div className="max-w-xs truncate" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'status4',
      header: 'Tally Status',
      cell: ({ row }) => {
        const status = row.original.status4;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks4',
      header: 'Tally Remarks',
      cell: ({ row }) => {
        const remarks = row.original.remarks4;
        return remarks ? (
          <div className="max-w-xs truncate" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'status5',
      header: 'Again Audit Status',
      cell: ({ row }) => {
        const status = row.original.status5;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks5',
      header: 'Again Audit Remarks',
      cell: ({ row }) => {
        const remarks = row.original.remarks5;
        return remarks ? (
          <div className="max-w-xs truncate" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
  ];

  // Stats data
  const statsData = [
    { title: 'Total Pending', value: stageCounts.ALL, color: 'text-gray-600' },
    { title: 'Audit', value: stageCounts.AUDIT, color: 'text-amber-600' },
    { title: 'Rectify', value: stageCounts.RECTIFY, color: 'text-blue-600' },
    { title: 'Reaudit', value: stageCounts.REAUDIT, color: 'text-purple-600' },
    { title: 'Tally Entry', value: stageCounts.TALLY_ENTRY, color: 'text-cyan-600' },
    { title: 'Again Audit', value: stageCounts.AGAIN_AUDIT, color: 'text-rose-600' },
  ];

  return (
    <div>
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <Heading heading="Call Tracker" subtext="Track all stages of account processing">
          <Package2 size={50} className="text-primary" />
        </Heading>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          {statsData.map((stat, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm p-4 border">
              <p className="text-sm font-medium text-gray-500 mb-1">{stat.title}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="all" className="w-full">
          {/* Tabs Navigation */}
          <TabsList className="grid grid-cols-2 md:grid-cols-6 mb-6">
            <TabsTrigger value="all" onClick={() => setActiveTab('ALL')}>
              All Pending
            </TabsTrigger>
            <TabsTrigger value="audit" onClick={() => setActiveTab('AUDIT')}>
              Audit
            </TabsTrigger>
            <TabsTrigger value="rectify" onClick={() => setActiveTab('RECTIFY')}>
              Rectify
            </TabsTrigger>
            <TabsTrigger value="reaudit" onClick={() => setActiveTab('REAUDIT')}>
              Reaudit
            </TabsTrigger>
            <TabsTrigger value="tally" onClick={() => setActiveTab('TALLY_ENTRY')}>
              Tally Entry
            </TabsTrigger>
            <TabsTrigger value="again_audit" onClick={() => setActiveTab('AGAIN_AUDIT')}>
              Again Audit
            </TabsTrigger>
            <TabsTrigger value="completed" onClick={() => setActiveTab('COMPLETED')}>
              Completed
            </TabsTrigger>
          </TabsList>

          {/* Tabs Content */}
          <TabsContent value="all">
            <DataTable
              data={filteredData}
              columns={pendingColumns}
              searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
              dataLoading={dataLoading}
              className='h-[70dvh]'
            />
          </TabsContent>

          <TabsContent value="audit">
            <DataTable
              data={filteredData}
              columns={pendingColumns}
              searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
              dataLoading={dataLoading}
              className='h-[70dvh]'
            />
          </TabsContent>

          <TabsContent value="rectify">
            <DataTable
              data={filteredData}
              columns={pendingColumns}
              searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
              dataLoading={dataLoading}
              className='h-[70dvh]'
            />
          </TabsContent>

          <TabsContent value="reaudit">
            <DataTable
              data={filteredData}
              columns={pendingColumns}
              searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
              dataLoading={dataLoading}
              className='h-[70dvh]'
            />
          </TabsContent>

          <TabsContent value="tally">
            <DataTable
              data={filteredData}
              columns={pendingColumns}
              searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
              dataLoading={dataLoading}
              className='h-[70dvh]'
            />
          </TabsContent>


          <TabsContent value="completed">
            <DataTable
              data={filteredData}
              columns={completedColumns}
              searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
              dataLoading={dataLoading}
              className='h-[70dvh]'
            />
          </TabsContent>
        </Tabs>

        {selectedRow && (
          <DialogContent className="sm:max-w-2xl">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit, onError)}
                className="space-y-5"
              >
                <DialogHeader className="space-y-1">
                  <DialogTitle>
                    {STAGES[selectedRow.currentStage]?.formTitle || 'Update Status'}
                  </DialogTitle>
                  <DialogDescription>
                    Process entry for indent number{' '}
                    <span className="font-medium">{selectedRow.indentNumber}</span>
                    {' '}in{' '}
                    <span className="font-medium">{STAGES[selectedRow.currentStage]?.name}</span> stage
                  </DialogDescription>
                </DialogHeader>

                <div className="bg-gray-50 p-4 rounded-md grid gap-3">
                  <h3 className="text-lg font-bold">Entry Details</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-nowrap">Indent No.</p>
                      <p className="text-sm font-light">{selectedRow.indentNumber}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-nowrap">Firm Name</p>
                      <p className="text-sm font-light">{selectedRow.firmNameMatch}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-nowrap">Product Name</p>
                      <p className="text-sm font-light">{selectedRow.productName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Party Name</p>
                      <p className="text-sm font-light">{selectedRow.partyName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Bill No.</p>
                      <p className="text-sm font-light">{selectedRow.billNo}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Quantity</p>
                      <p className="text-sm font-light">{selectedRow.qty}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Bill Amount</p>
                      <p className="text-sm font-light">{selectedRow.billAmt}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Planned Date</p>
                      <p className="text-sm font-light">{formatDate(selectedRow.plannedDate)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Done">Done</SelectItem>
                              <SelectItem value="Not Done">Not Done</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="remarks"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Remarks *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter remarks..."
                            {...field}
                            rows={4}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Close</Button>
                  </DialogClose>

                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && (
                      <Loader
                        size={20}
                        color="white"
                        aria-label="Loading Spinner"
                      />
                    )}
                    Update Status
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}