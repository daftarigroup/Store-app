import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import Sidebar from '@/components/element/Sidebar';
import { Outlet } from 'react-router-dom';
import type { RouteAttributes } from './types';
import ViewOnlyGuard from '@/components/element/ViewOnlyGuard';

export default ({ routes }: { routes: RouteAttributes[] }) => {
    return (
        <div className="flex w-full h-screen">
                <SidebarProvider>
                    <Sidebar items={routes} />
                    <SidebarInset>
                        
                        <main className="flex-1 overflow-y-auto overflow-x-hidden rounded-md min-w-0">
                            <div className="h-full">
                                <ViewOnlyGuard>
                                    <Outlet />
                                </ViewOnlyGuard>
                            </div>
                        </main>
                    </SidebarInset>
                </SidebarProvider>
        </div>
    );
};
