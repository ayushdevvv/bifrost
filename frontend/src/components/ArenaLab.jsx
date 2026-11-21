import React, { useMemo, useState } from 'react'
import { Pause, Play, RotateCcw, X, ArrowRight, Box } from 'lucide-react'
import Arena3D, { ARENA_NODES, HEALTH_LABEL, nodeForEvent, nodeHealth, scenarioForEvent } from './Arena3D.jsx'

const SCENARIOS = [['normal', 'Normal execution'], ['provider', 'Provider failure'], ['poison', 'Poisoned evidence'], ['latency', 'Network latency'], ['recovery', 'Successful recovery']]
const human = (t = '') => t.replace(/[._]/g, ' ')
const ms = (e) => { const p = e.payload || e.data || {}; return Number(p.duration_ms ?? p.latency_ms ?? NaN) }

export default function ArenaLab({ experiment, events = [], paused, onPause, onReplay, onNavigate, replayMode, replayCursor, replayTotal, onReplaySeek, activeFault }) {
  const [sim, setSim] = useState(null)
  const [selected, setSelected] = useState(null)
  const latest = events[events.length - 1]
  const live = !sim && events.length > 0
  const scenario = sim || (latest ? scenarioForEvent(latest.event_type) : activeFault && activeFault !== 'none' ? activeFault : 'normal')
  const activeId = sim ? (({ provider: 'llm', poison: 'browser', latency: 'api', recovery: 'bifrost', normal: 'tools' })[sim]) : nodeForEvent(latest?.event_type)
  const stats = useMemo(() => {
    const by = (re) => events.filter((e) => re.test(e.event_type || '')).length
    const durs = events.map(ms).filter(Number.isFinite)
    const faults = by(/failed|fault|poison|latency/)
    const recovered = by(/fallback\.completed|model\.request\.completed/)
    return { total: events.length, tools: by(/tool\.call/), models: by(/model\.request/), faults, avg: durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : null, recovery: faults ? Math.min(100, Math.round((recovered / faults) * 100)) : null }
  }, [events])
  const node = ARENA_NODES.find((n) => n.id === selected)
  const nodeEvents = node ? events.filter((e) => nodeForEvent(e.event_type) === node.id) : []
  const nodeDur = nodeEvents.map(ms).filter(Number.isFinite)
  const nodeErr = nodeEvents.filter((e) => /failed|poison|unavailable/.test(e.event_type || '')).length
  const runs = experiment?.runs || []
  const done = runs.filter((r) => ['completed', 'failed', 'cancelled'].includes(r.status)).length
  const strip = [['Events', stats.total], ['Tool calls', stats.tools], ['Model calls', stats.models], ['Faults', stats.faults], ['Avg latency', stats.avg == null ? '—' : `${stats.avg}ms`], ['Recovery', stats.recovery == null ? '—' : `${stats.recovery}%`]]
  const payload = latest ? (latest.payload || latest.data || {}) : null
  return <section className="a3d-lab">
    <div className="a3d-head"><div><span className="a3d-eyebrow">{live ? 'LIVE SPATIAL TRACE' : 'SIMULATED EXECUTION'} / {experiment?.id ? String(experiment.id).slice(0, 10).toUpperCase() : 'RIFT'}</span><h2>3D Execution Arena</h2></div>
      <div className="a3d-toggle"><button className={scenario !== 'normal' ? '' : 'on'} onClick={() => setSim('normal')}>Normal</button><button className={scenario !== 'normal' ? 'on' : ''} onClick={() => setSim('provider')}>Chaos</button>{sim && events.length > 0 && <button onClick={() => setSim(null)}>Follow live</button>}</div></div>
    <div className="a3d-stage">
      <Arena3D scenario={scenario} activeId={activeId} selectedId={selected} onSelect={setSelected} paused={paused} />
      <div className="a3d-scen"><small>SIMULATION SCENARIO</small>{SCENARIOS.map(([id, label], i) => <button key={id} className={scenario === id && (sim || live || id === 'normal') ? 'on' : ''} onClick={() => setSim(id)}><i>{String(i + 1).padStart(2, '0')}</i>{label}</button>)}</div>
      <div className="a3d-metrics">{strip.map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}</div>
      {node && <aside className="a3d-inspector"><button className="a3d-x" onClick={() => setSelected(null)} aria-label="Close"><X size={14} /></button><small>NODE INSPECTOR</small><div className="a3d-node-icon"><Box size={20} /></div><h3>{node.label}</h3><span className={`a3d-state ${nodeHealth(node.id, scenario)}`}>{HEALTH_LABEL[nodeHealth(node.id, scenario)]}</span>
        <dl><dt>Events</dt><dd>{nodeEvents.length}</dd><dt>Errors</dt><dd>{nodeErr}</dd><dt>Avg latency</dt><dd>{nodeDur.length ? `${Math.round(nodeDur.reduce((a, b) => a + b, 0) / nodeDur.length)}ms` : '—'}</dd></dl>
        <button className="a3d-trace" onClick={() => onNavigate('runs')}>Inspect full trace <ArrowRight size={13} /></button></aside>}
      <div className="a3d-step"><small>TASK EXECUTION / {latest ? `STEP ${String(events.length).padStart(2, '0')}` : 'IDLE'}</small><b>{latest ? human(latest.event_type) : 'Waiting for events'}</b><p>{payload && Object.keys(payload).length ? JSON.stringify(payload).slice(0, 120) : latest ? 'No extra detail recorded.' : 'Launch a benchmark, or pick a scenario to simulate.'}</p></div>
      <div className="a3d-timeline"><button onClick={onPause} aria-label={paused ? 'Resume' : 'Pause'}>{paused ? <Play size={15} /> : <Pause size={15} />}</button><button onClick={onReplay} aria-label="Replay run"><RotateCcw size={15} /></button>
        {replayMode && replayTotal ? <input type="range" min="0" max={replayTotal} value={replayCursor} onChange={(e) => onReplaySeek(Number(e.target.value))} /> : <div className="a3d-bar"><i style={{ width: `${runs.length ? Math.round((done / runs.length) * 100) : 0}%` }} /></div>}
        <span>{replayMode && replayTotal ? `${replayCursor}/${replayTotal}` : runs.length ? `${done}/${runs.length} runs` : 'no run'}</span></div>
    </div>
  </section>
}
