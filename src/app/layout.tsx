import React from 'react';
import type { Metadata, Viewport } from 'next';
import '../styles/index.css';
import { SPMSProvider } from '@/lib/SPMSContext';
import { LangProvider } from '@/lib/LangContext';
import SessionProviderWrapper from '@/components/SessionProviderWrapper';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Smart Parking Management System',
  description: 'SPMS - Cloud-based Smart Parking Management System',
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SessionProviderWrapper>
          <LangProvider>
            <SPMSProvider>
              {children}
            </SPMSProvider>
          </LangProvider>
        </SessionProviderWrapper>
</body>
    </html>
  );
}
