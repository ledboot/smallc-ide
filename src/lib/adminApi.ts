/**
 * adminApi.ts
 *
 * HTTP client for zent-admin-api public endpoints.
 * Base URL is configured via NEXT_PUBLIC_ADMIN_API_URL (defaults to the
 * known dev address).
 */

const ADMIN_API_BASE =
  process.env.NEXT_PUBLIC_ADMIN_API_URL ?? '/api/admin-api';

export interface ZentNodeInfo {
  id: number;
  name: string;
  httpsEndpoint: string;
  wssEndpoint: string;
  status: string;
  rpcUser: string;
  rpcPass: string;
  sort: number;
  extras: string;
  leasedAt: string | null;
  leasedBy: string;
}

interface AdminApiResponse<T = unknown> {
  code: number;
  msg: string;
  data: T;
}

export interface SignatureHeaders {
  'X-Sign-PublicKey': string;
  'X-Sign-Timestamp': string;
  'X-Sign-Signature': string;
  [key: string]: string;
}

async function post<T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<AdminApiResponse<T>> {
  const res = await fetch(`${ADMIN_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let errorMsg = `Admin API ${path} failed: ${res.status} ${res.statusText}`;
    try {
      const errJson = (await res.clone().json()) as {msg?: string};
      if (errJson?.msg) {
        errorMsg = errJson.msg;
      }
    } catch {
      // fallback to default status text if JSON parsing fails
    }
    throw new Error(errorMsg);
  }
  return res.json() as Promise<AdminApiResponse<T>>;
}

/**
 * Lease one available RPC node.
 *
 * @throws if no node is available or the request fails.
 */
export async function leaseRpcNode(
  address: string,
  sigHeaders: SignatureHeaders,
): Promise<ZentNodeInfo> {
  const resp = await post<ZentNodeInfo>(
    '/zent/leaseNode',
    {
      leasedBy: address,
    },
    sigHeaders,
  );
  if (resp.code !== 0) {
    throw new Error(`leaseRpcNode error: ${resp.msg}`);
  }
  return resp.data;
}

/**
 * Release a leased RPC node.
 *
 * @throws if the request fails.
 */
export async function releaseRpcNode(
  nodeId: number,
  address: string,
  sigHeaders: SignatureHeaders,
): Promise<void> {
  const resp = await post<void>(
    '/zent/releaseNode',
    {
      id: nodeId,
      leasedBy: address,
    },
    sigHeaders,
  );
  if (resp.code !== 0) {
    throw new Error(`releaseRpcNode error: ${resp.msg}`);
  }
}
