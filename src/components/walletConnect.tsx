'use client';

import {useEffect, useState} from 'react';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {useWalletStore} from '@/state/useWallet';
import {toast} from 'sonner';
import {WalletIcon, LogOutIcon, Loader2Icon} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import type {ZentNetwork} from '@/types/zent.d';
import Image from 'next/image';

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
    networks,
    init,
    connect,
    disconnect,
    switchNetwork,
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

  const handleSwitchNetwork = async (chainId: string) => {
    setIsLoading(true);
    try {
      await switchNetwork(parseInt(chainId));
      toast.success('Switched network successfully');
    } catch (e: any) {
      toast.error(`Switch network failed: ${e.message}`);
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
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/10">
          <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
          <span className="text-xs font-mono font-bold tracking-tight text-foreground/80">
            {shortAddress(currentAccount)}
          </span>

          {network && (
            <Select
              value={network.chainId.toString()}
              onValueChange={handleSwitchNetwork}
              disabled={isLoading}
            >
              <SelectTrigger className="h-6 border-none bg-transparent hover:bg-transparent p-0 gap-1 focus:ring-0 shadow-none">
                <Badge
                  variant="outline"
                  className="text-[10px] h-5 px-2 font-black tracking-tight border-muted-foreground/15 bg-background/50 hover:bg-background transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {network.icon && (
                    <Image
                      src={network.icon}
                      alt=""
                      className="w-3 h-3 rounded-full"
                      onError={e => (e.currentTarget.style.display = 'none')}
                    />
                  )}
                  {network.name ?? network.id}
                </Badge>
              </SelectTrigger>
              <SelectContent align="end" className="p-1 min-w-35">
                {networks.map((net: ZentNetwork) => (
                  <SelectItem
                    key={net.chainId}
                    value={net.chainId.toString()}
                    className="text-xs font-semibold py-2"
                  >
                    <div className="flex items-center gap-2">
                      {net.icon && (
                        <Image
                          src={net.icon}
                          alt=""
                          className="w-4 h-4 rounded-full"
                          onError={e =>
                            (e.currentTarget.style.display = 'none')
                          }
                        />
                      )}
                      {net.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
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
      className="h-9 gap-2 font-bold tracking-tight border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all active:scale-95 shadow-sm"
      onClick={handleConnect}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2Icon className="h-4 w-4 animate-spin" />
      ) : (
        <WalletIcon className="h-4 w-4 text-primary" />
      )}
      Connect Wallet
    </Button>
  );
}
