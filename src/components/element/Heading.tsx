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
    pendingLabel?: string;
    historyLabel?: string;
}

export default ({
    children,
    heading,
    subtext,
    tabs = false,
    pendingCount,
    historyCount,
    pendingLabel = 'Pending',
    historyLabel = 'History',
}: HeaderProps) => {
    return (
        <div className="bg-gradient-to-br from-blue-100 via-purple-50 to-blue-50 rounded-md">
            <div className="flex justify-between p-5">
                <div className="flex gap-2 items-center">
                    {children}
                    <div>
                        <h1 className="text-2xl font-bold text-primary">{heading}</h1>
                        <p className="text-muted-foreground text-sm">{subtext}</p>
                    </div>
                </div>
                <SidebarTrigger />
            </div>
            {tabs && (
                <TabsList className="w-full rounded-none bg-transparent rounded-b-md">
                    <TabsTrigger value="pending" className="flex gap-2">
                        {pendingLabel} {pendingCount !== undefined && <span>({pendingCount})</span>}
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex gap-2">
                        {historyLabel} {historyCount !== undefined && <span>({historyCount})</span>}
                    </TabsTrigger>
                </TabsList>
            )}
        </div>
    );
};
