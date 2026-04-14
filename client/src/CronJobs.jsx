import React, { useState, useEffect, useCallback } from 'react';

const PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 min', value: '*/5 * * * *' },
  { label: 'Every 15 min', value: '*/15 * * * *' },
  { label: 'Hourly', value: '0 * * * *' },
  { label: 'Daily midnight', value: '0 0 * * *' },
  { label: 'Custom', value: '' },
];

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '—';
  if (seconds < 60) return seconds + 's';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ' + (seconds % 60) + 's';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h + 'h ' + m + 'm';
}

function JobLogs({ jobId }) {
  const [logs, setLogs] = useState([]);
  const [visible, setVisible] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/cron/' + jobId + '/logs');
    setLogs(await res.json());
  }, [jobId]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => { setVisible(!visible); if (!visible) load(); }}>
        {visible ? 'Hide logs' : 'Logs'}
      </button>
      {visible && (
        <div className="cron-logs">
          {logs.length === 0 ? <div className="empty" style={{ padding: 8 }}>No executions yet</div> : logs.map((log, i) => (
            <div key={i} className={'cron-log-entry ' + (log.success ? 'success' : 'fail')}>
              <span className="cron-log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
              <span className={'cron-log-status ' + (log.success ? 'success' : 'fail')}>{log.success ? 'OK' : 'FAIL'}</span>
              <span className="cron-log-duration">{log.duration}ms</span>
              <span className="cron-log-output">{log.output}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CronJobs() {
  const [jobs, setJobs] = useState([]);
  const [name, setName] = useState('');
  const [expression, setExpression] = useState('* * * * *');
  const [customExpr, setCustomExpr] = useState('');
  const [actionType, setActionType] = useState('http');
  const [action, setAction] = useState('');
  const [preset, setPreset] = useState('* * * * *');
  const [error, setError] = useState('');

  const loadJobs = useCallback(async () => {
    const res = await fetch('/api/cron');
    setJobs(await res.json());
  }, []);

  useEffect(() => { loadJobs(); const t = setInterval(loadJobs, 5000); return () => clearInterval(t); }, [loadJobs]);

  const createJob = async () => {
    setError('');
    if (!name || !action) { setError('Name and action are required'); return; }
    const expr = preset === '' ? customExpr : expression;
    if (!expr) { setError('Cron expression is required'); return; }

    const res = await fetch('/api/cron', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, expression: expr, actionType, action }),
    });
    const data = await res.json();
    if (data.error) { setError(data.error); return; }
    setName(''); setAction(''); setCustomExpr('');
    loadJobs();
  };

  const toggleJob = async (id) => {
    await fetch('/api/cron/' + id + '/toggle', { method: 'POST' });
    loadJobs();
  };

  const deleteJob = async (id) => {
    await fetch('/api/cron/' + id, { method: 'DELETE' });
    loadJobs();
  };

  return (
    <div className="panel">
      <h2>Cron Engine <span className="badge">TTL Triggers</span></h2>

      <div className="cron-create-form">
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>New Cron Job</div>
        <div className="kv-form">
          <input placeholder="Job name" value={name} onChange={(e) => setName(e.target.value)} style={{ minWidth: 120 }} />
          <select value={preset} onChange={(e) => { setPreset(e.target.value); if (e.target.value !== '') setExpression(e.target.value); }}
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)' }}>
            {PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {preset === '' && (
            <input placeholder="* * * * *" value={customExpr} onChange={(e) => setCustomExpr(e.target.value)}
              style={{ maxWidth: 120, fontFamily: 'monospace' }} />
          )}
          <select value={actionType} onChange={(e) => setActionType(e.target.value)}
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', maxWidth: 100 }}>
            <option value="http">HTTP</option>
            <option value="script">Script</option>
          </select>
          <input placeholder={actionType === 'http' ? 'https://example.com/webhook' : 'echo "hello"'}
            value={action} onChange={(e) => setAction(e.target.value)} style={{ flex: 2 }} />
          <button className="btn btn-primary" onClick={createJob}>Create</button>
        </div>
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 4 }}>{error}</div>}
        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
          Format: minute hour day-of-month month day-of-week &nbsp;|&nbsp; Supports: *, ranges (1-5), steps (*/5), lists (1,3,5)
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', margin: '16px 0 8px' }}>
        Active Jobs ({jobs.length})
      </div>

      <div className="cron-job-list">
        {jobs.length === 0 ? (
          <div className="empty">No cron jobs. Create one above to get started.</div>
        ) : jobs.map(job => (
          <div key={job.id} className={'cron-job-card ' + (job.enabled === 'true' ? '' : 'disabled')}>
            <div className="cron-job-header">
              <div className="cron-job-name">{job.name}</div>
              <div className="cron-job-meta">
                <span className="badge" style={{ fontFamily: 'monospace' }}>{job.expression}</span>
                <span className="badge">{job.description}</span>
                <span className={'badge ' + (job.actionType === 'http' ? 'badge-info' : 'badge-warn')}>{job.actionType}</span>
              </div>
            </div>
            <div className="cron-job-action">{job.action}</div>
            <div className="cron-job-footer">
              <div className="cron-job-next">
                {job.enabled === 'true'
                  ? job.nextRunIn ? <>Next run in <strong>{formatDuration(job.nextRunIn)}</strong></> : 'Scheduling...'
                  : <span style={{ color: 'var(--text2)' }}>Paused</span>
                }
              </div>
              <div className="cron-job-actions">
                <JobLogs jobId={job.id} />
                <button className="btn btn-ghost btn-sm" onClick={() => toggleJob(job.id)}>
                  {job.enabled === 'true' ? 'Pause' : 'Resume'}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteJob(job.id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
