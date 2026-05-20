'use client';

import {useEffect, useState} from 'react';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {useWalletStore} from '@/state/useWallet';
import {useNodeStore} from '@/state/useNodeStore';
import {toast} from 'sonner';
import {WalletIcon, LogOutIcon, Loader2Icon} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import type {ZentNetwork} from '@/types/zent.d';

/**
 * WalletConnect — shows extension status, connect/disconnect, and dynamic RPC node lease.
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

  const {leasedNode, isLeasing, timeRemaining, leaseNode, releaseNode} =
    useNodeStore();

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Connected
  if (isConnected && currentAccount) {
    return (
      <div className="flex items-center gap-2">
        {/* Leased RPC Node controls */}
        {leasedNode ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black tracking-tight shadow-[0_0_12px_rgba(16,185,129,0.08)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span>
              RPC: {leasedNode.name} [{formatTime(timeRemaining)}]
            </span>
            <button
              onClick={releaseNode}
              className="ml-1 font-bold text-emerald-400/60 hover:text-emerald-300 transition-colors"
              title="Release dedicated node"
            >
              ✕
            </button>
          </div>
        ) : (
          <Button
            onClick={() => leaseNode()}
            disabled={isLeasing}
            variant="outline"
            className="h-[30px] px-3 gap-1 bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40 text-amber-500 hover:text-amber-400 text-[10px] font-bold tracking-tight rounded-xl transition-all shadow-[0_0_8px_rgba(245,158,11,0.02)] active:scale-95 flex items-center"
          >
            {isLeasing ? (
              <Loader2Icon className="h-3 w-3 animate-spin text-amber-500" />
            ) : (
              <span className="text-amber-500">⚡</span>
            )}
            <span>{isLeasing ? 'Leasing...' : 'Lease RPC Node'}</span>
          </Button>
        )}

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
                    <img
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
                        <img
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
      className="relative h-10 px-4 gap-2 overflow-hidden border-primary/20 text-xs font-bold tracking-tight shadow-sm transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-95 rounded-xl group"
      onClick={handleConnect}
      disabled={isLoading}
    >
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/10 to-transparent group-hover:animate-shimmer pointer-events-none" />
      {isLoading ? (
        <Loader2Icon className="h-4 w-4 animate-spin" />
      ) : (
        <WalletIcon className="h-4 w-4 text-primary transition-transform group-hover:scale-110" />
      )}
      <span className="relative z-10">Connect Wallet</span>
    </Button>
  );
}
