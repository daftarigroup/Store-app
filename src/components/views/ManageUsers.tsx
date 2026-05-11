import { Building, ShieldCheck, User as UserIcon, Eye, EyeClosed, MoreHorizontal, Pencil, ShieldUser, Trash, UserPlus, Fingerprint, Lock, Shield, Settings, CheckSquare, ListTodo, ClipboardCheck, Truck, BarChart3, Receipt, Box, Users } from 'lucide-react';
import Heading from '../element/Heading';
import { useEffect, useMemo, useState } from 'react';
import { allPermissionKeys, type UserPermissions } from '@/types/sheets';
import type { ColumnDef } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useAuth } from '@/context/AuthContext';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { PuffLoader as Loader } from 'react-spinners';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card';
import { Pill } from '../ui/pill';
import { fetchUsers, createUser, updateUser, deleteUser } from '@/services/userService';
import { fetchMasterOptions } from '@/services/masterService';
import { Card, CardContent } from '../ui/card';
import { Separator } from '../ui/separator';
import { cn } from '@/lib/utils';

interface UsersTableData {
    id: number;
    username: string;
    name: string;
    password: string;
    modify_access: 'EDIT' | 'VIEW';
    firmNameMatch: string;
    firm_access: string[];
    permissions: string[];
}

function camelToTitleCase(str: string): string {
    return str
        .replace(/([a-z])([A-Z])/g, '$1 $2') // insert space before capitals
        .replace(/^./, (char) => char.toUpperCase()); // capitalize first letter
}

const permissionLabels: Record<string, string> = {
    administrate: 'Admin Access (Manage Users / Master Registry)',
    createIndent: 'Create Indent',
    pendingIndentsView: 'PO to Make/Not (Legacy)',
    indentApprovalView: 'Indent Approval',
    indentApprovalAction: 'Indent Approval (Approve/Reject)',
    createPo: 'Create PO / Enquiry',
    poHistory: 'PO History (Legacy)',
    ordersView: 'Lifting / PO History',
    updateVendorView: 'Vendor Rate Update',
    updateVendorAction: 'Vendor Rate Update (Save/Update)',
    threePartyApprovalView: 'Technical / Management Approval',
    threePartyApprovalAction: 'Technical/Management (Rank/Approve)',
    pendingPo: 'Pending PO to be Created',
    storeIssue: 'Store Issue',
    storeIssueReturn: 'Store Issue Return',
    issueData: 'Store Data',
    inventory: 'Inventory',
    storeIn: 'Store Check',
    hodStoreApproval: 'HOD Check',
    fullKiting: 'Freight Payment',
    receiveItemView: 'Reject For GRN (View)',
    insteadOfQualityCheckInReceivedItem: 'Reject For GRN',
    receiveItemAction: 'Reject For GRN (Action)',
    storeOutApprovalView: 'Store Out Approval',
    storeOutApprovalAction: 'Store Out Approval (Action)',
    againAuditing: 'Again Auditing',
    reauditData: 'Reaudit Data',
    rectifyTheMistake: 'Rectify the mistake',
    auditData: 'Audit Data',
    takeEntryByTelly: 'Take Entry By Tally',
    sendDebitNote: 'Send Debit Note',
    returnMaterialToParty: 'Return Material To Party',
    exchangeMaterials: 'Exchange Materials',
    dbForPc: 'DB For PC',
    billNotReceived: 'Bill Not Received',
    makePayment: 'Make Payment',
};

const permissionGroups = [
    {
        name: 'System & Admin',
        icon: <Settings size={16} />,
        keys: ['administrate']
    },
    {
        name: 'Indents Management',
        icon: <ListTodo size={16} />,
        keys: ['createIndent', 'pendingIndentsView', 'indentApprovalView', 'indentApprovalAction']
    },
    {
        name: 'Purchasing & PO',
        icon: <ClipboardCheck size={16} />,
        keys: ['createPo', 'poHistory', 'ordersView', 'updateVendorView', 'updateVendorAction', 'threePartyApprovalView', 'threePartyApprovalAction', 'pendingPo']
    },
    {
        name: 'Store Operations',
        icon: <Box size={16} />,
        keys: ['storeIssue', 'storeIssueReturn', 'issueData', 'inventory', 'storeIn', 'hodStoreApproval', 'fullKiting', 'receiveItemView', 'insteadOfQualityCheckInReceivedItem', 'receiveItemAction', 'storeOutApprovalView', 'storeOutApprovalAction']
    },
    {
        name: 'Auditing & Corrections',
        icon: <BarChart3 size={16} />,
        keys: ['auditData', 'againAuditing', 'reauditData', 'rectifyTheMistake', 'takeEntryByTelly']
    },
    {
        name: 'Logistics & Payments',
        icon: <Truck size={16} />,
        keys: ['sendDebitNote', 'returnMaterialToParty', 'exchangeMaterials', 'dbForPc', 'billNotReceived', 'makePayment']
    }
];

export default function ManageUsers() {
    const { user: currentUser, refreshUser } = useAuth();

    const [tableData, setTableData] = useState<UsersTableData[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UsersTableData | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [allProjectOptions, setAllProjectOptions] = useState<{ id: number; name: string }[]>([]);
    const permittedProjects = useMemo(() => {
        return [...allProjectOptions].sort((a, b) => a.name.localeCompare(b.name));
    }, [allProjectOptions]);

    useEffect(() => {
        fetchMasterOptions()
            .then((masterOptions) => setAllProjectOptions(masterOptions.firmObjects || []))
            .catch((error) => {
                console.error('Failed to fetch project options:', error);
                toast.error('Failed to load project options');
            });
    }, []);


    useEffect(() => {
        if (!openDialog) {
            setSelectedUser(null);
            setShowPassword(false);
        }
    }, [openDialog]);

    async function fetchUser() {
        setDataLoading(true);
        try {
            const users = await fetchUsers();
            const sortedUsers = users.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setTableData(
                sortedUsers.map((user) => {
                    const permissionKeys = allPermissionKeys.filter(
                        (key) => user[key as keyof UserPermissions] === true
                    );

                    return {
                        id: user.id,
                        username: user.username,
                        name: user.name,
                        password: user.password,
                        modify_access: user.modify_access || 'EDIT',
                        firmNameMatch: user.firmNameMatch,
                        firm_access: user.firm_access || [],
                        permissions: permissionKeys,
                    };
                })
            );
        } catch (error) {
            console.error('Failed to fetch users:', error);
            toast.error('Failed to load users');
        } finally {
            setDataLoading(false);
        }
    }

    useEffect(() => {
        fetchUser();
    }, []);

    const columns: ColumnDef<UsersTableData>[] = [
        {
            accessorKey: 'name',
            header: 'User Profile',
            cell: ({ row }) => (
                <div className="flex items-center gap-3 justify-start pl-4 group">
                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 transition-transform duration-300 group-hover:scale-110 ring-4 ring-transparent group-hover:ring-primary/5">
                        <UserIcon size={18} />
                    </div>
                    <div className="flex flex-col min-w-0 text-left">
                        <span className="font-bold text-sm truncate tracking-tight">{row.original.name}</span>
                        <span className="text-[11px] text-muted-foreground truncate opacity-70 group-hover:opacity-100 transition-opacity">@{row.original.username}</span>
                    </div>
                </div>
            )
        },
        {
            accessorKey: 'firm_access',
            header: 'Project Scope',
            cell: ({ row }) => (
                <div className="flex items-center gap-2 text-sm justify-start pl-4">
                    <Building size={14} className="text-muted-foreground shrink-0" />
                    <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        row.original.permissions.includes('administrate')
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-muted text-muted-foreground border border-border"
                    )}>
                        {row.original.firm_access.length > 0
                            ? `${row.original.firm_access.length} Project(s)`
                            : "No Access"}
                    </span>
                </div>
            )
        },
        {
            accessorKey: 'permissions',
            header: 'Access Level',
            cell: ({ row }) => {
                const permissions = row.original.permissions;
                const isAdmin = permissions.includes('administrate');
                const otherPermissions = permissions.filter(p => p !== 'administrate');

                return (
                    <div className="grid place-items-start pl-4">
                        <div className="flex flex-wrap gap-1.5 items-center">
                            {isAdmin && (
                                <Pill variant="primary" className="bg-primary hover:bg-primary text-secondary border-none shadow-sm shadow-primary/20">
                                    <ShieldCheck size={10} className="mr-1 inline" /> Administrator
                                </Pill>
                            )}
                            {otherPermissions.slice(0, 2).map((perm, i) => (
                                <Pill key={i} variant="secondary" className="bg-secondary/50 border-none text-[10px] uppercase tracking-wider">{camelToTitleCase(perm)}</Pill>
                            ))}
                            {otherPermissions.length > 2 && (
                                <HoverCard openDelay={100}>
                                    <HoverCardTrigger asChild>
                                        <div className="cursor-pointer">
                                            <Pill variant="default" className="text-[10px] bg-muted hover:bg-muted/80">+{otherPermissions.length - 2} more</Pill>
                                        </div>
                                    </HoverCardTrigger>
                                    <HoverCardContent className="w-80 p-4 shadow-xl border-primary/10 bg-background/95 backdrop-blur-md">
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Detailed Permissions</h4>
                                            <div className="flex flex-wrap gap-1.5">
                                                {otherPermissions.map((perm, i) => (
                                                    <Pill key={i} variant="secondary" className="text-[10px]">{permissionLabels[perm] || camelToTitleCase(perm)}</Pill>
                                                ))}
                                            </div>
                                        </div>
                                    </HoverCardContent>
                                </HoverCard>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                const user = row.original;
                return (
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:bg-primary/10"
                            onClick={() => {
                                setSelectedUser(user);
                                setOpenDialog(true);
                            }}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            disabled={user.username === 'admin' || user.username === currentUser.username}
                            onClick={async () => {
                                if (confirm(`Are you sure you want to permanently delete user "${user.name}"?`)) {
                                    try {
                                        await deleteUser(user.id);
                                        toast.success(`User deleted successfully`);
                                        fetchUser();
                                    } catch {
                                        toast.error('Failed to delete user');
                                    }
                                }
                            }}
                        >
                            <Trash className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                asChild
                                disabled={
                                    user.username === 'admin' || user.username === currentUser.username
                                }
                            >
                                <Button variant="ghost" className="h-8 w-8 p-0 mr-4 hover:bg-primary/10 hover:text-primary transition-colors">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 p-1">
                                <DropdownMenuItem
                                    className="cursor-pointer gap-2 focus:bg-primary/5 focus:text-primary"
                                    onClick={() => {
                                        setSelectedUser(user);
                                        setOpenDialog(true);
                                    }}
                                >
                                    <Pencil className="h-4 w-4" /> Edit User Access
                                </DropdownMenuItem>
                                <Separator className="my-1" />
                                <DropdownMenuItem
                                    className="cursor-pointer gap-2 focus:bg-destructive/5 focus:text-destructive text-destructive"
                                    onClick={async () => {
                                        if (confirm(`Are you sure you want to permanently delete user "${user.name}"? This action cannot be undone.`)) {
                                            try {
                                                if (user.username === 'admin') {
                                                    throw new Error();
                                                }
                                                await deleteUser(user.id);
                                                toast.success(`User deleted successfully`);
                                                fetchUser();
                                            } catch {
                                                toast.error('Failed to delete user');
                                            }
                                        }
                                    }}
                                >
                                    <Trash className="h-4 w-4" /> Delete User
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            },
        },
    ];

    const schema = z.object({
        name: z.string().min(1, 'Full name is required'),
        username: z.string().min(3, 'Username must be at least 3 characters'),
        password: z.string().min(4, 'Password must be at least 4 characters'),
        modify_access: z.enum(['EDIT', 'VIEW']),
        firmNameMatch: z.string().optional(),
        firm_access: z.array(z.string()),
        permissions: z.array(z.string()),
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            username: '',
            name: '',
            password: '',
            modify_access: 'EDIT',
            firmNameMatch: '',
            firm_access: [],
            permissions: [],
        },
    });

    useEffect(() => {
        if (selectedUser) {
            form.reset({
                username: selectedUser.username,
                name: selectedUser.name,
                password: selectedUser.password,
                modify_access: selectedUser.modify_access || 'EDIT',
                firmNameMatch: selectedUser.firmNameMatch,
                        firm_access: selectedUser.firm_access.map((firm) => firm.trim()).filter(Boolean),
                permissions: selectedUser.permissions,
            });
            return;
        }
        form.reset({
            name: '',
            username: '',
            password: '',
            modify_access: 'EDIT',
            firmNameMatch: '',
            firm_access: [],
            permissions: [],
        });
    }, [selectedUser]);

    async function onSubmit(value: z.infer<typeof schema>) {
        if (
            tableData.map((d) => d.username).includes(value.username) &&
            (!selectedUser || value.username !== selectedUser.username)
        ) {
            toast.error('Username already exists. Please choose a unique one.');
            return;
        }

        const userData: any = {
            username: value.username,
            name: value.name,
            password: value.password,
            modify_access: value.modify_access,
            firmNameMatch: value.firmNameMatch || '',
            firm_access: value.firm_access.map((firm) => firm.trim()).filter(Boolean),
        };

        allPermissionKeys.forEach((perm) => {
            userData[perm] = value.permissions.includes(perm);
        });

        try {
            if (selectedUser) {
                await updateUser(selectedUser.id, userData);
                if (selectedUser.username === currentUser.username) {
                    await refreshUser();
                }
                toast.success('User updated successfully');
            } else {
                await createUser(userData);
                toast.success('New user profile created');
            }
            setOpenDialog(false);
            fetchUser();
        } catch (error) {
            console.error('Error saving user:', error);
            toast.error('Caught an error while saving user profile');
        }
    }

    function onError(e: any) {
        console.error('Form errors:', e);
        toast.error('Validation failed. Please check the form fields.');
    }

    return (
        <div className="h-full space-y-6">
            <Dialog open={openDialog} onOpenChange={(open) => setOpenDialog(open)}>
                <div className="relative">
                    <Heading
                        heading="Manage Users"
                        subtext="Create users, assign system permissions, and manage project-wide access"
                    >
                        <div className="flex -space-x-2">
                             <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-2xl shadow-lg shadow-blue-500/20 text-white transform -rotate-12">
                                <ShieldUser size={40} />
                            </div>
                        </div>
                    </Heading>

                    <div className="mt-8">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={['name', 'username', 'permissions', 'firmNameMatch']}
                            dataLoading={dataLoading}
                            className="h-[calc(100dvh-200px)] overflow-hidden rounded-xl border-primary/5 bg-card shadow-xl shadow-black/5"
                            extraActions={
                                <Button
                                    className="h-10 px-6 gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 transition-all active:scale-95"
                                    onClick={() => {
                                        setOpenDialog(true);
                                        setSelectedUser(null);
                                    }}
                                >
                                    <UserPlus size={18} />
                                    <span className="hidden sm:inline">Add New User</span>
                                </Button>
                            }
                        />
                    </div>
                </div>

                <DialogContent className="sm:max-w-4xl max-h-[90dvh] overflow-y-auto custom-scrollbar p-0 border-none bg-background shadow-2xl">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit, onError)} className="flex flex-col h-full">
                            <div className="p-6 md:p-8 space-y-8">
                                <DialogHeader className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                            {selectedUser ? <Pencil size={20} /> : <UserPlus size={20} />}
                                        </div>
                                        <DialogTitle className="text-2xl font-bold tracking-tight">
                                            {selectedUser ? 'Edit User Profile' : 'Register New User'}
                                        </DialogTitle>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Configure account identification and granular system permissions for the user.
                                    </p>
                                </DialogHeader>

                                <div className="grid md:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-2xl border border-border/50">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="flex items-center gap-2">
                                                    <Fingerprint size={14} className="text-primary" /> Full Name
                                                </FormLabel>
                                                <FormControl>
                                                    <Input className="bg-background" placeholder="e.g. John Doe" {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="username"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="flex items-center gap-2">
                                                    <UserIcon size={14} className="text-primary" /> Username
                                                </FormLabel>
                                                <FormControl>
                                                    <Input className="bg-background" placeholder="johndoe123" {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="flex items-center gap-2">
                                                    <Lock size={14} className="text-primary" /> Security Password
                                                </FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input
                                                            type={showPassword ? 'text' : 'password'}
                                                            className="bg-background pr-10"
                                                            placeholder="••••••••"
                                                            {...field}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                setShowPassword(!showPassword);
                                                            }}
                                                        >
                                                            {showPassword ? <EyeClosed size={18} /> : <Eye size={18} />}
                                                        </button>
                                                    </div>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="modify_access"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="flex items-center gap-2">
                                                    <ShieldCheck size={14} className="text-primary" /> Modify Access
                                                </FormLabel>
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <FormControl>
                                                        <SelectTrigger className="bg-background w-full">
                                                            <SelectValue placeholder="Select access" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="EDIT">EDIT - Can view and modify</SelectItem>
                                                        <SelectItem value="VIEW">VIEW - View only</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />
                                    <div className="md:col-span-2 space-y-4">
                                        <FormLabel className="flex items-center gap-2">
                                            <Building size={14} className="text-primary" /> Permitted Projects (Firm Access)
                                        </FormLabel>
                                        {permittedProjects.length > 0 && (

                                            <FormField
                                                control={form.control}
                                                name="firm_access"
                                                render={({ field }) => {
                                                    const selected = (field.value || []).map((v) => String(v).trim()).filter(Boolean);
                                                    const allSelected = permittedProjects.length > 0 && permittedProjects.every((p) => selected.includes(String(p.id)));

                                                    return (
                                                        <FormItem className="flex items-center justify-between rounded-xl border bg-background p-3">
                                                            <div className="space-y-0.5">
                                                                <FormLabel htmlFor="select-all-projects" className="text-sm font-bold cursor-pointer">
                                                                    Select All Projects
                                                                </FormLabel>
                                                                <p className="text-[10px] text-muted-foreground">
                                                                    Grant access to every project listed in the Master Registry.
                                                                </p>
                                                            </div>
                                                            <FormControl>
                                                                <Checkbox
                                                                    id="select-all-projects"
                                                                    checked={allSelected}
                                                                    onCheckedChange={(checked) => {
                                                                        field.onChange(checked ? permittedProjects.map(p => String(p.id)) : []);
                                                                    }}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    );
                                                }}
                                            />
                                        )}
                                        <div className="bg-background border rounded-xl p-4 max-h-48 overflow-y-auto custom-scrollbar grid sm:grid-cols-2 gap-3">
                                            {permittedProjects.map((firm) => (
                                                <FormField
                                                    key={firm.id}
                                                    control={form.control}
                                                    name="firm_access"
                                                    render={({ field }) => {
                                                        const values = (field.value || []).map((v) => String(v).trim()).filter(Boolean);
                                                        const firmIdStr = String(firm.id);
                                                        const checked = values.includes(firmIdStr) || values.includes(firm.name); // Support both for transition

                                                        return (
                                                            <FormItem className="flex items-center space-x-2 space-y-0 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                                                <FormControl>
                                                                    <Checkbox
                                                                        id={`firm-access-${firm.id}`}
                                                                        checked={checked}
                                                                        onCheckedChange={(isChecked) => {
                                                                            field.onChange(
                                                                                isChecked
                                                                                    ? Array.from(new Set([...values.filter(v => v !== firm.name), firmIdStr])) // Prefer ID when selecting
                                                                                    : values.filter((v) => v !== firmIdStr && v !== firm.name)
                                                                            );
                                                                        }}
                                                                    />
                                                                </FormControl>
                                                                <FormLabel htmlFor={`firm-access-${firm.id}`} className="text-sm font-medium leading-none cursor-pointer select-none">
                                                                    {firm.name}
                                                                </FormLabel>
                                                            </FormItem>
                                                        );
                                                    }}
                                                />
                                            ))}
                                            {permittedProjects.length === 0 && (
                                                <p className="text-sm text-muted-foreground italic col-span-2 text-center py-4">No projects found in Master Registry</p>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground pl-1 italic">
                                            * Project access is controlled by selected firm IDs. Administrator with 'All' still has full access.
                                        </p>
                                    </div>

                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 px-1">
                                        <Shield size={18} className="text-primary" />
                                        <h3 className="font-semibold text-lg">Detailed Permissions Control</h3>
                                    </div>
                                    <Separator className="bg-primary/10" />
                                    
                                    <div className="grid gap-6">
                                        <div className="flex items-center justify-between bg-muted/40 p-4 rounded-xl border border-primary/10">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                                    <CheckSquare size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold">Quick Select</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Toggle All Access</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-lg border shadow-sm">
                                                <Checkbox
                                                    id="select-all"
                                                    checked={form.watch('permissions')?.length === allPermissionKeys.length}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            form.setValue('permissions', [...allPermissionKeys]);
                                                        } else {
                                                            form.setValue('permissions', []);
                                                        }
                                                    }}
                                                />
                                                <label htmlFor="select-all" className="text-xs font-bold cursor-pointer select-none">
                                                    Select All Permissions
                                                </label>
                                            </div>
                                        </div>

                                        <div className="bg-muted/10 rounded-2xl border border-border/50 p-6">
                                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                                                {allPermissionKeys.map((perm) => (
                                                    <FormField
                                                        key={perm}
                                                        control={form.control}
                                                        name="permissions"
                                                        render={({ field }) => (
                                                            <FormItem className="flex items-center space-x-3 space-y-0 p-2 rounded-xl hover:bg-muted/50 transition-all group border border-transparent hover:border-primary/10">
                                                                <FormControl>
                                                                    <Checkbox
                                                                        id={perm}
                                                                        className="h-5 w-5 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-transform group-active:scale-90"
                                                                        checked={field.value?.includes(perm)}
                                                                        onCheckedChange={(checked) => {
                                                                            const values = field.value || [];
                                                                            checked
                                                                                ? field.onChange([...values, perm])
                                                                                : field.onChange(values.filter((p) => p !== perm));
                                                                        }}
                                                                    />
                                                                </FormControl>
                                                                <FormLabel
                                                                    className="text-sm font-medium leading-none cursor-pointer select-none py-1 flex-1 group-hover:text-primary transition-colors"
                                                                    htmlFor={perm}
                                                                >
                                                                    {permissionLabels[perm] || camelToTitleCase(perm)}
                                                                </FormLabel>
                                                            </FormItem>
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="p-6 md:p-8 bg-muted/50 border-t items-center gap-3">
                                <DialogClose asChild>
                                    <Button variant="ghost" className="px-6">Cancel</Button>
                                </DialogClose>

                                <Button 
                                    type="submit" 
                                    className="px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 transition-all active:scale-95"
                                    disabled={form.formState.isSubmitting}
                                >
                                    {form.formState.isSubmitting ? (
                                        <div className="flex items-center gap-2">
                                            <Loader size={16} color="currentColor" />
                                            <span>Processing...</span>
                                        </div>
                                    ) : (
                                        selectedUser ? 'Save Changes' : 'Create User Profile'
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
};
