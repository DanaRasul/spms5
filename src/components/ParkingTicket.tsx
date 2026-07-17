'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/LangContext';
import type { VehicleRecord } from '@/lib/types';

interface ParkingTicketProps {
  vehicle: VehicleRecord;
  locationName: string;
  locationAddress?: string;
  locationPhone?: string;
  onClose: () => void;
}

/**
 * Displays a printable / downloadable Parking Ticket immediately after a
 * successful vehicle registration. The QR code encodes a URL pointing at the
 * public parking-status page (`/status/[token]`) so that scanning it with any
 * smartphone camera opens that page directly.
 */
export default function ParkingTicket({ vehicle, locationName, locationAddress, locationPhone, onClose }: ParkingTicketProps) {
  const { t, dir } = useLang();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  const statusUrl = typeof window !== 'undefined' && vehicle.qrToken
    ? `${window.location.origin}/status/${vehicle.qrToken}`
    : '';

  useEffect(() => {
    let cancelled = false;
    if (!vehicle.qrToken) return;

    (async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const dataUrl = await QRCode.toDataURL(statusUrl, {
          width: 220,
          margin: 1,
          color: { dark: '#1f2937', light: '#ffffff' },
        });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setQrError(true);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.qrToken]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!ticketRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(ticketRef.current, { backgroundColor: '#ffffff', scale: 2 });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `ticket_${vehicle.plateNumber}_${vehicle.entryDate}.png`;
      a.click();
    } catch {
      // If canvas capture fails for any reason, fall back to printing.
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  const shortId = vehicle.id ? vehicle.id.slice(-8).toUpperCase() : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:bg-white print:p-0" id="spms-ticket-overlay">
      <div
        ref={ticketRef}
        dir={dir}
        id="spms-ticket-print-area"
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden print:rounded-none print:shadow-none print:max-w-full"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-4 flex items-center gap-3">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="20" height="20" rx="4" stroke="white" strokeWidth="1.6" />
            <path d="M8 7h4.2a2.8 2.8 0 0 1 0 5.6H8V17" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <p className="font-bold leading-tight">{t('parkingTicket')}</p>
            <p className="text-xs text-blue-100 leading-tight">{locationName}</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-gray-400">{t('plateNumber')}</p>
            <p className="text-3xl font-extrabold text-gray-800 tracking-wider">{vehicle.plateNumber}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-2.5">
              <p className="text-[11px] text-gray-400">{t('parkingSpace')}</p>
              <p className="font-semibold text-gray-800">{vehicle.parkingSpaceNumber}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <p className="text-[11px] text-gray-400">{t('ticketId')}</p>
              <p className="font-semibold text-gray-800">{shortId}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <p className="text-[11px] text-gray-400">{t('entryDate')}</p>
              <p className="font-semibold text-gray-800">{vehicle.entryDate}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <p className="text-[11px] text-gray-400">{t('entryTime')}</p>
              <p className="font-semibold text-gray-800">{vehicle.entryTime}</p>
            </div>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-dashed border-gray-200">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="QR" width={160} height={160} className="rounded-lg" />
            ) : qrError ? (
              <p className="text-xs text-red-500">{t('errorGeneral')}</p>
            ) : (
              <div className="w-40 h-40 bg-gray-100 rounded-lg animate-pulse" />
            )}
            <p className="text-[11px] text-gray-400 text-center max-w-[220px]">{t('scanQrHint')}</p>
          </div>

          {(locationAddress || locationPhone) && (
            <div className="text-center text-[11px] text-gray-400 pt-1">
              {locationAddress && <p>{locationAddress}</p>}
              {locationPhone && <p>{locationPhone}</p>}
            </div>
          )}
        </div>

        {/* Actions (hidden on print) */}
        <div className="px-6 pb-5 flex gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
          >
            {t('print')}
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-60 text-gray-700 text-sm font-semibold py-2.5 rounded-lg transition-colors"
          >
            {downloading ? t('loading') : t('download')}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-lg transition-colors"
          >
            {t('close')}
          </button>
        </div>
      </div>

      {/* Print isolation: only the ticket is visible when printing */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #spms-ticket-print-area,
          #spms-ticket-print-area * {
            visibility: visible;
          }
          #spms-ticket-overlay {
            position: fixed;
            inset: 0;
            background: white !important;
          }
          #spms-ticket-print-area {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            margin: 0 auto;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}
