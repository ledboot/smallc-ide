'use client';

import {useEffect} from 'react';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {
  WalletIcon,
  LogOutIcon,
  AlertCircleIcon,
  Loader2Icon,
} from 'lucide-react';
import {useState} from 'react';
import {useWalletStore} from '@/state/useWallet';
import {toast} from 'sonner';

/**
 * WalletConnect — shows extension status, connect/disconnect.
 * Place this anywhere in the UI (e.g. top of DeployPanel).
 */
export default function WalletConnect() {
  const {
    isExtensionAvailable,
    isConnected,
    currentAccount,
    network,
    init,
    connect,
    disconnect,
  } = useWalletStore();
  const [isLoading, setIsLoading] = useState(false);

  // Initialise once on mount — detects extension & syncs state
  useEffect(() => {
    init();
  }, [init]);

  const handleConnect = async () => {
    if (!isExtensionAvailable) {
      toast.error('Zent Wallet extension not detected');
      return;
    }
    setIsLoading(true);
    try {
      await connect();
    } catch (e) {
      console.error('[WalletConnect] connect error', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await disconnect();
    } finally {
      setIsLoading(false);
    }
  };

  const shortAddress = (addr: string) =>
    `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  // Connected
  if (isConnected && currentAccount) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/15">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-mono font-semibold">
            {shortAddress(currentAccount)}
          </span>
          {network && (
            <Badge
              variant="outline"
              className="text-[9px] h-4 font-black tracking-tighter border-muted-foreground/20"
            >
              {network.name ?? network.id}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={handleDisconnect}
          disabled={isLoading}
          title="Disconnect wallet"
        >
          {isLoading ? (
            <Loader2Icon className="h-4 w-4 animate-spin" />
          ) : (
            <LogOutIcon className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  // Not connected yet
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 gap-2 font-semibold border-primary/30 hover:border-primary/60 hover:bg-primary/5"
      onClick={handleConnect}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2Icon className="h-4 w-4 animate-spin" />
      ) : (
        <WalletIcon className="h-4 w-4" />
      )}
      Connect Wallet
    </Button>
  );
}
