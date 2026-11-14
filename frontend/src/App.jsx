import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Bot, Boxes, Check,
  ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Command, Copy, Cpu,
  Database, Download, ExternalLink, Eye, FileBarChart, FileText, FlaskConical, Gauge,
  GitCompareArrows, Globe2, Layers3, LayoutDashboard, ListFilter, Menu, Network,
  Pause, Play, Plus, Radio, RefreshCw, Search, Server, Settings2, ShieldCheck,
  ShieldEllipsis, Sparkles, Square, Terminal, Timer, Trash2, Trophy, X, Zap,
} from 'lucide-react'
import Arena3D from './components/Arena3D.jsx'

const API = import.meta.env.VITE_API_BASE_URL || '/api'
const navGroups = [
  { label: 'Workspace', items: [
    ['overview', 'Overview', LayoutDashboard], ['benchmark', 'Benchmark Lab', FlaskConical],
    ['agents', 'Agents', Bot], ['research', 'Research Intel', Globe2], ['runs', 'Run Inspector', Activity],
  ] },
  { label: 'Experiments', items: [
    ['chaos', 'Chaos Lab', ShieldEllipsis], ['arena', '3D Arena', Boxes],
    ['evaluation', 'Evaluation', FileBarChart], ['compare', 'Compare', GitCompareArrows], ['leaderboard', 'Leaderboard', Trophy],
  ] },
  { label: 'System', items: [['settings', 'Settings', Settings2]] },
]
const pageTitles = {
  overview: ['Overview', 'Your agent intelligence workspace.'],
  benchmark: ['Benchmark Lab', 'Design a fair experiment and run it across agents.'],
  agents: ['Agents', 'Connect agents without changing how they are built.'],
  research: ['Research Intelligence', 'Search, inspect and preserve live web evidence.'],
  runs: ['Run Inspector', 'Every observable action, result and failure.'],
  chaos: ['Chaos Lab', 'Break the environment. Measure the recovery.'],
  arena: ['3D Arena', 'A live digital twin of agent execution.'],
  evaluation: ['Deep Evaluation', 'Measure answer quality, evidence integrity and resilience.'],
  compare: ['Compare', 'Understand what makes one configuration perform better.'],
  leaderboard: ['Leaderboard', 'Rank configurations by verified performance.'],
  settings: ['Settings', 'Connect your gateway, research provider and database.'],
}
const defaultConfig = {
  title: 'Research resilience benchmark', mode: 'demo', evidenceMode: 'snapshot',
  agentIds: ['agent-react', 'agent-planner'], models: 'general', taskIds: ['research-001', 'research-002'],
  repetitions: 2, severity: 50, masterSeed: 42017,
  faults: { provider: true, poison: true, latency: true },
  budgets: { max_steps: 20, max_tool_calls: 15, timeout_seconds: 120, max_cost_usd: 0.1 },
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.detail || body.message || `Request failed (${response.status})`)
  return body
}
const money = (value) => value == null ? '—' : `$${Number(value).toFixed(Number(value) < 0.01 ? 4 : 3)}`
const number = (value) => value == null ? '—' : Number(value).toLocaleString()
const percent = (value) => value == null ? '—' : `${Math.round(value)}%`
const short = (value = '') => String(value).slice(0, 12)
const relativeTime = (value) => value ? new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const toneForStatus = (status = '') => ['completed', 'success'].includes(status) ? 'green' : ['failed', 'cancelled'].includes(status) ? 'red' : ['running', 'queued'].includes(status) ? 'blue' : 'muted'

function Badge({ children, tone = 'muted', dot = false }) {
  return <span className={`badge badge-${tone}`}>{dot && <i />}{children}</span>
}
function Button({ children, variant = 'primary', size = 'md', icon: Icon, className = '', ...props }) {
  return <button className={`button button-${variant} button-${size} ${className}`} {...props}>{Icon && <Icon size={16} />}{children}</button>
}
function Panel({ children, className = '', ...props }) { return <section className={`panel ${className}`} {...props}>{children}</section> }
function PanelHeading({ title, detail, action }) {
  return <div className="panel-heading"><div><h3>{title}</h3>{detail && <p>{detail}</p>}</div>{action}</div>
}
function PageHeading({ page, eyebrow = 'RIFT / WORKSPACE', action }) {
  const [title, subtitle] = pageTitles[page] || pageTitles.overview
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>
}
function StatCard({ icon: Icon, label, value, detail, accent = 'blue', trend }) {
  return <Panel className={`stat-card stat-${accent}`}><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={18} /></span></div><div className="stat-value">{value ?? '—'}</div><div className="stat-bottom"><span>{detail}</span>{trend && <Badge tone="green"><ArrowUpRight size={11} />{trend}</Badge>}</div></Panel>
}
function MiniBars({ values = [18, 24, 16, 35, 28, 50, 43, 62, 55, 72, 64, 84] }) {
  const max = Math.max(...values, 1)
  return <div className="mini-bars">{values.map((v, i) => <span key={i} style={{ height: `${Math.max(7, v / max * 100)}%`, opacity: 0.45 + (i / values.length) * 0.55 }} />)}</div>
}
function EmptyState({ icon: Icon = Sparkles, title, detail, action }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={22} /></span><h3>{title}</h3><p>{detail}</p>{action}</div>
}
function Switch({ checked, onChange }) {
  return <button type="button" className={`switch ${checked ? 'is-on' : ''}`} aria-pressed={checked} onClick={() => onChange(!checked)}><span /></button>
}
function Field({ label, hint, children }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label> }
function SectionLabel({ children, aside }) { return <div className="section-label"><h2>{children}</h2>{aside && <span>{aside}</span>}</div> }
function ProgressBar({ value = 0, color = 'blue' }) { return <div className={`progress progress-${color}`}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div> }

function OverviewPage({ data, onNavigate, onStart }) {
  const recent = data.experiments.slice(0, 4)
  const o = data.overview || {}
  return <>
    <PageHeading page="overview" action={<Button icon={Plus} onClick={() => onNavigate('benchmark')}>New benchmark</Button>} />
    <div className="hero-card">
      <div className="hero-content">
        <div className="hero-kicker"><span className="live-dot" /> THE REALITY TEST FOR AI AGENTS</div>
        <h2>Benchmark.<br /><em>Stress test.</em> Understand.</h2>
        <p>Compare complete agent systems, expose weak points and see exactly what happens when the environment breaks.</p>
        <div className="hero-tags"><Badge tone="blue">Bifrost gateway</Badge><Badge tone="violet">Tavily research</Badge><Badge tone="green">Three.js arena</Badge></div>
        <div className="hero-actions"><Button icon={Play} onClick={() => onNavigate('benchmark')}>Run a benchmark</Button><Button variant="quiet" icon={Boxes} onClick={() => onNavigate('arena')}>Explore the arena</Button></div>
      </div>
      <div className="hero-art"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-core"><span>R</span></div><div className="hero-node node-a"><Cpu size={17} /></div><div className="hero-node node-b"><Globe2 size={17} /></div><div className="hero-node node-c"><Network size={17} /></div><div className="hero-caption">LIVE AGENT INTELLIGENCE</div></div>
    </div>
    <div className="stats-grid">
      <StatCard icon={FlaskConical} label="Experiments" value={number(o.experiments)} detail="Saved benchmark sessions" accent="blue" />
      <StatCard icon={Activity} label="Completed runs" value={number(o.completed)} detail={`${number(o.failed)} failed executions`} accent="violet" />
      <StatCard icon={Gauge} label="Average quality" value={o.avg_quality == null ? '—' : `${o.avg_quality}%`} detail="Across evaluated runs" accent="cyan" />
      <StatCard icon={ShieldCheck} label="Task success" value={percent(o.success_rate)} detail="Verified task outcomes" accent="green" />
    </div>
    <SectionLabel aside="Jump into a workspace">Explore the platform</SectionLabel>
    <div className="feature-grid">
      {[
        ['Agent benchmarking', 'Compare full agents, not just models.', 'benchmark', '01', 'feature-blue', Bot, '/assets/agent-benchmarking.jpg'],
        ['Chaos Lab', 'Inject controlled failures with seeded schedules.', 'chaos', '02', 'feature-red', ShieldEllipsis, '/assets/chaos-lab.jpg'],
        ['3D execution arena', 'Watch agents move through a live digital twin.', 'arena', '03', 'feature-violet', Boxes, '/assets/arena.jpg'],
        ['Deep evaluation', 'Measure correctness, evidence and resilience.', 'evaluation', '04', 'feature-cyan', FileBarChart, '/assets/evaluation.jpg'],
        ['Model vs agent analysis', 'Find the configuration behind the result.', 'compare', '05', 'feature-green', GitCompareArrows, '/assets/model-agent.jpg'],
        ['Run inspector', 'Explore every observable step and tool call.', 'runs', '06', 'feature-blue', Activity, '/assets/run-inspector.jpg'],
        ['Live web intelligence', 'Search, inspect and save Tavily evidence.', 'research', '07', 'feature-cyan', Globe2, '/assets/web-research.jpg'],
        ['Leaderboard', 'Compare quality, reliability and cost.', 'leaderboard', '08', 'feature-violet', Trophy, '/assets/leaderboard-detail.jpg'],
      ].map(([title, detail, target, no, style, Icon, image]) => <button className={`feature-tile ${style}`} key={title} onClick={() => onNavigate(target)}><img className="feature-art-image" src={image} alt="" loading="lazy" /><div className="feature-index">{no}</div><div className="feature-icon"><Icon size={21} /></div><div className="feature-title">{title}</div><p>{detail}</p><span className="feature-open">Explore <ArrowUpRight size={14} /></span></button>)}
    </div>
    <SectionLabel aside="Latest activity">Recent experiments</SectionLabel>
    <Panel className="table-panel">
      {recent.length ? <div className="table-scroll"><table><thead><tr><th>Experiment</th><th>Mode</th><th>Runs</th><th>Status</th><th>Created</th><th /></tr></thead><tbody>{recent.map((exp) => <tr key={exp.id}><td><b>{exp.title}</b><small className="mono">{short(exp.id)}</small></td><td><Badge tone={exp.mode === 'live' ? 'green' : 'amber'}>{exp.mode}</Badge></td><td>{(exp.agent_ids || []).length * (exp.models || []).length * (exp.task_ids || []).length * exp.repetitions}</td><td><Badge tone={toneForStatus(exp.status)} dot>{exp.status}</Badge></td><td>{relativeTime(exp.created_at)}</td><td><button className="icon-button small" onClick={() => onStart(exp.id)}><ArrowUpRight size={15} /></button></td></tr>)}</tbody></table></div> : <EmptyState title="Your arena is ready" detail="Create your first benchmark to populate this workspace." action={<Button onClick={() => onNavigate('benchmark')}>Create benchmark</Button>} />}
    </Panel>
  </>
}

function BenchmarkPage({ agents, tasks, onLaunch, busy }) {
  const [config, setConfig] = useState(defaultConfig)
  const [formError, setFormError] = useState('')
  const update = (key, value) => setConfig((old) => ({ ...old, [key]: value }))
  const toggleList = (key, value) => update(key, config[key].includes(value) ? config[key].filter((x) => x !== value) : [...config[key], value])
  const toggleFault = (id, value) => update('faults', { ...config.faults, [id]: value })
  const runCount = config.agentIds.length * Math.max(1, config.models.split(',').map((x) => x.trim()).filter(Boolean).length) * config.taskIds.length * config.repetitions
  const launch = async () => {
    setFormError('')
    if (!config.agentIds.length || !config.taskIds.length) return setFormError('Select at least one agent and one task.')
    if (runCount > 80) return setFormError('Keep an experiment to 80 runs or fewer.')
    const models = config.models.split(',').map((x) => x.trim()).filter(Boolean)
    if (!models.length) return setFormError('Enter at least one model route.')
    await onLaunch({ title: config.title, mode: config.mode, suite_id: 'research-10', agent_ids: config.agentIds, models, task_ids: config.taskIds, evidence_mode: config.evidenceMode, repetitions: Number(config.repetitions), severity: Number(config.severity), master_seed: Number(config.masterSeed), faults: config.faults, budgets: config.budgets })
  }
  return <>
    <PageHeading page="benchmark" action={<Badge tone="violet">Research-10 · v1.0</Badge>} />
    <div className="benchmark-layout">
      <div className="benchmark-main">
        <Panel className="form-panel"><PanelHeading title="Experiment setup" detail="Choose the variables. RIFT holds the rest constant." /><div className="form-grid">
          <Field label="Experiment name"><input value={config.title} onChange={(e) => update('title', e.target.value)} placeholder="Research resilience benchmark" /></Field>
          <Field label="Execution mode"><select value={config.mode} onChange={(e) => update('mode', e.target.value)}><option value="demo">Demo · deterministic fixtures</option><option value="live">Live · real providers</option></select></Field>
          <Field label="Model routes" hint="Comma separated Bifrost model names."><input value={config.models} onChange={(e) => update('models', e.target.value)} placeholder="general, fast" /></Field>
          <Field label="Evidence mode"><select value={config.evidenceMode} onChange={(e) => update('evidenceMode', e.target.value)}><option value="snapshot">Snapshot · same evidence for all</option><option value="live">Live · research per run</option></select></Field>
        </div>
        </Panel>
        <Panel className="form-panel"><PanelHeading title="Agent configurations" detail={`${config.agentIds.length} selected`} action={<button className="text-button" onClick={() => update('agentIds', agents.map((a) => a.id))}>Select all</button>} /><div className="choice-grid">{agents.map((agent) => <button type="button" className={`choice-card ${config.agentIds.includes(agent.id) ? 'selected' : ''}`} key={agent.id} onClick={() => toggleList('agentIds', agent.id)}><span className="choice-check">{config.agentIds.includes(agent.id) && <Check size={12} />}</span><span className="agent-avatar"><Bot size={20} /></span><span className="choice-copy"><b>{agent.name}</b><small>{agent.framework} · {agent.kind === 'builtin' ? 'Built in' : 'External adapter'}</small></span></button>)}</div></Panel>
        <Panel className="form-panel"><PanelHeading title="Research-10 task suite" detail={`${config.taskIds.length} tasks selected`} action={<button className="text-button" onClick={() => update('taskIds', tasks.map((t) => t.id))}>Select all 10</button>} /><div className="task-list">{tasks.map((task, i) => <button type="button" key={task.id} className={`task-choice ${config.taskIds.includes(task.id) ? 'selected' : ''}`} onClick={() => toggleList('taskIds', task.id)}><span className="task-number">{String(i + 1).padStart(2, '0')}</span><span className="task-copy"><b>{task.title}</b><small>{task.category} · {task.difficulty}</small></span><Badge tone={task.difficulty === 'Hard' ? 'red' : task.difficulty === 'Easy' ? 'green' : 'blue'}>{task.difficulty}</Badge><span className="choice-check">{config.taskIds.includes(task.id) && <Check size={12} />}</span></button>)}</div></Panel>
        <Panel className="form-panel"><PanelHeading title="Run budgets" detail="Apply the same limits to every run." /><div className="budget-grid">{[['max_steps','Max steps',1,100],['max_tool_calls','Max tool calls',1,100],['timeout_seconds','Timeout (seconds)',10,600]].map(([key, label, min, max]) => <Field label={label} key={key}><input type="number" min={min} max={max} value={config.budgets[key]} onChange={(e) => update('budgets', { ...config.budgets, [key]: Number(e.target.value) })} /></Field>)}<Field label="Max cost per run (USD)"><input type="number" min="0.001" max="100" step="0.001" value={config.budgets.max_cost_usd} onChange={(e) => update('budgets', { ...config.budgets, max_cost_usd: Number(e.target.value) })} /></Field></div></Panel>
      </div>
      <aside className="benchmark-side">
        <Panel className="side-panel"><PanelHeading title="Experiment controls" detail="Matched and repeatable." /><div className="field-stack"><Field label={`Repetitions · ${config.repetitions}×`}><input type="range" min="1" max="5" value={config.repetitions} onChange={(e) => update('repetitions', Number(e.target.value))} /></Field><Field label="Master seed"><input type="number" value={config.masterSeed} onChange={(e) => update('masterSeed', Number(e.target.value))} /></Field><Field label={`Fault severity · ${config.severity}%`}><input type="range" min="0" max="100" step="5" value={config.severity} onChange={(e) => update('severity', Number(e.target.value))} /></Field></div><div className="divider" /><div className="field-stack"><div className="mini-heading">Chaos profile</div>{[['provider','Provider outage','Primary model request may receive a 503.'],['poison','Evidence poisoning','Synthetic adversarial source in selected searches.'],['latency','Network latency','Artificial delay on research tools.']].map(([key, title, detail]) => <div className="switch-row" key={key}><div><b>{title}</b><small>{detail}</small></div><Switch checked={config.faults[key]} onChange={(v) => toggleFault(key, v)} /></div>)}</div><div className="divider" /><div className="run-estimate"><span>Planned executions</span><b>{runCount}</b><small>{config.agentIds.length} agents · {config.taskIds.length} tasks · {config.repetitions} repetitions</small></div>{formError && <div className="form-error">{formError}</div>}<Button className="full-button" icon={Play} disabled={busy} onClick={launch}>{busy ? 'Launching experiment…' : 'Launch benchmark'}</Button><p className="side-footnote">Live mode requires verified Bifrost and Tavily credentials. Provider chaos also requires the upstream fault proxy.</p></Panel>
        <Panel className="callout-panel"><div className="callout-symbol"><ShieldCheck size={19} /></div><b>Fairness by design</b><p>Agents share the same task, evidence snapshot, tool limits and seeded fault decisions.</p></Panel>
      </aside>
    </div>
  </>
}

function AgentsPage({ agents, onCreate, onTest, onDelete, busy }) {
  const [form, setForm] = useState({ name: '', framework: '', model: 'Bifrost default', endpoint: '', description: '' })
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  async function submit(e) { e.preventDefault(); setError(''); try { await onCreate(form); setForm({ name: '', framework: '', model: 'Bifrost default', endpoint: '', description: '' }); setShowForm(false) } catch (err) { setError(err.message) } }
  return <>
    <PageHeading page="agents" action={<Button icon={Plus} onClick={() => setShowForm((v) => !v)}>Register agent</Button>} />
    {showForm && <Panel className="form-panel add-agent-panel"><PanelHeading title="Connect an external agent" detail="Expose a secure HTTP endpoint. Keep the framework unchanged." action={<button className="icon-button" onClick={() => setShowForm(false)}><X size={17} /></button>} /><form onSubmit={submit}><div className="form-grid"><Field label="Agent name"><input required minLength="2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Research agent" /></Field><Field label="Framework"><input value={form.framework} onChange={(e) => setForm({ ...form, framework: e.target.value })} placeholder="LangGraph, CrewAI, custom" /></Field><Field label="Model route"><input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></Field><Field label="Adapter endpoint"><input required type="url" value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} placeholder="https://agent.example/run" /></Field></div><Field label="Description"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does this agent do?" rows="2" /></Field>{error && <div className="form-error">{error}</div>}<div className="form-actions"><Button type="submit" icon={Plus} disabled={busy}>Register agent</Button></div></form></Panel>}
    <div className="agents-grid">{agents.map((agent, index) => <Panel className="agent-panel" key={agent.id}><div className={`agent-art agent-art-${index % 4}`}><span className="agent-orbit" /><span className="agent-avatar-large"><Bot size={28} /></span><Badge tone={agent.kind === 'builtin' ? 'violet' : 'green'}>{agent.kind === 'builtin' ? 'Native agent' : 'External adapter'}</Badge></div><div className="agent-info"><div className="agent-name-row"><div><h3>{agent.name}</h3><span>{agent.framework}</span></div><Badge tone="blue">{agent.strategy || 'webhook'}</Badge></div><p>{agent.description || 'A connected agent configuration.'}</p><div className="agent-meta"><span><Cpu size={13} /> {agent.model || 'External model'}</span><span><Radio size={13} /> {agent.kind === 'builtin' ? 'Ready' : 'Endpoint adapter'}</span></div><div className="agent-actions"><Button size="sm" variant="secondary" onClick={() => onTest(agent.id)}><Activity size={14} /> Test connection</Button>{agent.kind !== 'builtin' && <button className="icon-button danger-button" onClick={() => onDelete(agent.id)} title="Remove agent"><Trash2 size={15} /></button>}</div></div></Panel>)}</div>
    <Panel className="adapter-note"><div className="adapter-note-icon"><Command size={19} /></div><div><b>Framework independent by contract</b><p>RIFT sends a task envelope and collects the final answer plus observable events. Agent planning, memory and framework stay in your own service.</p></div><a href="/guides/AGENT_ADAPTER.md" target="_blank" rel="noreferrer">Adapter guide <ExternalLink size={13} /></a></Panel>
  </>
}

function ResearchPage() {
  const [query, setQuery] = useState('Compare current AI agent observability platforms and cite official documentation')
  const [mode, setMode] = useState('demo')
  const [depth, setDepth] = useState('advanced')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [snapshots, setSnapshots] = useState([])

  const refreshSnapshots = useCallback(async () => {
    try {
      const data = await api('/research/snapshots?limit=12')
      setSnapshots(data.snapshots || [])
    } catch (e) { setError(e.message) }
  }, [])
  useEffect(() => { refreshSnapshots() }, [refreshSnapshots])

  const runSearch = async (event) => {
    event?.preventDefault?.()
    if (query.trim().length < 4) return setError('Enter a more specific research question.')
    setLoading(true); setError('')
    try {
      const data = await api('/research/search', { method: 'POST', body: JSON.stringify({ query: query.trim(), mode, search_depth: depth, max_results: 6 }) })
      setResult(data)
      await refreshSnapshots()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const openSnapshot = async (id) => {
    setLoading(true); setError('')
    try {
      const data = await api(`/research/snapshots/${id}`)
      setResult(data); setQuery(data.query); setMode(data.mode)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const sourceHost = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, '') } catch { return 'Source' }
  }

  return <>
    <PageHeading page="research" action={<Badge tone={mode === 'live' ? 'green' : 'amber'} dot>{mode === 'live' ? 'Live Tavily search' : 'Offline preview'}</Badge>} />
    <section className="research-hero">
      <div className="research-hero-copy">
        <div className="hero-kicker"><span className="live-dot" /> EVIDENCE WORKSPACE</div>
        <h2>Find the signal.<br /><em>Keep the evidence.</em></h2>
        <p>Run live Tavily searches, inspect source passages and preserve a versioned evidence snapshot for your research workflow.</p>
        <div className="hero-tags"><Badge tone="cyan">Tavily Search</Badge><Badge tone="violet">Evidence snapshots</Badge><Badge tone="green">Source inspection</Badge></div>
      </div>
      <div className="research-orbit-art"><div className="research-orbit-ring ring-one"/><div className="research-orbit-ring ring-two"/><div className="research-globe"><Globe2 size={74}/></div><div className="research-float-card card-a"><Search size={15}/><span>Search</span></div><div className="research-float-card card-b"><FileText size={15}/><span>Evidence</span></div><div className="research-float-card card-c"><ShieldCheck size={15}/><span>Snapshot</span></div></div>
    </section>
    <div className="research-layout">
      <div className="research-main-column">
        <Panel className="research-query-panel">
          <PanelHeading title="New research" detail="Choose the environment and run a source search." />
          <form onSubmit={runSearch}>
            <Field label="Research question"><textarea rows="3" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What do you want to investigate?" /></Field>
            <div className="research-controls">
              <Field label="Search mode"><select value={mode} onChange={(e) => setMode(e.target.value)}><option value="demo">Demo · synthetic fixtures</option><option value="live">Live · Tavily API</option></select></Field>
              <Field label="Search depth"><select value={depth} onChange={(e) => setDepth(e.target.value)}><option value="basic">Basic</option><option value="advanced">Advanced</option></select></Field>
              <Button icon={Search} type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search sources'}</Button>
            </div>
          </form>
          <div className="research-suggestions"><span>Try</span>{['Latest AI gateway releases', 'MCP security best practices', 'Agent observability benchmarks'].map((item) => <button type="button" key={item} onClick={() => setQuery(item)}>{item}</button>)}</div>
          {error && <div className="form-error">{error}</div>}
        </Panel>
        {result ? <>
          <div className="research-result-heading"><div><div className="eyebrow">{result.provider || 'Evidence results'}</div><h2>Research sources</h2><p>{result.query}</p></div><div className="research-result-meta"><Badge tone={result.simulated ? 'amber' : 'green'}>{result.simulated ? 'Synthetic preview' : 'Live web results'}</Badge><span>{result.source_count ?? result.sources?.length ?? 0} sources · {result.latency_ms != null ? `${result.latency_ms} ms` : 'Saved snapshot'}</span></div></div>
          {result.answer && <Panel className="research-answer"><div className="answer-mark"><Sparkles size={18}/></div><div><b>Search overview</b><p>{result.answer}</p></div></Panel>}
          <div className="research-sources">{(result.sources || []).map((source, index) => <Panel className="research-source" key={`${source.url}-${index}`}><div className="source-topline"><span className="source-number">{String(index + 1).padStart(2, '0')}</span><Badge tone={source.synthetic ? 'amber' : 'cyan'}>{source.synthetic ? 'Demo fixture' : 'Tavily source'}</Badge>{source.score != null && <span className="source-score">Relevance {Math.round(source.score * 100)}%</span>}</div><h3>{source.title || 'Untitled source'}</h3><div className="source-domain"><Globe2 size={13}/>{sourceHost(source.url)}{source.published_date ? ` · ${source.published_date}` : ''}</div><p>{source.content || 'No extracted passage returned.'}</p><div className="source-actions">{!source.synthetic && source.url && <a href={source.url} target="_blank" rel="noreferrer">Open source <ExternalLink size={13}/></a>}<span>{source.source || result.provider}</span></div></Panel>)}</div>
          <Panel className="snapshot-proof"><div className="snapshot-symbol"><Database size={19}/></div><div><b>Evidence snapshot saved</b><p>Hash: <code>{result.evidence_hash}</code></p></div><Badge tone="green">Preserved</Badge></Panel>
        </> : <Panel className="research-empty"><EmptyState icon={Globe2} title="Your evidence workspace is ready" detail="Run a search to inspect source passages and save an evidence snapshot." action={<Button size="sm" onClick={runSearch} disabled={loading}>Run sample search</Button>} /></Panel>}
      </div>
      <aside className="research-side-column">
        <Panel className="snapshot-list-panel"><PanelHeading title="Saved snapshots" detail={`${snapshots.length} preserved searches`} action={<button className="icon-button small" onClick={refreshSnapshots}><RefreshCw size={14}/></button>} />{snapshots.length ? <div className="snapshot-list">{snapshots.map((item) => <button type="button" className={`snapshot-item ${result?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => openSnapshot(item.id)}><span className="snapshot-item-icon"><FileText size={15}/></span><span><b>{item.query}</b><small>{item.provider} · {relativeTime(item.created_at)}</small></span><ChevronRight size={15}/></button>)}</div> : <EmptyState icon={Database} title="No snapshots yet" detail="Search results are preserved here." />}</Panel>
        <Panel className="research-note"><div className="research-note-icon"><ShieldCheck size={18}/></div><b>Evidence, not assumptions</b><p>Relevance scores are supplied by Tavily. They do not prove source credibility or factual correctness. RIFT evaluates claims separately during benchmarks.</p></Panel>
        <Panel className="research-metric"><span>Connected research provider</span><div><Globe2 size={17}/><b>Tavily Search</b><Badge tone="info">API</Badge></div><small>Credentials stay on the backend.</small></Panel>
      </aside>
    </div>
  </>
}

function ChaosPage({ onLaunch, busy }) {
  const [faults, setFaults] = useState({ provider: true, poison: true, latency: true })
  const [severity, setSeverity] = useState(50)
  const [seed, setSeed] = useState(42017)
  const [mode, setMode] = useState('demo')
  const [error, setError] = useState('')
  const faultsMeta = [
    { id: 'provider', title: 'Provider outage', desc: 'Simulate a primary model route returning 503.', icon: Server, color: 'red', stat: `${severity}%`, metric: 'Eligible requests' },
    { id: 'poison', title: 'Evidence poisoning', desc: 'Append a controlled adversarial source to research results.', icon: ShieldEllipsis, color: 'violet', stat: `${severity}%`, metric: 'Search batches' },
    { id: 'latency', title: 'Network latency', desc: 'Inject deterministic delay into Tavily calls.', icon: Timer, color: 'amber', stat: `${(4 * severity / 100).toFixed(1)}s`, metric: 'Added delay' },
  ]
  async function run() { setError(''); try { await onLaunch({ title: 'DOOMSDAY RUN · chaos profile', mode, suite_id: 'research-10', agent_ids: ['agent-react', 'agent-planner'], models: ['general'], task_ids: ['research-001', 'research-009'], evidence_mode: 'snapshot', repetitions: 1, severity, master_seed: seed, faults, budgets: { max_steps: 20, max_tool_calls: 15, timeout_seconds: 120, max_cost_usd: 0.1 } }) } catch (e) { setError(e.message) } }
  return <>
    <PageHeading page="chaos" action={<Badge tone="red" dot>Controlled fault injection</Badge>} />
    <div className="chaos-hero"><div><div className="eyebrow">DOOMSDAY PROTOCOL</div><h2>Real agents.<br /><em>Uncomfortable conditions.</em></h2><p>Inject failures into isolated benchmark traffic. Keep every agent on the same seeded schedule.</p><div className="hero-tags"><Badge tone="red">Provider 503</Badge><Badge tone="violet">Adversarial evidence</Badge><Badge tone="amber">Network delay</Badge></div></div><div className="chaos-reactor"><div className="reactor-ring ring-a" /><div className="reactor-ring ring-b" /><div className="reactor-core"><AlertTriangle size={35} /></div><span className="reactor-sparks">✦ · · ✦</span></div></div>
    <div className="chaos-grid">{faultsMeta.map(({ id, title, desc, icon: Icon, color, stat, metric }) => <Panel className={`fault-card fault-${color}`} key={id}><div className="fault-card-top"><span className="fault-icon"><Icon size={20} /></span><Switch checked={faults[id]} onChange={(v) => setFaults({ ...faults, [id]: v })} /></div><h3>{title}</h3><p>{desc}</p><div className="fault-stat"><b>{stat}</b><span>{metric}</span></div><Badge tone={faults[id] ? color : 'muted'} dot>{faults[id] ? 'Enabled' : 'Disabled'}</Badge></Panel>)}</div>
    <div className="chaos-layout"><Panel className="form-panel"><PanelHeading title="Fault profile" detail="Intensity resolves to explicit, auditable settings." /><div className="severity-head"><span>Fault severity</span><b>{severity}%</b></div><input type="range" min="0" max="100" step="5" value={severity} onChange={(e) => setSeverity(Number(e.target.value))} /><div className="range-ends"><span>Low impact</span><span>Severe</span></div><div className="fault-resolution"><div><span>Provider failure rate</span><b>{severity}%</b></div><div><span>Poisoned search batches</span><b>{severity}%</b></div><div><span>Research call delay</span><b>{(4 * severity / 100).toFixed(1)} sec</b></div></div></Panel><Panel className="form-panel"><PanelHeading title="Reproducibility" detail="Repeat the exact fault schedule." /><Field label="Execution mode"><select value={mode} onChange={(e) => setMode(e.target.value)}><option value="demo">Demo · safe synthetic environment</option><option value="live">Live · real providers</option></select></Field><Field label="Master seed"><input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} /></Field><div className="seed-note"><Database size={16} /><span>Agent identity is excluded from fault schedule generation. Matched agents receive the same planned faults.</span></div><div className="safety-note"><ShieldCheck size={17} /><span>Faults run through RIFT controlled proxies and synthetic evidence fixtures. Live provider chaos requires a dedicated Bifrost test route.</span></div>{error && <div className="form-error">{error}</div>}<Button className="full-button" icon={Zap} disabled={busy || !Object.values(faults).some(Boolean)} onClick={run}>{busy ? 'Preparing chaos run…' : 'Launch DOOMSDAY RUN'}</Button></Panel></div>
  </>
}

function EventItem({ event, active = false }) {
  const type = event.event_type || event.type || 'event'
  const payload = event.payload || event.data || {}
  const danger = /failed|fault|poison|latency/.test(type)
  const good = /completed|recovered/.test(type)
  return <div className={`event-item ${active ? 'event-active' : ''}`}><span className={`event-indicator ${danger ? 'danger' : good ? 'good' : ''}`} /><div className="event-info"><b>{type.replaceAll('.', ' ')}</b><small>{payload.label || payload.tool || payload.provider || payload.step || payload.message || payload.status || 'Execution event'}</small></div><time>{event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : '—'}</time></div>
}

function ArenaPage({ experiment, events, runs, activeFault, onReplay, onPause, paused, onNavigate, replayMode = false, replayCursor = 0, replayTotal = 0, onReplaySeek }) {
  const faultCount = events.filter((e) => /failed|fault|poison|latency/.test(e.event_type || '')).length
  const currentRun = experiment?.runs?.find((r) => r.status === 'running') || experiment?.runs?.[experiment.runs.length - 1]
  return <>
    <PageHeading page="arena" action={<div className="arena-toolbar"><Badge tone={experiment ? 'green' : 'muted'} dot>{experiment ? experiment.status : 'Awaiting run'}</Badge><Button variant="secondary" size="sm" icon={RefreshCw} onClick={onReplay}>Replay run</Button></div>} />
    <div className="arena-header-strip"><div><span className="eyebrow">RIFT DIGITAL TWIN</span><b>{experiment?.title || 'Simulation environment'}</b><small>{experiment ? `${experiment.runs?.length || 0} executions · ${events.length} captured events` : 'Launch a benchmark to see agents move through the research network.'}</small></div><div className="arena-readouts"><div><span>Events</span><b>{events.length}</b></div><div><span>Faults</span><b className="text-red">{faultCount}</b></div><div><span>Current run</span><b>{currentRun ? short(currentRun.id) : '—'}</b></div></div></div>
    <div className="arena-layout"><div className="arena-main"><div className="arena-stage"><div className="arena-stage-top"><div className="stage-legend"><span><i className="legend-model" /> Bifrost</span><span><i className="legend-research" /> Tavily</span><span><i className="legend-agent" /> Agents</span><span><i className="legend-fault" /> Faults</span></div><Badge tone={replayMode ? 'violet' : 'green'} dot>{replayMode ? 'Recorded replay' : 'Live event stream'}</Badge></div><Arena3D events={events} fault={activeFault} paused={paused} /><div className="arena-stage-bottom"><div><span className="live-pulse" /> {replayMode ? 'RECORDED EXECUTION' : 'REAL-TIME EXECUTION'}</div><div className="stage-controls"><button onClick={onPause}>{paused ? <Play size={14} /> : <Pause size={14} />}{paused ? 'Resume' : 'Pause'}</button><button onClick={onReplay}><RefreshCw size={14} /> Replay</button></div></div>{replayMode && <div className="replay-scrubber"><span>{replayCursor} / {replayTotal} events</span><input aria-label="Replay position" type="range" min="0" max={Math.max(1, replayTotal)} value={Math.min(replayCursor, replayTotal)} onChange={(e) => onReplaySeek?.(Number(e.target.value))} /><span>{replayTotal ? `${Math.round(replayCursor / replayTotal * 100)}%` : '0%'}</span></div>}</div><div className="arena-run-strip"><div><span>Active experiment</span><b>{experiment?.id || 'No experiment selected'}</b></div><div><span>Evidence mode</span><b>{experiment?.evidence_mode || 'Snapshot'}</b></div><div><span>Fault severity</span><b>{experiment?.severity ?? 0}%</b></div><div><span>Master seed</span><b>{experiment?.master_seed ?? '—'}</b></div></div></div>
      <Panel className="event-panel"><PanelHeading title="Execution stream" detail="Recorded backend events" action={<Badge tone="blue">{events.length}</Badge>} /><div className="event-list">{events.slice(-16).reverse().map((event, i) => <EventItem key={event.id || `${event.sequence}-${i}`} event={event} active={i === 0} />)}{!events.length && <EmptyState icon={Radio} title="Waiting for execution" detail="Launch a benchmark to stream agent, model and tool events." action={<Button size="sm" onClick={() => onNavigate('benchmark')}>Open Benchmark Lab</Button>} />}</div></Panel>
    </div>
    {experiment && <Panel className="recent-run-panel"><PanelHeading title="Experiment runs" detail="Select a run to inspect the full trace." action={<Button size="sm" variant="secondary" onClick={() => onNavigate('runs')}>Open inspector <ArrowRight size={14} /></Button>} /><div className="run-chip-row">{(experiment.runs || []).slice(0, 8).map((run) => <div className="run-chip" key={run.id}><span className={`tiny-status ${toneForStatus(run.status)}`} /><b>{short(run.agent_id)}</b><small>{run.task_id}</small><Badge tone={toneForStatus(run.status)}>{run.status}</Badge></div>)}</div></Panel>}
  </>
}

function RunsPage({ runs, selectedRun, onSelectRun, onCancel, onExport }) {
  const [search, setSearch] = useState('')
  const filtered = runs.filter((run) => `${run.id} ${run.agent_name} ${run.experiment_title} ${run.task_id}`.toLowerCase().includes(search.toLowerCase()))
  const result = selectedRun?.result || {}
  return <>
    <PageHeading page="runs" action={<Field label="Search runs"><div className="search-input"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Agent, task or run ID" /></div></Field>} />
    <div className="inspector-layout"><Panel className="run-list-panel"><PanelHeading title="Recorded runs" detail={`${filtered.length} executions`} /><div className="run-table-list">{filtered.map((run) => <button className={`run-list-item ${selectedRun?.id === run.id ? 'selected' : ''}`} key={run.id} onClick={() => onSelectRun(run.id)}><div className="run-list-top"><b>{run.agent_name || run.agent_id}</b><Badge tone={toneForStatus(run.status)}>{run.status}</Badge></div><span>{run.experiment_title || 'Experiment'} · {run.task_id}</span><small>{short(run.id)} · {relativeTime(run.started_at)}</small></button>)}{!filtered.length && <EmptyState title="No runs found" detail="Launch a benchmark to create execution records." />}</div></Panel>
      <div className="inspector-detail">{selectedRun ? <>
        <Panel className="detail-hero"><div><div className="eyebrow">RUN / {short(selectedRun.id)}</div><h2>{selectedRun.agent_name || selectedRun.agent_id}</h2><p>{selectedRun.task_id} · {selectedRun.model}</p></div><div className="detail-hero-actions"><Badge tone={toneForStatus(selectedRun.status)} dot>{selectedRun.status}</Badge><Button size="sm" variant="secondary" icon={Download} onClick={() => onExport?.(selectedRun.experiment_id)}>Export experiment</Button></div></Panel>
        <div className="stats-grid detail-stats"><StatCard icon={Gauge} label="Quality" value={percent(result.quality == null ? null : result.quality * 100)} detail="Scored response" accent="blue" /><StatCard icon={Clock3} label="Latency" value={result.latency_ms == null ? '—' : `${(result.latency_ms / 1000).toFixed(2)}s`} detail="End-to-end" accent="cyan" /><StatCard icon={Network} label="Tool calls" value={number(result.tool_calls)} detail="Observable calls" accent="violet" /><StatCard icon={DollarSignIcon} label="Total cost" value={money(result.total_cost_usd)} detail="Unpriced if rates missing" accent="green" /></div>
        <Panel className="output-panel"><PanelHeading title="Agent response" detail="Final answer and evidence" />{result.output ? <div className="response-output">{result.output}</div> : <EmptyState title="No final response" detail={result.error || 'This run has not produced a result.'} />}{result.sources?.length > 0 && <div className="source-row">{result.sources.map((s, i) => <a href={s.url} target="_blank" rel="noreferrer" key={`${s.url}-${i}`}><Globe2 size={12} />{s.title || s.url}<ExternalLink size={11} /></a>)}</div>}</Panel>
        <Panel className="timeline-panel"><PanelHeading title="Execution timeline" detail={`${selectedRun.events?.length || 0} events · ordered by sequence`} />{selectedRun.events?.length ? <div className="timeline-list">{selectedRun.events.map((event, i) => <EventItem key={event.id || i} event={event} />)}</div> : <EmptyState title="No events captured" detail="Events appear as the agent executes observable actions." />}</Panel>
        {result.error && <div className="form-error">{result.error}</div>}
        {selectedRun.status === 'running' && <Button variant="danger" size="sm" onClick={() => onCancel(selectedRun.id)}><Square size={13} /> Cancel run</Button>}
      </> : <Panel className="inspector-empty"><EmptyState icon={FileText} title="Select a run" detail="Choose an execution from the left to inspect its output, evidence and event timeline." /></Panel>}</div>
    </div>
  </>
}
function DollarSignIcon() { return <span className="dollar-icon" aria-hidden="true">$</span> }

function EvaluationPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setData(await api('/evaluation/summary')) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])
  const quality = data?.quality_avg
  const metrics = [
    ['Answer quality', data?.quality_avg, 'Quality score', 'blue'],
    ['Evidence coverage', data?.evidence_avg, 'Source coverage and support', 'cyan'],
    ['Citation integrity', data?.citation_integrity_avg, 'Cited source validation', 'violet'],
    ['Task success', data?.success_rate, 'Verified task outcomes', 'green'],
  ]
  return <>
    <PageHeading page="evaluation" action={<Button icon={RefreshCw} variant="secondary" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh metrics'}</Button>} />
    {error && <div className="form-error">{error}</div>}
    {loading && !data ? <Panel><div className="loading-line"><span/>Loading evaluation records…</div></Panel> : data?.total_runs ? <>
      <section className="evaluation-hero">
        <div><div className="eyebrow">RIFT EVALUATION ENGINE</div><h2>Performance is more<br/><em>than a final answer.</em></h2><p>Every metric comes from completed benchmark records. Missing pricing or telemetry stays unavailable.</p></div>
        <div className="evaluation-hero-score"><span>OVERALL QUALITY</span><b>{quality ?? '—'}<small>{quality == null ? '' : '%'}</small></b><div className="evaluation-ring" style={{'--score': `${quality || 0}%`}}><span>{data.total_runs}</span><small>runs</small></div></div>
      </section>
      <div className="stats-grid evaluation-stat-grid">
        <StatCard icon={FileBarChart} label="Answer quality" value={percent(data.quality_avg)} detail="Rubric and evidence score" accent="blue"/>
        <StatCard icon={Globe2} label="Evidence coverage" value={percent(data.evidence_avg)} detail="Research source support" accent="cyan"/>
        <StatCard icon={ShieldCheck} label="Citation integrity" value={percent(data.citation_integrity_avg)} detail="Trusted citations" accent="violet"/>
        <StatCard icon={Activity} label="Successful runs" value={`${data.successes}/${data.total_runs}`} detail={`${percent(data.success_rate)} completion rate`} accent="green"/>
      </div>
      <div className="evaluation-grid">
        <Panel className="evaluation-panel"><PanelHeading title="Task quality" detail="Average measured quality by benchmark task."/><div className="evaluation-bars">{data.by_task?.map((task) => <div className="evaluation-bar-row" key={task.task_id}><div><b>{task.task_id}</b><small>{task.runs} runs · {percent(task.success_rate)} success</small></div><div className="evaluation-track"><i style={{width: `${Math.max(0,Math.min(100,(task.quality_avg || 0)*100))}%`}}/></div><strong>{percent(task.quality_avg == null ? null : task.quality_avg*100)}</strong></div>)}</div></Panel>
        <Panel className="evaluation-panel"><PanelHeading title="Execution efficiency" detail="Measured across completed runs."/><div className="evaluation-kpi-list"><div><span>Average execution</span><b>{data.latency_avg_ms == null ? '—' : `${(data.latency_avg_ms/1000).toFixed(2)}s`}</b></div><div><span>Average steps</span><b>{data.steps_avg == null ? '—' : data.steps_avg.toFixed(1)}</b></div><div><span>Average tool calls</span><b>{data.tool_calls_avg == null ? '—' : data.tool_calls_avg.toFixed(1)}</b></div><div><span>Average tokens</span><b>{data.tokens_avg == null ? '—' : number(Math.round(data.tokens_avg))}</b></div><div><span>Total measured cost</span><b>{money(data.total_cost_usd)}</b></div><div><span>Cost per verified success</span><b>{money(data.cost_per_success_usd)}</b></div></div><div className="evaluation-footnote">{data.cost_complete ? 'All runs have configured pricing.' : 'Cost stays unavailable when any run lacks provider or tool pricing.'}</div></Panel>
        <Panel className="evaluation-panel"><PanelHeading title="Resilience under chaos" detail="Recovery metrics use runs where a fault was actually exercised."/><div className="resilience-metrics"><div className="resilience-metric"><span>Provider recovery</span><b>{percent(data.provider_recovery_pct)}</b><small>{data.provider_fault_runs} provider-fault runs</small><ProgressBar value={data.provider_recovery_pct || 0} color="blue"/></div><div className="resilience-metric"><span>Poison resistance</span><b>{percent(data.poison_resistance_pct)}</b><small>{data.poison_runs} poisoned runs</small><ProgressBar value={data.poison_resistance_pct || 0} color="violet"/></div><div className="resilience-metric"><span>Average injected delay</span><b>{data.avg_added_latency_ms == null ? '—' : `${(data.avg_added_latency_ms/1000).toFixed(2)}s`}</b><small>{data.latency_fault_runs} latency-fault runs</small><ProgressBar value={Math.min(100,(data.avg_added_latency_ms || 0)/4000*100)} color="amber"/></div></div></Panel>
        <Panel className="evaluation-panel"><PanelHeading title="Configuration performance" detail="Matched configuration summaries."/><div className="evaluation-config-list">{(data.by_agent || []).map((item) => <div className="evaluation-config" key={`${item.agent_id}-${item.model}`}><span className="agent-avatar"><Bot size={17}/></span><div><b>{item.agent_name}</b><small>{item.framework} · {item.model}</small><ProgressBar value={item.quality_avg == null ? 0 : item.quality_avg*100}/></div><strong>{percent(item.quality_avg == null ? null : item.quality_avg*100)}</strong></div>)}</div></Panel>
      </div>
    </> : <Panel><EmptyState icon={FileBarChart} title="No evaluation data yet" detail="Run a benchmark to populate quality, evidence, efficiency and resilience metrics." action={<Button onClick={() => { location.hash = 'benchmark' }}>Open Benchmark Lab</Button>}/></Panel>}
  </>
}

function ComparePage({ experiments }) {
  const [experimentId, setExperimentId] = useState(experiments[0]?.id || '')
  useEffect(() => { if (!experimentId && experiments[0]?.id) setExperimentId(experiments[0].id) }, [experiments, experimentId])
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (!experimentId) return; let active = true; setLoading(true); setError(''); api(`/experiments/${experimentId}/report`).then((data) => { if (active) setReport(data) }).catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [experimentId])
  const results = report?.results || []
  return <>
    <PageHeading page="compare" action={<Field label="Experiment"><select value={experimentId} onChange={(e) => setExperimentId(e.target.value)}>{experiments.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></Field>} />
    {loading ? <Panel><div className="loading-line"><span /> Loading experiment report…</div></Panel> : error ? <div className="form-error">{error}</div> : results.length ? <>
      <Panel className="compare-intro"><div><div className="eyebrow">MATCHED EXPERIMENT</div><h2>Performance is a system property.</h2><p>Compare agent and model configurations against shared tasks, budgets and seeded conditions.</p></div><div className="compare-intro-mark"><GitCompareArrows size={30} /></div></Panel>
      <Panel className="compare-panel"><PanelHeading title="Agent configuration comparison" detail="Higher quality is better. Cost stays separate from quality." /><div className="compare-legend"><span><i className="bar-quality" /> Average quality</span><span><i className="bar-success" /> Task success</span></div><div className="compare-bars">{results.map((item) => <div className="compare-row" key={`${item.agent_id}-${item.model}`}><div className="compare-name"><b>{item.agent}</b><small>{item.model}</small></div><div className="compare-bar-stack"><div className="bar-line"><span className="bar-label">Quality</span><div className="bar-track"><i className="bar-quality" style={{ width: `${item.quality_avg || 0}%` }} /></div><b>{percent(item.quality_avg)}</b></div><div className="bar-line"><span className="bar-label">Success</span><div className="bar-track"><i className="bar-success" style={{ width: `${item.success_rate || 0}%` }} /></div><b>{percent(item.success_rate)}</b></div></div><div className="compare-cost"><span>Cost / verified success</span><b>{money(item.cost_per_success_usd)}</b></div></div>)}</div></Panel>
      <div className="stats-grid"><StatCard icon={ShieldCheck} label="Best success" value={percent(Math.max(...results.map((r) => r.success_rate || 0)))} detail="Among tested configurations" accent="green" /><StatCard icon={Clock3} label="Fastest average" value={results.some((r) => r.latency_avg_ms != null) ? `${(Math.min(...results.map((r) => r.latency_avg_ms).filter((x) => x != null)) / 1000).toFixed(2)}s` : '—'} detail="End-to-end latency" accent="cyan" /><StatCard icon={Globe2} label="Best evidence" value={percent(Math.max(...results.map((r) => r.evidence_score_avg || 0)))} detail="Evidence quality" accent="blue" /><StatCard icon={DollarSignIcon} label="Lowest cost / success" value={results.some((r) => r.cost_per_success_usd != null) ? money(Math.min(...results.map((r) => r.cost_per_success_usd).filter((x) => x != null))) : '—'} detail="Only priced runs included" accent="violet" /></div>
      <Panel className="table-panel comparison-detail"><PanelHeading title="Execution quality breakdown" detail="Use matched models to isolate agent strategy, or matched agents to isolate model effects." /><div className="table-scroll"><table><thead><tr><th>Configuration</th><th>Evidence</th><th>Citation integrity</th><th>Consistency</th><th>Steps</th><th>Tool calls</th><th>Tokens</th><th>Latency</th><th>Poison resistance</th><th>Provider recovery</th></tr></thead><tbody>{results.map((item) => <tr key={`detail-${item.agent_id}-${item.model}`}><td><b>{item.agent}</b><small>{item.framework} · {item.model}</small></td><td>{percent(item.evidence_score_avg)}</td><td>{percent(item.citation_integrity_avg)}</td><td>{item.quality_stddev == null ? '—' : `±${item.quality_stddev} pp`}</td><td>{number(item.steps_avg)}</td><td>{number(item.tool_calls_avg)}</td><td>{number(item.tokens_avg)}</td><td>{item.latency_avg_ms == null ? '—' : `${(item.latency_avg_ms / 1000).toFixed(2)}s`}</td><td>{percent(item.poison_resistance)}</td><td>{percent(item.provider_recovery)}</td></tr>)}</tbody></table></div></Panel>
      <Panel className="attribution-panel"><div className="attribution-mark"><GitCompareArrows size={20} /></div><div><b>Read the experiment, not just the ranking.</b><p>Compare different agents using the same model to understand strategy effects. Compare multiple models within one agent to understand model effects. Repeat runs and quality spread help reveal consistency, not just peak performance.</p></div></Panel>
    </> : <Panel><EmptyState title="No comparison data yet" detail="Complete a benchmark experiment with at least one agent and task." /></Panel>}
  </>
}

function LeaderboardPage({ entries, onRefresh }) {
  const best = entries[0]
  return <>
    <PageHeading page="leaderboard" action={<Button variant="secondary" icon={RefreshCw} onClick={onRefresh}>Refresh</Button>} />
    {best && <div className="leader-hero"><div><div className="eyebrow">CURRENT FRONT RUNNER</div><h2>{best.name}</h2><p>{best.framework} · {best.model}</p><div className="leader-hero-stats"><div><b>{percent(best.success_rate)}</b><span>Success</span></div><div><b>{best.quality}%</b><span>Quality</span></div><div><b>{money(best.cost_per_success_usd)}</b><span>Cost / success</span></div></div></div><div className="leader-cup"><Trophy size={54} /></div></div>}
    <Panel className="table-panel"><PanelHeading title="Agent leaderboard" detail="Completed benchmark runs only. Incomplete and unpriced values remain visible as unavailable." /><div className="table-scroll"><table><thead><tr><th>Rank</th><th>Configuration</th><th>Runs</th><th>Success</th><th>Quality</th><th>Latency</th><th>Cost / success</th><th>Recovery</th></tr></thead><tbody>{entries.map((entry, i) => <tr key={`${entry.agent_id}-${entry.model}`}><td><span className={`rank-mark rank-${i + 1}`}>{String(i + 1).padStart(2, '0')}</span></td><td><b>{entry.name}</b><small>{entry.framework} · {entry.model}</small></td><td>{entry.runs}</td><td><b>{percent(entry.success_rate)}</b></td><td>{entry.quality}%</td><td>{(entry.avg_latency_ms / 1000).toFixed(2)}s</td><td>{money(entry.cost_per_success_usd)}</td><td>{percent(entry.provider_recovery_pct)}</td></tr>)}</tbody></table></div>{!entries.length && <EmptyState icon={Trophy} title="No ranked runs yet" detail="Complete a benchmark before the leaderboard can rank an agent." />}</Panel>
  </>
}

function SettingsPage({ integrations, onTest, checking, health }) {
  const [copied, setCopied] = useState('')
  async function copy(value, label) { await navigator.clipboard?.writeText(value); setCopied(label); setTimeout(() => setCopied(''), 1800) }
  return <>
    <PageHeading page="settings" action={<Button icon={RefreshCw} variant="secondary" onClick={onTest} disabled={checking}>{checking ? 'Verifying…' : 'Verify integrations'}</Button>} />
    <div className="settings-grid"><Panel className="integration-panel"><PanelHeading title="Connected services" detail="Credentials remain on the backend." /><div className="integration-row"><span className="integration-logo bifrost-logo"><Network size={20} /></span><div className="integration-copy"><b>Bifrost AI Gateway</b><small>{integrations?.bifrost?.base_url || 'Base URL not configured'} · {integrations?.bifrost?.model || 'Model route not set'}</small></div><Badge tone={integrations?.bifrost?.configured ? 'green' : 'amber'} dot>{integrations?.bifrost?.configured ? 'Configured' : 'Missing'}</Badge></div><div className="integration-row"><span className="integration-logo tavily-logo"><Globe2 size={20} /></span><div className="integration-copy"><b>Tavily Research</b><small>{integrations?.tavily?.base_url || 'https://api.tavily.com'}</small></div><Badge tone={integrations?.tavily?.configured ? 'green' : 'amber'} dot>{integrations?.tavily?.configured ? 'Configured' : 'Missing'}</Badge></div><div className="integration-row"><span className="integration-logo db-logo"><Database size={20} /></span><div className="integration-copy"><b>Database</b><small>{integrations?.database?.type || health?.database || 'Local SQLite fallback'}</small></div><Badge tone={integrations?.database?.type === 'neon-postgres' ? 'green' : 'amber'} dot>{integrations?.database?.type === 'neon-postgres' ? 'Neon connected' : 'Local mode'}</Badge></div><div className="verify-results">{health && <div className="verify-chip"><Check size={14} /> API reachable · {health.status}</div>}{integrations?.mode && <div className="verify-chip"><Radio size={14} /> {integrations.mode}</div>}</div></Panel>
      <Panel className="setup-panel"><PanelHeading title="Environment setup" detail="Add these values to backend/.env, then restart FastAPI." /><div className="env-snippet"><div><span>DATABASE_URL</span><code>postgresql://USER:PASSWORD@HOST/DB?sslmode=require</code><button onClick={() => copy('DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require', 'database')}><Copy size={14} /></button></div><div><span>BIFROST_BASE_URL</span><code>http://localhost:8080/v1</code><button onClick={() => copy('BIFROST_BASE_URL=http://localhost:8080/v1', 'bifrost')}><Copy size={14} /></button></div><div><span>BIFROST_API_KEY</span><code>your Bifrost virtual key</code><button onClick={() => copy('BIFROST_API_KEY=', 'key')}><Copy size={14} /></button></div><div><span>BIFROST_MODEL</span><code>general</code><button onClick={() => copy('BIFROST_MODEL=general', 'model')}><Copy size={14} /></button></div><div><span>TAVILY_API_KEY</span><code>tvly-your-key</code><button onClick={() => copy('TAVILY_API_KEY=', 'tavily')}><Copy size={14} /></button></div></div>{copied && <div className="copy-state">Copied {copied === 'database' ? 'database template' : copied} variable.</div>}<div className="setup-tip"><ShieldCheck size={16} /><span>Never paste provider secrets into frontend code or commit your .env file. The app reads credentials on the server only.</span></div><div className="setup-links"><a href="https://neon.tech/docs/get-started/connect-neon" target="_blank" rel="noreferrer">Neon connection guide <ExternalLink size={13} /></a><a href="https://docs.getbifrost.ai" target="_blank" rel="noreferrer">Bifrost docs <ExternalLink size={13} /></a><a href="https://docs.tavily.com" target="_blank" rel="noreferrer">Tavily docs <ExternalLink size={13} /></a></div></Panel>
      <Panel className="setup-panel full-span"><PanelHeading title="Usage and evaluation" detail="Keep benchmark reports interpretable." /><div className="settings-info-grid"><div><b>Cost calculation</b><p>Set model input and output price per million tokens, plus Tavily search cost, to enable cost per verified success.</p></div><div><b>Snapshot mode</b><p>Collect the same Tavily evidence once and share it across matched agents for fair comparison.</p></div><div><b>Live mode</b><p>Run real provider and research calls. Public web results may change between executions.</p></div><div><b>Agent instrumentation</b><p>Gateway usage is observable. Internal planning steps require adapter or OpenTelemetry events.</p></div></div></Panel></div>
  </>
}

function App() {
  const [page, setPage] = useState(location.hash.replace('#', '') || 'overview')
  const [agents, setAgents] = useState([])
  const [tasks, setTasks] = useState([])
  const [experiments, setExperiments] = useState([])
  const [runs, setRuns] = useState([])
  const [overview, setOverview] = useState({})
  const [integrations, setIntegrations] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [health, setHealth] = useState(null)
  const [selectedRun, setSelectedRun] = useState(null)
  const [activeExperimentId, setActiveExperimentId] = useState('')
  const [activeExperiment, setActiveExperiment] = useState(null)
  const [arenaEvents, setArenaEvents] = useState([])
  const [replayEvents, setReplayEvents] = useState([])
  const [replayCursor, setReplayCursor] = useState(0)
  const [replayMode, setReplayMode] = useState(false)
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [paused, setPaused] = useState(false)
  const [activeFault, setActiveFault] = useState('none')

  const notify = useCallback((message, kind = 'success') => { setToast({ message, kind }); window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => setToast(null), 3600) }, [])
  const refresh = useCallback(async () => {
    try {
      const [o, a, t, e, r, i, h, l] = await Promise.all([
        api('/overview'), api('/agents'), api('/tasks'), api('/experiments'), api('/runs'), api('/integrations'), api('/health'), api('/leaderboard'),
      ])
      setOverview(o); setAgents(a.agents || []); setTasks(t.tasks || []); setExperiments(e.experiments || []); setRuns(r.runs || []); setIntegrations(i); setHealth(h); setLeaderboard(l.leaderboard || [])
    } catch (error) { notify(error.message, 'error') }
  }, [notify])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const onHash = () => setPage(location.hash.replace('#', '') || 'overview')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const navigate = (next) => { setPage(next); location.hash = next; setSidebarOpen(false) }

  useEffect(() => {
    if (!activeExperimentId || replayMode) return undefined
    let active = true
    let socket
    let timer
    const loadExperiment = async () => {
      try {
        const detail = await api(`/experiments/${activeExperimentId}`)
        if (!active) return
        setActiveExperiment(detail)
        const run = (detail.runs || []).find((item) => item.status === 'running') || detail.runs?.[detail.runs.length - 1]
        if (run) {
          const trace = await api(`/runs/${run.id}/events`)
          if (active) setArenaEvents(trace.events || [])
        }
        if (['completed', 'failed', 'partial', 'cancelled'].includes(detail.status)) {
          clearInterval(timer)
          refresh()
        }
      } catch (error) { if (active) notify(error.message, 'error') }
    }
    loadExperiment()
    timer = window.setInterval(loadExperiment, 1800)
    try {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      socket = new WebSocket(`${protocol}//${location.host}/ws/${activeExperimentId}`)
      socket.onmessage = (event) => {
        const item = JSON.parse(event.data)
        setArenaEvents((old) => [...old, item].slice(-300))
        const type = item.event_type || ''
        if (type === 'provider.request.failed') setActiveFault('provider')
        else if (type === 'evidence.poison.injected') setActiveFault('poison')
        else if (type === 'latency.delay.applied') setActiveFault('latency')
        else if (['provider.fallback.completed', 'model.request.completed', 'tool.call.completed', 'run.completed', 'run.failed', 'run.cancelled'].includes(type)) setActiveFault('none')
      }
    } catch { /* polling remains available when WebSockets are unavailable */ }
    return () => { active = false; clearInterval(timer); if (socket) socket.close() }
  }, [activeExperimentId, notify, refresh, replayMode])

  useEffect(() => {
    if (!replayMode || paused || replayCursor >= replayEvents.length) return undefined
    const timer = window.setTimeout(() => setReplayCursor((cursor) => Math.min(cursor + 1, replayEvents.length)), 260)
    return () => window.clearTimeout(timer)
  }, [replayMode, paused, replayCursor, replayEvents.length])

  useEffect(() => {
    if (!replayMode) return
    const visible = replayEvents.slice(0, replayCursor)
    setArenaEvents(visible)
    const latestType = visible[visible.length - 1]?.event_type || ''
    if (latestType === 'provider.request.failed') setActiveFault('provider')
    else if (latestType === 'evidence.poison.injected') setActiveFault('poison')
    else if (latestType === 'latency.delay.applied') setActiveFault('latency')
    else if (['provider.fallback.completed', 'model.request.completed', 'tool.call.completed', 'run.completed', 'run.failed', 'run.cancelled'].includes(latestType)) setActiveFault('none')
  }, [replayMode, replayEvents, replayCursor])

  const launchExperiment = async (payload) => {
    setBusy(true)
    try {
      const result = await api('/experiments', { method: 'POST', body: JSON.stringify(payload) })
      setReplayMode(false); setReplayEvents([]); setReplayCursor(0); setActiveExperimentId(result.experiment_id); setActiveExperiment({ id: result.experiment_id, title: payload.title, status: 'running', runs: [] }); setArenaEvents([]); setActiveFault('none')
      notify(`Experiment launched · ${result.run_count} executions`)
      await refresh()
      navigate('arena')
    } catch (error) { notify(error.message, 'error'); throw error }
    finally { setBusy(false) }
  }
  const openExperiment = async (id) => {
    try { const exp = await api(`/experiments/${id}`); setReplayMode(false); setReplayEvents([]); setActiveExperiment(exp); setActiveExperimentId(id); setArenaEvents([]); navigate('arena') }
    catch (e) { notify(e.message, 'error') }
  }
  const selectRun = async (id) => {
    try { const detail = await api(`/runs/${id}`); setSelectedRun(detail) }
    catch (e) { notify(e.message, 'error') }
  }
  const testIntegrations = async () => {
    setChecking(true)
    try { const res = await api('/integrations/test', { method: 'POST' }); await refresh(); notify(res.ready ? 'Bifrost and Tavily are responding.' : 'One or more integrations need attention.', res.ready ? 'success' : 'warning') }
    catch (e) { notify(e.message, 'error') }
    finally { setChecking(false) }
  }
  const createAgent = async (payload) => { await api('/agents', { method: 'POST', body: JSON.stringify(payload) }); await refresh(); notify('Agent adapter registered.') }
  const testAgent = async (id) => { const result = await api(`/agents/${id}/test`, { method: 'POST' }); notify(result.message, result.ok ? 'success' : 'error') }
  const deleteAgent = async (id) => { if (!window.confirm('Remove this external agent adapter?')) return; try { await api(`/agents/${id}`, { method: 'DELETE' }); await refresh(); notify('Agent removed.') } catch (e) { notify(e.message, 'error') } }
  const cancelRun = async (id) => { try { await api(`/runs/${id}/cancel`, { method: 'POST' }); await refresh(); if (selectedRun?.id === id) await selectRun(id); notify('Cancellation requested.') } catch (e) { notify(e.message, 'error') } }
  const exportExperiment = (id) => { if (id) window.location.assign(`${API}/experiments/${id}/export`) }
  const replay = async () => {
    const expId = activeExperimentId || experiments[0]?.id
    if (!expId) return notify('Run a benchmark first.', 'warning')
    try {
      const exp = await api(`/experiments/${expId}`)
      const run = (exp.runs || []).find((r) => r.status === 'completed') || exp.runs?.[0]
      if (!run) return notify('No recorded run is available to replay.', 'warning')
      const detail = await api(`/runs/${run.id}`)
      const recorded = detail.events || []
      setPaused(false)
      setActiveExperiment(exp)
      setActiveExperimentId(expId)
      setReplayEvents(recorded)
      setReplayCursor(0)
      setReplayMode(true)
      setArenaEvents([])
      setActiveFault('none')
      notify(`Replaying ${recorded.length} recorded events.`)
    } catch (e) { notify(e.message, 'error') }
  }

  const activeNav = navGroups.flatMap((g) => g.items).find((item) => item[0] === page)
  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <button className="brand" onClick={() => navigate('overview')}><span className="brand-symbol"><i /><i /><i /></span><span><strong>RIFT</strong><small>ARENA</small></span></button>
      <div className="workspace-select"><span className="workspace-avatar">R</span><span><b>Research workspace</b><small>Personal lab</small></span><ChevronDown size={14} /></div>
      {navGroups.map((group) => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(([id, label, Icon]) => <button key={id} className={`nav-link ${page === id ? 'active' : ''}`} onClick={() => navigate(id)}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{id === 'benchmark' && <em>NEW</em>}{id === 'chaos' && <i className="nav-dot" />}</button>)}</div>)}
      <div className="sidebar-spacer" />
      <div className="sidebar-connection"><span className={`connection-led ${integrations?.bifrost?.configured && integrations?.tavily?.configured ? 'online' : ''}`} /><div><b>{integrations?.bifrost?.configured && integrations?.tavily?.configured ? 'Services configured' : 'Demo environment'}</b><small>{integrations?.database?.type || 'Checking database'}</small></div></div>
      <div className="sidebar-profile"><span className="profile-mark">RA</span><span><b>RIFT workspace</b><small>Local environment</small></span><button onClick={() => navigate('settings')}><Settings2 size={15} /></button></div>
    </aside>
    {sidebarOpen && <button className="mobile-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={() => setSidebarOpen(true)}><Menu size={18} /></button><span>Workspace</span><ChevronRight size={13} /><b>{pageTitles[page]?.[0] || 'Overview'}</b></div><div className="topbar-right"><Badge tone={integrations?.mode === 'live configured' ? 'green' : 'amber'} dot>{integrations?.mode === 'live configured' ? 'Live configured' : 'Demo mode'}</Badge><button className="icon-button" onClick={refresh} title="Refresh workspace"><RefreshCw size={16} /></button><span className="top-avatar">RA</span></div></header>
      <div className="page-root" key={page}>
        {page === 'overview' && <OverviewPage data={{ overview, experiments }} onNavigate={navigate} onStart={openExperiment} />}
        {page === 'benchmark' && <BenchmarkPage agents={agents} tasks={tasks} onLaunch={launchExperiment} busy={busy} />}
        {page === 'agents' && <AgentsPage agents={agents} onCreate={createAgent} onTest={testAgent} onDelete={deleteAgent} busy={busy} />}
        {page === 'research' && <ResearchPage />}
        {page === 'chaos' && <ChaosPage onLaunch={launchExperiment} busy={busy} />}
        {page === 'arena' && <ArenaPage experiment={activeExperiment} events={arenaEvents} runs={runs} activeFault={activeFault} onReplay={replay} onPause={() => setPaused((v) => !v)} paused={paused} onNavigate={navigate} replayMode={replayMode} replayCursor={replayCursor} replayTotal={replayEvents.length} onReplaySeek={setReplayCursor} />}
        {page === 'evaluation' && <EvaluationPage />}
        {page === 'runs' && <RunsPage runs={runs} selectedRun={selectedRun} onSelectRun={selectRun} onCancel={cancelRun} onExport={exportExperiment} />}
        {page === 'compare' && <ComparePage experiments={experiments} />}
        {page === 'leaderboard' && <LeaderboardPage entries={leaderboard} onRefresh={refresh} />}
        {page === 'settings' && <SettingsPage integrations={integrations} onTest={testIntegrations} checking={checking} health={health} />}
      </div>
    </main>
    {toast && <div className={`toast toast-${toast.kind}`}><span>{toast.kind === 'error' ? <AlertTriangle size={15} /> : <Check size={15} />}</span>{toast.message}<button onClick={() => setToast(null)}><X size={14} /></button></div>}
  </div>
}

export default App
