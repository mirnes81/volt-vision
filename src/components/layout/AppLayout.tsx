import * as React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { DesktopSidebar } from './DesktopSidebar';
import { UrgentNotificationToast } from '@/components/notifications/UrgentNotificationToast';
import { useWorkerLocationTracking } from '@/hooks/useWorkerLocationTracking';

export function AppLayout() {
  // Start location tracking when user is logged in
  useWorkerLocationTracking();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col max-w-full lg:max-w-none">
        {/* Mobile: max-w-lg centered, Desktop: full width */}
        <main className="flex-1 pb-20 lg:pb-4 w-full max-w-lg mx-auto lg:max-w-none">
          <Outlet />
        </main>
        
        {/* Mobile Bottom Nav */}
        <div className="lg:hidden">
          <BottomNav />
        </div>
      </div>

      {/* Urgent Notifications Toast */}
      <UrgentNotificationToast />
    </div>
  );
}
