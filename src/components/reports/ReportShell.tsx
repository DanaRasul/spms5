'use client';
import React, { useRef, useState } from 'react';
import { useSPMS } from '@/lib/SPMSContext';
import { useLang } from '@/lib/LangContext';
import { exportElementToPdf } from '@/lib/reportPdf';

interface ReportShellProps {
  title: string;
  subtitle?: string;
  filename?: string;
  /** Extra buttons (e.g. Export CSV) shown before Print/Download PDF. */
  actions?: React.ReactNode;
  /** Summary stat cards, rendered inside the printable area, above children. */
  summary?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Wraps a report's content with a professional printable header (parking
 * logo/name/address/phone/website, report title, generated date/time/by) and
 * gives it working Print + Download PDF buttons. The print stylesheet hides
 * everything on the page (sidebar, top bar, filters, buttons) except this
 * shell's content, so printing/exporting always shows only the report.
 */
export default function ReportShell({ title, subtitle, filename, actions, summary, children }: ReportShellProps) {
  const { settings, currentUser } = useSPMS();
  const { t, dir } = useLang();
  const [exporting, setExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const generatedAt = useRef(new Date()).current;

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    setExporting(true);
    try {
      await exportElementToPdf(printRef.current, filename || 'report');
    } catch {
      window.print();
    } finally {
      setExporting(false);
    }
  };

  const contactLine = [settings.address, settings.phoneNumber, settings.companyWebsite].filter(Boolean).join('  ·  ');

  return (
    <div>
      {/* Toolbar (never printed) */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {actions}
          <button onClick={handlePrint} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors">
            {t('print')}
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={exporting}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {exporting ? t('loading') : t('downloadPdf')}
          </button>
        </div>
      </div>

      {/* Printable / exportable report body */}
      <div ref={printRef} id="spms-report-print-area" dir={dir} className="bg-white rounded-xl print:rounded-none">
        <div className="flex items-center gap-3 border-b border-gray-200 px-1 pb-4 mb-4">
          {settings.companyLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.companyLogo} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-xl flex-shrink-0">🅿️</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-gray-800 truncate">{settings.parkingName || 'SPMS'}</p>
            {contactLine && <p className="text-xs text-gray-500 truncate">{contactLine}</p>}
          </div>
          <div className="text-end text-[11px] text-gray-400 flex-shrink-0">
            <p>{t('generatedDate')}: {generatedAt.toLocaleDateString()}</p>
            <p>{t('generatedTime')}: {generatedAt.toLocaleTimeString()}</p>
            <p>{t('generatedBy')}: {currentUser?.fullName || currentUser?.username || '-'}</p>
          </div>
        </div>

        <h2 className="text-lg font-bold text-gray-800 px-1 mb-4">{title}</h2>

        {summary && <div className="px-1 mb-5">{summary}</div>}

        <div className="px-1">{children}</div>

        <p className="report-page-footer text-center text-[10px] text-gray-300 mt-6 pt-3 border-t border-gray-100">SPMS</p>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #spms-report-print-area, #spms-report-print-area * { visibility: visible; }
          #spms-report-print-area {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }
          @page {
            size: A4;
            margin: 15mm;
          }
        }
      `}</style>
    </div>
  );
}
