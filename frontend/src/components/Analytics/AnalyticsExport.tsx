import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';

// Export functionality temporarily disabled to resolve JavaScript initialization errors

interface AnalyticsExportProps {
  data: Record<string, unknown>[];
  title?: string;
}

export const AnalyticsExport: React.FC<AnalyticsExportProps> = ({
  data: _data,
  title: _title
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const exportToExcel = () => {
    // Temporarily disabled - xlsx library causing initialization errors
    alert('Excel export temporarily unavailable');
    setMenuOpen(false);
  };

  const exportToPDF = (_chartRef?: React.RefObject<HTMLDivElement>) => {
    // Temporarily disabled - html-to-image library causing initialization errors  
    alert('PDF export temporarily unavailable');
    setMenuOpen(false);
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        <Download className="w-4 h-4" />
        Export
      </button>
      
      {menuOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-50">
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 w-full px-4 py-2 hover:bg-gray-100"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-500" />
            Export to Excel
          </button>
          <button
            onClick={() => exportToPDF()}
            className="flex items-center gap-2 w-full px-4 py-2 hover:bg-gray-100"
          >
            <FileText className="w-4 h-4 text-red-500" />
            Export to PDF
          </button>
        </div>
      )}
    </div>
  );
};