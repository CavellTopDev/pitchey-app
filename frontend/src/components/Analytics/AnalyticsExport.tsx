import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import * as htmlToImage from 'html-to-image';

interface AnalyticsExportProps {
  data: any[];
  title: string;
}

export const AnalyticsExport: React.FC<AnalyticsExportProps> = ({ 
  data, 
  title 
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Analytics');
    XLSX.writeFile(workbook, `${title.replace(/\s+/g, '_')}_analytics.xlsx`);
    setMenuOpen(false);
  };

  const exportToPDF = async (chartRef: React.RefObject<HTMLDivElement>) => {
    if (chartRef.current) {
      const dataUrl = await htmlToImage.toPng(chartRef.current);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${title.replace(/\s+/g, '_')}_analytics.png`;
      link.click();
      setMenuOpen(false);
    }
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
            onClick={() => exportToPDF}
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