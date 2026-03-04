import React from 'react';
import WalletConnect from '@/components/walletConnect';

export default function Header() {
  return (
    <header className="flex h-14 items-center border-b px-4 lg:px-6">
      <h1 className="text-lg font-semibold">SmallC IDE Web</h1>
      <div className="ml-auto flex items-center gap-2">
        <WalletConnect />
      </div>
    </header>
  );
}
