'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/LangContext';
import type { VehicleRecord } from '@/lib/types';

interface ParkingReceiptProps {
  vehicle: VehicleRecord;
  locationName: string;
  locationAddress?: string;
  locationPhone?: string;
  companyLogo?: string | null;
  companyWebsite?: string | null;
  currency?: string;
  onClose: () => void;
}

/**
 * Professional parking receipt: shown immediately after a successful exit
 * (CurrentVehicles.tsx) and re-viewable later from Parking History
 * (ParkingHistory.tsx) using the record's own permanently-stored
 * receiptNumber/receiptGeneratedAt/fee/duration/qrToken — so old receipts
 * remain printable exactly as they were at exit time.
 */
export default function ParkingReceipt({
  vehicle, locationName, locationAddress, locationPhone, companyLogo, companyWebsite, currency = 'IQD', onClose,
}: ParkingReceiptProps) {
  const { t, dir } = useLang();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Legacy fallback for completed records that exited before this feature
  // existed (no persisted receiptNumber) — display-only, never written to DB.
  const receiptNumber = vehicle.receiptNumber || `LEGACY-${vehicle.id.slice(-8).toUpperCase()}`;
  const generatedAt = vehicle.receiptGeneratedAt ? new Date(vehicle.receiptGeneratedAt) : new Date();

  const statusUrl = typeof window !== 'undefined' && vehicle.qrToken
    ? `${window.location.origin}/status/${vehicle.qrToken}`
    : '';

  useEffect(() => {
    let cancelled = false;
    if (!vehicle.qrToken) return;
    (async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const dataUrl = await QRCode.toDataURL(statusUrl, { width: 140, margin: 1, color: { dark: '#1f2937', light: '#ffffff' } });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        // Non-fatal: receipt still works without the QR image.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.qrToken]);

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    if (!receiptRef.current) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(receiptRef.current, { backgroundColor: '#ffffff', scale: 2 });
      const imgData = canvas.toDataURL('image/png');

      // A4 in mm, with proper 15mm margins on all sides.
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      const usableWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * usableWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', margin, margin, usableWidth, imgHeight);
      pdf.save(`receipt_${vehicle.plateNumber}_${receiptNumber}.pdf`);
    } catch {
      window.print();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:bg-white print:p-0" id="spms-receipt-overlay">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden print:rounded-none print:shadow-none print:max-w-full print:max-h-none">
        <div className="overflow-y-auto flex-1">
          <div
            ref={receiptRef}
            dir={dir}
            id="spms-receipt-print-area"
            className="bg-white px-8 py-7"
          >
            {/* Header: logo + parking info */}
            <div className="flex items-center gap-3 border-b border-gray-200 pb-4 mb-4">
              {companyLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={companyLogo} alt="" className="w-14 h-14 rounded-lg object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-blue-50 flex items-center justify-center text-2xl">🅿️</div>
              )}
              <div>
                <p className="font-extrabold text-lg text-gray-800">{locationName}</p>
                {locationAddress && <p className="text-xs text-gray-500">{locationAddress}</p>}
                {locationPhone && <p className="text-xs text-gray-500">{locationPhone}</p>}
              </div>
            </div>

            <div className="text-center mb-5">
              <p className="text-sm font-semibold tracking-widest text-gray-400 uppercase">{t('parkingReceipt')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('receiptNumber')}: <span className="font-mono font-semibold text-gray-600">{receiptNumber}</span></p>
              <p className="text-[11px] text-gray-400">
                {t('generatedDate')}: {generatedAt.toLocaleDateString()} · {t('generatedTime')}: {generatedAt.toLocaleTimeString()}
              </p>
            </div>

            {/* Vehicle + visit details */}
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <ReceiptRow label={t('plateNumber')} value={vehicle.plateNumber} bold />
              <ReceiptRow label={t('parkingSpace')} value={vehicle.parkingSpaceNumber} />
              {vehicle.vehicleType && <ReceiptRow label={t('vehicleType')} value={vehicle.vehicleType} />}
              <ReceiptRow label={t('entryDate')} value={vehicle.entryDate} />
              <ReceiptRow label={t('entryTime')} value={vehicle.entryTime} />
              <ReceiptRow label={t('exitDate')} value={vehicle.exitDate || '-'} />
              <ReceiptRow label={t('exitTime')} value={vehicle.exitTime || '-'} />
              <ReceiptRow label={t('duration')} value={vehicle.duration || '-'} />
            </div>

            {/* Fee */}
            <div className="bg-green-50 rounded-lg px-4 py-3 flex items-center justify-between mb-5">
              <span className="text-sm font-semibold text-green-700">{t('parkingFee')}</span>
              <span className="text-xl font-extrabold text-green-700">
                {(vehicle.fee ?? 0).toLocaleString()} {currency}
              </span>
            </div>

            {/* QR */}
            {qrDataUrl && (
              <div className="flex flex-col items-center gap-1 border-t border-dashed border-gray-200 pt-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR" width={110} height={110} />
                <p className="text-[10px] text-gray-400">{t('scanQrHint')}</p>
              </div>
            )}

            <p className="text-center text-[11px] text-gray-400 mt-5">
              {t('thankYouVisit')}{companyWebsite ? ` · ${companyWebsite}` : ''}
            </p>
          </div>
        </div>

        {/* Actions (hidden on print) */}
        <div className="px-8 pb-6 pt-2 flex gap-2 print:hidden flex-shrink-0">
          <button onClick={handlePrint} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
            {t('print')}
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={exporting}
            className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-60 text-gray-700 text-sm font-semibold py-2.5 rounded-lg transition-colors"
          >
            {exporting ? t('loading') : t('downloadPdf')}
          </button>
          <button onClick={onClose} className="flex-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-lg transition-colors">
            {t('close')}
          </button>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #spms-receipt-print-area, #spms-receipt-print-area * { visibility: visible; }
          #spms-receipt-overlay { position: fixed; inset: 0; background: white !important; }
          #spms-receipt-print-area {
            position: fixed; top: 0; left: 0; right: 0; margin: 0 auto; box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function ReceiptRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className={`text-gray-800 ${bold ? 'font-bold' : 'font-medium'}`}>{value}</p>
    </div>
  );
}
