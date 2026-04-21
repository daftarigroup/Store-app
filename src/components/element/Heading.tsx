import type { ReactNode } from 'react';
import { SidebarTrigger } from '../ui/sidebar';
import { TabsList, TabsTrigger } from '../ui/tabs';

interface HeaderProps {
    children: ReactNode;
    heading: string;
    subtext: string;
    tabs?: boolean;
    pendingCount?: number;
    historyCount?: number;
    returnCount?: number;
    pendingLabel?: string;
    historyLabel?: string;
    returnLabel?: string;
    directLabel?: string;
    pendingValue?: string;
    historyValue?: string;
    returnValue?: string;
    directValue?: string;
    directCount?: number;
    action?: ReactNode;
}

export default ({
    children,
    heading,
    subtext,
    tabs = false,
    pendingCount,
    historyCount,
    returnCount,
    pendingLabel = 'Pending',
    historyLabel = 'History',
    returnLabel,
    pendingValue = 'pending',
    historyValue = 'history',
    returnValue,
    directValue,
    directCount,
    directLabel = 'Direct',
    action,
}: HeaderProps) => {
    return (
        <div className="bg-gradient-to-br from-blue-100 via-purple-50 to-blue-50 w-full">
            <div className="flex justify-between p-5">
                <div className="flex gap-2 items-center">
                    {children}
                    <div>
                        <h1 className="text-2xl font-bold text-primary">{heading}</h1>
                        <p className="text-muted-foreground text-sm">{subtext}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {action}
                    <SidebarTrigger />
                </div>
            </div>
            {tabs && (
                <TabsList className="w-full rounded-none bg-transparent rounded-b-md">
                    <TabsTrigger value={pendingValue} className="flex gap-2">
                        {pendingLabel} {pendingCount !== undefined && <span>({pendingCount})</span>}
                    </TabsTrigger>
                    {returnValue && (
                        <TabsTrigger value={returnValue} className="flex gap-2">
                            {returnLabel || 'Return'} {returnCount !== undefined && <span>({returnCount})</span>}
                        </TabsTrigger>
                    )}
                    <TabsTrigger value={historyValue} className="flex gap-2">
                        {historyLabel} {historyCount !== undefined && <span>({historyCount})</span>}
                    </TabsTrigger>
                    {directValue && (
                        <TabsTrigger value={directValue} className="flex gap-2">
                            {directLabel} {directCount !== undefined && <span>({directCount})</span>}
                        </TabsTrigger>
                    )}
                </TabsList>
            )}
        </div>
    );
};
