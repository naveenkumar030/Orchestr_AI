import { request, actionRequest, BASE_URL } from './client';

export interface OperatorSignature {
  id: string;
  action: string;
  details: string;
  type: string;
  operator: string;
  clearance: string;
  timestamp: string;
  signature_hash: string;
  token_type: string;
  verified: boolean;
  status: string;
  metadata?: Record<string, any>;
}

export interface ActiveSession {
  name: string;
  status: string;
  details: string;
}

export interface DelegationTier {
  name: string;
  description: string;
  tier: string;
  icon: string;
  color: string;
}

export interface OperatorProfile {
  name: string;
  handle: string;
  role: string;
  status: string;
  timezone: string;
  cluster_scope: string;
  clearance: string;
  cosign_hardware_token: string;
  cosign_key_id: string;
  gpg_key: string;
  gpg_status: string;
  audit_sequence: string;
  active_sessions: ActiveSession[];
  delegation_matrix: DelegationTier[];
}

export interface SignaturesResponse {
  signatures: OperatorSignature[];
  count: number;
  sequence: number;
}

const defaultProfile: OperatorProfile = {
  name: 'Naveen Kumar',
  handle: '@naveenkumar030',
  role: 'Repository Operator',
  status: 'ACTIVE OPERATOR',
  timezone: 'Asia/Kolkata (IST +05:30)',
  cluster_scope: 'naveenkumar030/testingrepo',
  clearance: 'Repository Operator',
  cosign_hardware_token: 'Not configured',
  cosign_key_id: 'Not configured',
  gpg_key: 'Not configured',
  gpg_status: 'UNCONFIGURED',
  audit_sequence: 'Audit Log #0',
  active_sessions: [
    {
      name: 'SentinelOps Control Server',
      status: 'RUNNING',
      details: 'Port: 5000 · Connected: naveenkumar030/testingrepo',
    },
  ],
  delegation_matrix: [
    {
      name: 'Diagnoser Agent',
      description: 'Root cause analysis and failure log isolation',
      tier: 'Active',
      icon: 'smart_toy',
      color: 'green',
    },
    {
      name: 'Fix Suggester Agent',
      description: 'Deterministic code patch synthesis and candidate pull requests',
      tier: 'Active',
      icon: 'auto_fix_high',
      color: 'green',
    },
    {
      name: 'MergeGuard-Zero',
      description: 'Safety gate enforcing CI passing and zero critical findings',
      tier: 'Active',
      icon: 'security',
      color: 'green',
    },
  ],
};

const defaultSignatures: SignaturesResponse = {
  signatures: [],
  count: 0,
  sequence: 0,
};

export const operatorApi = {
  getOperatorProfile: async (): Promise<OperatorProfile> => {
    const res = await request<OperatorProfile>(
      '/operator/profile',
      undefined,
      defaultProfile
    );
    return res.data;
  },

  getOperatorSignatures: async (limit: number = 50): Promise<SignaturesResponse> => {
    const res = await request<SignaturesResponse>(
      `/operator/signatures?limit=${limit}`,
      undefined,
      defaultSignatures
    );
    return res.data;
  },

  rotateCosignKey: async (worker: string = 'Local Worker') => {
    return actionRequest<{ success: boolean; message: string; cosign_key_id: string; signature: OperatorSignature }>(
      '/operator/keys/rotate-cosign',
      {
        method: 'POST',
        body: JSON.stringify({ worker }),
      },
      () => {
        defaultSignatures.sequence += 1;
        const newKey = 'SHA256:' + Math.random().toString(36).substring(2, 10);
        const sig: OperatorSignature = {
          id: `SIG-${String(defaultSignatures.sequence).padStart(4, '0')}`,
          action: `Cosign Key Rotation: ${worker}`,
          details: 'Cryptographic key rotated & recorded in audit log',
          type: 'key_rotation',
          operator: 'Naveen Kumar (@naveenkumar030)',
          clearance: 'Repository Operator',
          timestamp: new Date().toISOString(),
          signature_hash: 'sha256:' + Math.random().toString(36).substring(2, 18),
          token_type: 'Cryptographic Key (ECDSA-P256)',
          verified: true,
          status: 'Authenticated',
        };
        defaultSignatures.signatures.unshift(sig);
        defaultSignatures.count = defaultSignatures.signatures.length;
        return {
          success: true,
          message: 'Key rotated',
          cosign_key_id: newKey,
          signature: sig,
        };
      }
    );
  },

  rotateGpgKey: async () => {
    return actionRequest<{ success: boolean; message: string; gpg_key: string; signature: OperatorSignature }>(
      '/operator/keys/rotate-gpg',
      {
        method: 'POST',
      },
      () => {
        defaultSignatures.sequence += 1;
        const newKey = '7A9F ' + Math.random().toString(36).substring(2, 6).toUpperCase();
        const sig: OperatorSignature = {
          id: `SIG-${String(defaultSignatures.sequence).padStart(4, '0')}`,
          action: 'Signing Key Rotation',
          details: 'New cryptographic signing key registered',
          type: 'security',
          operator: 'Naveen Kumar (@naveenkumar030)',
          clearance: 'Repository Operator',
          timestamp: new Date().toISOString(),
          signature_hash: 'sha256:' + Math.random().toString(36).substring(2, 18),
          token_type: 'Ed25519 Signing Key',
          verified: true,
          status: 'Authenticated',
        };
        defaultSignatures.signatures.unshift(sig);
        defaultSignatures.count = defaultSignatures.signatures.length;
        return {
          success: true,
          message: 'Key updated',
          gpg_key: newKey,
          signature: sig,
        };
      }
    );
  },

  createSignature: async (action: string, details: string, type: string = 'operator_action') => {
    return actionRequest<{ success: boolean; signature: OperatorSignature }>(
      '/operator/signatures',
      {
        method: 'POST',
        body: JSON.stringify({ action, details, type }),
      },
      () => {
        defaultSignatures.sequence += 1;
        const sig: OperatorSignature = {
          id: `SIG-${String(defaultSignatures.sequence).padStart(4, '0')}`,
          action,
          details,
          type,
          operator: 'Naveen Kumar (@naveenkumar030)',
          clearance: 'Repository Operator',
          timestamp: new Date().toISOString(),
          signature_hash: 'sha256:' + Math.random().toString(36).substring(2, 18),
          token_type: 'Ed25519 Verified Key',
          verified: true,
          status: 'Authenticated',
        };
        defaultSignatures.signatures.unshift(sig);
        defaultSignatures.count = defaultSignatures.signatures.length;
        return {
          success: true,
          signature: sig,
        };
      }
    );
  },

  downloadAuditExport: async () => {
    try {
      const res = await fetch(`${BASE_URL}/operator/audit-export?format=download`);
      if (!res.ok) throw new Error('Failed to fetch audit export');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sentinelops-security-audit-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      return true;
    } catch (err) {
      console.error('Audit export download failed, fallback to JSON generation:', err);
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(defaultSignatures, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `sentinelops-audit-export-${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      return true;
    }
  },
};
