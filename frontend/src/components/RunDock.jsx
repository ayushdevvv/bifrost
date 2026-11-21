import React, { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, X } from 'lucide-react'

const STAGES = ['Dispatching', 'Executing agents', 'Grading outputs', 'Aggregating']

export default function RunDock({ busy, experiment, planned = 0, report, onNavigate }) {
  const [dismissed, setDismissed] = useState('')
  const runs = experiment?.runs || []
  const done = runs.filter((r) => ['completed', 'failed', 'cancelled'].includes(r.status)).length
  const total = Math.max(planned, runs.length, 1)
  const finished = experiment?.status && experiment.status !== 'running' && experiment.status !== 'queued'
  const pct = finished ? 100 : Math.min(97, Math.round((done / total) * 100))
  const stage = busy ? 0 : finished ? 3 : done >= total - 1 && done > 0 ? 2 : 1
  const active = busy || (experiment && dismissed !== experiment.id)
  useEffect(() => {
    if (!finished || !experiment?.id) return undefined
    const t = setTimeout(() => setDismissed(experiment.id), 9000)
    return () => clearTimeout(t)
  }, [finished, experiment?.id])
  if (!active || (!busy && !experiment)) return null
  return <aside className={`run-dock ${finished ? 'is-done' : ''}`} role="status" aria-live="polite">
    <div className="run-dock-head">
      <span className="run-dock-orb">{finished ? <CheckCircle2 size={16} /> : <Loader2 size={16} className="spin" />}</span>
      <div><b>{finished ? 'Benchmark complete' : busy ? 'Launching benchmark' : 'Benchmark running'}</b><small>{experiment?.title || 'Preparing matched trials'}</small></div>
      {!busy && <button className="run-dock-x" onClick={() => setDismissed(experiment?.id || '')} aria-label="Dismiss"><X size={14} /></button>}
    </div>
    <div className="run-dock-bar"><i style={{ width: `${busy ? 8 : pct}%` }} /></div>
    <div className="run-dock-meta"><span>{busy ? 'Contacting backend…' : `${done} / ${total} executions`}</span><span>{busy ? '' : `${pct}%`}</span></div>
    <ol className="run-dock-stages">{STAGES.map((label, i) => <li key={label} className={i < stage ? 'done' : i === stage ? 'now' : ''}><i />{label}</li>)}</ol>
    {finished && report && <div className="run-dock-result"><b>{report.successes ?? '—'}<small>/{report.total_runs ?? '—'}</small></b><span>runs passed{report.success_rate != null ? ` · ${Math.round(report.success_rate)}%` : ''}</span></div>}
    {!busy && <div className="run-dock-links">
      <button onClick={() => onNavigate('arena')}>3D Arena</button>
      <button onClick={() => onNavigate('runs')}>Run inspector</button>
      <button onClick={() => onNavigate('chaos')}>Chaos lab</button>
      <button onClick={() => onNavigate('evaluation')}>Results</button>
    </div>}
  </aside>
}
