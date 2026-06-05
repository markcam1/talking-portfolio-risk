import { useEffect, useState } from 'react';

interface Portfolio {
  id: string;
  name: string;
  tickers: string[];
  config: Record<string, unknown>;
  dateRange?: { start: string; end: string };
  updatedAt: string;
}

export default function Portfolios() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [name, setName] = useState('');
  const [tickers, setTickers] = useState('');
  const [error, setError] = useState('');

  const load = () => fetch('/api/portfolios').then(r => r.json()).then(setPortfolios).catch(() => {});

  useEffect(() => { load(); }, []);

  const create = async () => {
    setError('');
    const tickerList = tickers.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    if (!name || tickerList.length === 0) { setError('Name and tickers required'); return; }
    const res = await fetch('/api/portfolios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, tickers: tickerList }),
    });
    if (!res.ok) { setError(await res.text()); return; }
    setName(''); setTickers('');
    load();
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete portfolio?')) return;
    await fetch(`/api/portfolios/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Portfolios</h2>

      <div className="bg-white rounded-lg border p-5 mb-6 max-w-lg">
        <h3 className="text-sm font-semibold mb-3">New Portfolio</h3>
        <input className="border rounded px-3 py-2 text-sm w-full mb-2" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <input className="border rounded px-3 py-2 text-sm w-full mb-2" placeholder="Tickers (comma-separated, e.g. AAPL, MSFT)" value={tickers} onChange={e => setTickers(e.target.value)} />
        {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
        <button onClick={create} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700">Create</button>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Tickers</th>
              <th className="px-4 py-3 text-left">Updated</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {portfolios.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No portfolios yet</td></tr>
            )}
            {portfolios.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{p.tickers.join(', ')}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(p.updatedAt).toLocaleString()}</td>
                <td className="px-4 py-3 flex gap-2 justify-end">
                  <a href={`/run?portfolio=${p.id}`} className="bg-indigo-600 text-white px-3 py-1 rounded text-xs hover:bg-indigo-700">Run</a>
                  <button onClick={() => remove(p.id)} className="text-red-500 text-xs hover:text-red-700">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
