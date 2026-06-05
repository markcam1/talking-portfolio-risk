import { useEffect, useState } from 'react';

interface Health {
  orchestrator: string;
  optimizer: string;
  callAgent: string;
  mockMode: boolean;
}

export default function Settings() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => {});
  }, []);

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-2xl font-bold mb-2">Settings</h2>
      <p className="text-sm text-gray-500 mb-8">Secrets are managed via environment variables and never shown in the UI.</p>

      <div className="bg-white rounded-lg border divide-y mb-6">
        <div className="px-5 py-4">
          <h3 className="text-sm font-semibold mb-3">Service Endpoints</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Orchestrator</span>
              <span className="font-mono text-xs">http://127.0.0.1:5179</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Optimizer</span>
              <span className="font-mono text-xs">http://127.0.0.1:8077</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Call Agent</span>
              <span className="font-mono text-xs">http://127.0.0.1:3334</span>
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          <h3 className="text-sm font-semibold mb-3">Current Status</h3>
          <div className="space-y-2 text-sm">
            {health ? (
              <>
                <Row label="Mock Mode" value={health.mockMode ? 'ON — no real calls placed' : 'OFF'} highlight={!health.mockMode} />
                <Row label="Optimizer" value={health.optimizer} ok={health.optimizer === 'ok'} />
                <Row label="Call Agent" value={health.callAgent} ok={health.callAgent === 'ok'} />
              </>
            ) : <span className="text-gray-400 text-sm">Loading…</span>}
          </div>
        </div>

        <div className="px-5 py-4">
          <h3 className="text-sm font-semibold mb-1">Compliance Notes</h3>
          <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
            <li>Compliance bundles in <code>DATA_DIR/compliance/</code> are permanent — never truncated.</li>
            <li>Dev process logs in <code>LOG_DIR/</code> are truncated on each restart.</li>
            <li>Secrets (Twilio, Gemini) are stored in <code>.env</code> only — never in the DB or UI.</li>
            <li>OWNED_NUMBERS_ONLY=true means only verified owned numbers can be called.</li>
          </ul>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        To change settings, edit <code>.env</code> and restart the orchestrator.
        To change entity name or disclaimer, use the Caller Profiles page.
      </p>
    </div>
  );
}

function Row({ label, value, ok, highlight }: { label: string; value: string; ok?: boolean; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={ok === true ? 'text-green-600' : ok === false ? 'text-red-500' : highlight ? 'text-yellow-600 font-medium' : 'text-gray-700'}>
        {value}
      </span>
    </div>
  );
}
