"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { FolderPlus, Trash2, X } from "lucide-react";
import { GroupSelectionDialog } from "@/components/media/GroupSelectionDialog";

interface SelectionContextType {
  isSelectionMode: boolean;
  selectedIds: string[];
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

export function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error("useSelection must be used within a SelectionProvider");
  }
  return context;
}

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Automatically exit selection mode when selection is cleared
  useEffect(() => {
    if (selectedIds.length === 0) {
      setIsSelectionMode(false);
    } else {
      setIsSelectionMode(true);
    }
  }, [selectedIds]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const enterSelectionMode = () => {
    setIsSelectionMode(true);
  };

  const exitSelectionMode = () => {
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  return (
    <SelectionContext.Provider
      value={{
        isSelectionMode,
        selectedIds,
        toggleSelect,
        clearSelection,
        enterSelectionMode,
        exitSelectionMode,
      }}
    >
      {children}

      {/* Floating Selection Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between gap-4 px-6 py-4 rounded-2xl bg-black/90 border border-white/10 backdrop-blur-md shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white font-mono">
                {selectedIds.length}
              </span>
              <p className="text-xs font-semibold text-white/90">
                Item{selectedIds.length !== 1 ? "s" : ""} selected
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsDialogOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary text-white rounded-lg text-xs font-bold hover:bg-brand-primary/95 transition-all cursor-pointer"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Group
              </button>
              <button
                onClick={clearSelection}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 border border-white/10 text-white hover:bg-white/20 rounded-lg text-xs font-medium transition-all cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
              <button
                onClick={exitSelectionMode}
                className="p-1.5 rounded-full hover:bg-white/15 text-white/60 hover:text-white cursor-pointer"
                title="Cancel selection mode"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grouping configuration dialog */}
      <GroupSelectionDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        selectedIds={selectedIds}
        onSuccess={exitSelectionMode}
      />
    </SelectionContext.Provider>
  );
}
