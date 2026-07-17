'use client';
import React, { useState } from 'react';
import { useSPMS } from '@/lib/SPMSContext';
import LoginPage from '@/components/LoginPage';
import AppShell from '@/components/AppShell';

export default function Home() {
  const { currentUser } = useSPMS();
  return currentUser ? <AppShell /> : <LoginPage />;
}
