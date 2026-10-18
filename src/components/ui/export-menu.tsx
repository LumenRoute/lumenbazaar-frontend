import { Download, ChevronDown } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export type ExportMenuProps = {
  onExportJSON: () => void;
  onExportCSV: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  tooltipLabel?: string;
};

/**
 * Export menu with dropdown options for JSON and CSV formats.
 * Provides accessible keyboard navigation and clear labels.
 */
export function ExportMenu({
  onExportJSON,
  onExportCSV,
  disabled = false,
  isLoading = false,
  tooltipLabel = "Export this page as"
}: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = (e: React.MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleExportJSON = () => {
    onExportJSON();
    setIsOpen(false);
  };

  const handleExportCSV = () => {
    onExportCSV();
    setIsOpen(false);
  };

  return (
    <div
      className="relative inline-block"
      ref={menuRef}
      onClick={handleClickOutside}
      onKeyDown={handleKeyDown}
    >
      <Button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isLoading}
        variant="secondary"
        size="sm"
        aria-label={tooltipLabel}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Export
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </Button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-48 rounded-md border border-slate-200 bg-white shadow-lg z-10"
          role="menu"
          aria-orientation="vertical"
        >
          <button
            onClick={handleExportJSON}
            disabled={disabled || isLoading}
            className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed first:rounded-t-md"
            role="menuitem"
            aria-label="Export as JSON"
          >
            <span className="font-medium">Export as JSON</span>
            <p className="text-xs text-slate-500 mt-1">Structured data format</p>
          </button>
          <div className="border-t border-slate-100" />
          <button
            onClick={handleExportCSV}
            disabled={disabled || isLoading}
            className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed last:rounded-b-md"
            role="menuitem"
            aria-label="Export as CSV"
          >
            <span className="font-medium">Export as CSV</span>
            <p className="text-xs text-slate-500 mt-1">Spreadsheet format</p>
          </button>
        </div>
      )}
    </div>
  );
}
