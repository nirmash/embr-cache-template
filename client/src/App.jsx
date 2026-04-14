import React, { useState, useEffect, useCallback } from 'react';
import CronJobs from './CronJobs';
import RedisCli from './RedisCli';

function formatCounter(name) {
  return name.replace(/_/g, ' ');
}

function Counters() {
  const [counters, setCounters] = useState({});

  const load = useCallback(async () => {
    const res = await fetch('/api/counters');
    setCounters(await res.json());
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [load]);

  const increment = async (name) => {
    await fetch('/api/counters/' + name + '/increment', { method: 'POST' });
    load();
  };

  const reset = async (name) => {
    await fetch('/api/counters/' + name + '/reset', { method: 'POST' });
    load();
  };

  const colors = { page_views: 'var(--accent)', api_calls: 'var(--info)', cache_hits: 'var(--warn)', errors: 'var(--danger)' };

  return (
    <div className="panel">
      <h2>Atomic Counters <span className="badge">INCR / SET</span></h2>
      <div className="counter-grid">
        {Object.entries(counters).map(([name, value]) => (
          <div key={name} className="counter-card">
            <div className="counter-value" style={{ color: colors[name] || 'var(--accent)' }}>{value.toLocaleString()}</div>
            <div className="counter-name">{formatCounter(name)}</div>
            <div className="counter-actions">
              <button className="btn btn-primary btn-sm" onClick={() => increment(name)}>+1</button>
              <button className="btn btn-ghost btn-sm" onClick={() => reset(name)}>Reset</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Leaderboard() {
  const [players, setPlayers] = useState([]);
  const [newName, setNewName] = useState('');
  const [newScore, setNewScore] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/leaderboard');
    setPlayers(await res.json());
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [load]);

  const addPlayer = async () => {
    if (!newName || !newScore) return;
    await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, score: parseInt(newScore) }),
    });
    setNewName(''); setNewScore('');
    load();
  };

  const boost = async (name) => {
    await fetch('/api/leaderboard/' + encodeURIComponent(name) + '/increment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Math.floor(Math.random() * 500) + 100 }),
    });
    load();
  };

  const remove = async (name) => {
    await fetch('/api/leaderboard/' + encodeURIComponent(name), { method: 'DELETE' });
    load();
  };

  const rankClass = (r) => r === 1 ? 'gold' : r === 2 ? 'silver' : r === 3 ? 'bronze' : 'other';

  return (
    <div className="panel">
      <h2>Leaderboard <span className="badge">Sorted Sets</span></h2>
      <div className="leaderboard-table">
        {players.map((p) => (
          <div key={p.name} className="lb-row">
            <div className={'lb-rank ' + rankClass(p.rank)}>{p.rank}</div>
            <div className="lb-name">{p.name}</div>
            <div className="lb-score">{p.score.toLocaleString()}</div>
            <div className="lb-actions">
              <button className="btn btn-primary btn-sm" onClick={() => boost(p.name)} title="Random boost">Boost</button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(p.name)} title="Remove">x</button>
            </div>
          </div>
        ))}
      </div>
      <div className="add-player-form">
        <input placeholder="Player name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <input placeholder="Score" type="number" value={newScore} onChange={(e) => setNewScore(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addPlayer()} />
        <button className="btn btn-primary" onClick={addPlayer}>Add</button>
      </div>
    </div>
  );
}

function CacheExplorer() {
  const [entries, setEntries] = useState([]);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [ttl, setTtl] = useState('60');
  const [lookupKey, setLookupKey] = useState('');
  const [lookupResult, setLookupResult] = useState(null);

  const loadKeys = useCallback(async () => {
    const res = await fetch('/api/cache-demo/keys');
    setEntries(await res.json());
  }, []);

  useEffect(() => { loadKeys(); const t = setInterval(loadKeys, 5000); return () => clearInterval(t); }, [loadKeys]);

  const setKV = async () => {
    if (!key || !value) return;
    await fetch('/api/cache-demo/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value, ttl: parseInt(ttl) || 60 }),
    });
    setKey(''); setValue('');
    loadKeys();
  };

  const lookup = async () => {
    if (!lookupKey) return;
    const res = await fetch('/api/cache-demo/get/' + encodeURIComponent(lookupKey));
    setLookupResult(await res.json());
  };

  const flush = async () => {
    await fetch('/api/cache-demo/flush', { method: 'POST' });
    loadKeys();
  };

  return (
    <div className="panel" style={{ gridColumn: '1 / -1' }}>
      <h2>Cache Explorer <span className="badge">GET / SETEX / TTL</span></h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>SET a key (with TTL)</div>
          <div className="kv-form">
            <input placeholder="Key" value={key} onChange={(e) => setKey(e.target.value)} />
            <input placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} />
            <input placeholder="TTL (s)" type="number" value={ttl} onChange={(e) => setTtl(e.target.value)} style={{ maxWidth: 80 }} />
            <button className="btn btn-primary" onClick={setKV}>Set</button>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>GET a key</div>
          <div className="kv-form">
            <input placeholder="Key to lookup" value={lookupKey} onChange={(e) => setLookupKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && lookup()} />
            <button className="btn btn-primary" onClick={lookup}>Get</button>
          </div>
          {lookupResult && (
            <div className="kv-item" style={{ marginTop: 8 }}>
              <span className="kv-key">{lookupResult.hit ? 'HIT' : 'MISS'}</span>
              <span className="kv-value">{lookupResult.value || '(nil)'}</span>
              {lookupResult.ttl > 0 && <span className="kv-ttl">{lookupResult.ttl}s</span>}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Live Keys ({entries.length})</div>
        <button className="btn btn-warn btn-sm" onClick={flush}>Flush Demo Keys</button>
      </div>
      <div className="kv-list">
        {entries.length === 0 ? (
          <div className="empty">No demo keys set. Try adding one above.</div>
        ) : entries.map((e) => (
          <div key={e.key} className="kv-item">
            <span className="kv-key">{e.key.replace('demo:', '')}</span>
            <span className="kv-value">{e.value}</span>
            <span className="kv-ttl">{e.ttl > 0 ? e.ttl + 's' : 'no ttl'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [stats, setStats] = useState({ usedMemory: '0', peakMemory: '0', connectedClients: 0, leaderboardSize: 0 });

  useEffect(() => {
    const load = async () => {
      try { const res = await fetch('/api/stats'); setStats(await res.json()); } catch {}
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="app">
      <div className="header">
        <div><h1>PulseBoard</h1><p>Real-time dashboard powered by Embr Cache (Valkey/Redis)</p></div>
      </div>

      <div className="stats-bar">
        <div className="stat"><span className="value">{stats.usedMemory}</span><span className="label">Memory Used</span></div>
        <div className="stat info"><span className="value">{stats.peakMemory}</span><span className="label">Peak Memory</span></div>
        <div className="stat warn"><span className="value">{stats.connectedClients}</span><span className="label">Clients</span></div>
        <div className="stat"><span className="value">{stats.leaderboardSize}</span><span className="label">Leaderboard Size</span></div>
      </div>

      <div className="panels">
        <Leaderboard />
        <Counters />
      </div>

      <CacheExplorer />

      <CronJobs />

      <RedisCli />
    </div>
  );
}
