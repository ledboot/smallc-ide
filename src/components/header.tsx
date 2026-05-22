import React from 'react';
import Link from 'next/link';
import {BookOpen} from 'lucide-react';
import WalletConnect from '@/components/walletConnect';

export default function Header() {
  return (
    <header className="flex h-14 items-center border-b px-4 lg:px-6 bg-background">
      <h1 className="text-lg font-semibold">SmallC IDE Web</h1>
      <div className="ml-auto flex items-center gap-4">
        <Link
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <BookOpen className="h-4 w-4" />
          <span>API Docs</span>
        </Link>
        <WalletConnect />
      </div>
    </header>
  );
}
