"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { SelectionProvider } from "@/providers/SelectionProvider";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <SelectionProvider>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
        {/* Sidebar Navigation */}
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {/* Main Content Area */}
        <div className="flex flex-col min-h-screen md:pl-64">
          {/* Top Navigation */}
          <TopBar onOpenSidebar={() => setIsSidebarOpen(true)} />

          {/* Content Container */}
          <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </SelectionProvider>
  );
}
