import { NetworkType } from "@/constants";

export type ChainInfo = {
  label: string;
  iconLabel: string;
  chainId: number;
  endpoints: string[];
  icon: string;
  unit: string;
  networkType: NetworkType;
};