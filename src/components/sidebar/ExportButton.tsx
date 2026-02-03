import { useState } from "react";
import type { CalendarEvent } from "@/types/calendar";
import { downloadICS, copyICSToClipboard } from "@/lib/utils/icsExport";
import { Calendar, Check, Copy, Download } from "lucide-react";

interface ExportButtonProps {
  events: CalendarEvent[];
  selectedCount: number;
}

export function ExportButton({ events, selectedCount }: ExportButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    downloadICS(events);
    setShowMenu(false);
  };

  const handleCopy = async () => {
    const success = await copyICSToClipboard(events);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    setShowMenu(false);
  };

  if (selectedCount === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition hover:border-black hover:text-black"
        aria-label="Export calendar"
        aria-expanded={showMenu}
      >
        <Calendar className="h-3.5 w-3.5" />
        Export
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-black bg-white p-1 shadow-lg">
            <button
              type="button"
              onClick={handleDownload}
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-100"
            >
              <Download className="h-3.5 w-3.5" />
              Download .ics file
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-100"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy to clipboard
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
