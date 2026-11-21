import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Bot, Boxes, Check,
  ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Command, Copy, Cpu,
  Database, Download, ExternalLink, Eye, FileBarChart, FileText, FlaskConical, Gauge,
  GitCompareArrows, Globe2, Layers3, LayoutDashboard, ListFilter, Menu, Network,
  Pause, Play, Plus, Radio, RefreshCw, Search, Server, Settings2, ShieldCheck,
  ShieldEllipsis, Sparkles, Square, Terminal, Timer, Trash2, Trophy, X, Zap,
  Fingerprint, Bug, FilePlus2, ScanSearch, History, Route, FileUp, CircleDollarSign, CheckCircle2, AlertCircle, Scale, GaugeCircle, Clock, Upload, Layers,
} from 'lucide-react'
import Arena3D from './components/Arena3D.jsx'
import RunDock from './components/RunDock.jsx'

const API = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const API_URL = new URL(API, window.location.origin)
const WS_PROTOCOL = API_URL.protocol === 'https:' ? 'wss:' : 'ws:'
const WS_BASE = `${WS_PROTOCOL}//${API_URL.host}`
const navGroups = [
  { label: 'Benchmark', items: [
    ['benchmark', 'Benchmark lab', FlaskConical], ['agents', 'Agent registry', Bot],
    ['compare', 'Compare experiments', GitCompareArrows], ['runs', 'Run inspector', Activity],
  ] },
  { label: 'Reliability', items: [
    ['chaos', 'Chaos lab', ShieldEllipsis], ['counterfactuals', 'Failure analysis', ScanSearch],
    ['regression', 'Regression suite', History],
  ] },
  { label: 'Results', items: [
    ['evaluation', 'Evaluation reports', FileBarChart], ['leaderboard', 'Leaderboard', Trophy],
  ] },
  { label: 'Appendix', items: [
    ['arena', '3D Arena', Network], ['bifrost', 'Bifrost gateway', Gauge],
    ['traffic', 'Request datasets', Database], ['research', 'Research snapshots', Globe2],
    ['mcp', 'Tool dependency monitor', Fingerprint], ['settings', 'Integrations & settings', Settings2],
  ] },
]
const pageTitles = {
  overview: ['Workspace', 'Agent benchmark activity at a glance.'],
  benchmark: ['Agent Benchmark Lab', 'Run matched trials on any agent and compare them.'],
  agents: ['Agent registry', 'Connect any agent through one HTTP contract.'],
  research: ['Research snapshots', 'Evidence pinned for research tasks.'],
  runs: ['Run Inspector', 'Every step, tool call and failure.'],
  mcp: ['Tool dependency monitor', 'Track tool-server changes.'],
  counterfactuals: ['Failure analysis', 'Remove one fault at a time and compare.'],
  regression: ['Regression suite', 'Replay saved failures on new agent versions.'],
  chaos: ['Chaos lab', 'Inject outages, bad tools and hostile instructions.'],
  arena: ['3D Arena', 'Watch agent events play out live.'],
  evaluation: ['Evaluation reports', 'Success, repeatability, cost and resilience.'],
  compare: ['Compare', 'See why one configuration wins.'],
  leaderboard: ['Leaderboard', 'Agents ranked by measured results.'],
  settings: ['Integrations & settings', 'Bifrost, Tavily and storage.'],
  about: ['About RIFT', 'Architecture and project information.'],
  bifrost: ['Bifrost gateway', 'Optional gateway integration.'],
  'route-lab': ['Route lab', 'Compare model routes on one workload.'],
  traffic: ['Traffic replay', 'Reusable request workloads.'],
}
const defaultConfig = {
  title: 'Coding-10 agent benchmark', mode: 'demo', evidenceMode: 'snapshot', suiteId: 'coding-10',
  agentIds: ['agent-react', 'agent-planner'], models: 'general', taskIds: [],
  repetitions: 5, severity: 50, masterSeed: 42017,
  faults: { provider: false, poison: false, latency: false, tool_unavailable: false, misleading_instruction: false },
  budgets: { max_steps: 20, max_tool_calls: 15, timeout_seconds: 120, max_cost_usd: 0.1 },
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
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
  const recent = data.experiments.slice(0, 6)
  const o = data.overview || {}
  const signals = [
    { label: 'MCP manifests', value: 'Open', detail: 'Tracked endpoints', target: 'mcp', icon: Fingerprint },
    { label: 'Saved regressions', value: 'Open', detail: 'Replayable failure cases', target: 'regression', icon: History },
    { label: 'Failure analyses', value: 'Open', detail: 'Controlled comparisons', target: 'counterfactuals', icon: ScanSearch },
  ]
  return <>
    <PageHeading page="overview" action={<Button icon={Plus} onClick={() => onNavigate('benchmark')}>New benchmark</Button>} />
    <div className="workspace-intro-row">
      <div><div className="eyebrow">OPERATIONS</div><h2>Research workspace</h2><p>Review recent executions and continue reliability work.</p></div>
      <div className="workspace-intro-actions"><Button variant="secondary" icon={Fingerprint} onClick={() => onNavigate('mcp')}>Monitor MCP server</Button><Button variant="secondary" icon={History} onClick={() => onNavigate('regression')}>Open regressions</Button></div>
    </div>
    <div className="stats-grid">
      <StatCard icon={FlaskConical} label="Experiments" value={number(o.experiments)} detail="Saved benchmark sessions" accent="blue" />
      <StatCard icon={Activity} label="Completed runs" value={number(o.completed)} detail={`${number(o.failed)} failed executions`} accent="violet" />
      <StatCard icon={Gauge} label="Average quality" value={o.avg_quality == null ? '—' : `${o.avg_quality}%`} detail="Across evaluated runs" accent="cyan" />
      <StatCard icon={ShieldCheck} label="Task success" value={percent(o.success_rate)} detail="Recorded task outcomes" accent="green" />
    </div>
    <div className="workspace-lower-grid">
      <Panel className="table-panel workspace-recent-panel">
        <PanelHeading title="Recent experiments" detail="Latest benchmark activity" action={<Button size="sm" variant="secondary" onClick={() => onNavigate('runs')}>Run inspector <ArrowRight size={13}/></Button>} />
        {recent.length ? <div className="table-scroll"><table><thead><tr><th>Experiment</th><th>Mode</th><th>Runs</th><th>Status</th><th>Created</th><th /></tr></thead><tbody>{recent.map((exp) => <tr key={exp.id}><td><b>{exp.title}</b><small className="mono">{short(exp.id)}</small></td><td><Badge tone={exp.mode === 'live' ? 'green' : 'muted'}>{exp.mode === 'live' ? 'Live' : 'Demo'}</Badge></td><td>{(exp.agent_ids || []).length * (exp.models || []).length * (exp.task_ids || []).length * exp.repetitions}</td><td><Badge tone={toneForStatus(exp.status)} dot>{exp.status}</Badge></td><td>{relativeTime(exp.created_at)}</td><td><button className="icon-button small" onClick={() => onStart(exp.id)} aria-label="Open experiment"><ArrowUpRight size={15} /></button></td></tr>)}</tbody></table></div> : <EmptyState title="No experiments recorded" detail="Run a benchmark to start collecting comparable agent executions." action={<Button onClick={() => onNavigate('benchmark')}>Create benchmark</Button>} />}
      </Panel>
      <div className="workspace-quick-stack">
        <Panel className="workspace-quick-panel"><PanelHeading title="Reliability tools" detail="Continue from recorded evidence" />{signals.map(({ label, value, detail, target, icon: Icon }) => <button key={target} className="workspace-quick-link" onClick={() => onNavigate(target)}><span><Icon size={17}/></span><div><b>{label}</b><small>{detail}</small></div><strong>{value}</strong><ArrowRight size={14}/></button>)}</Panel>
        <Panel className="workspace-note"><div className="eyebrow">WORKING PRINCIPLE</div><p>Every comparison should preserve the task, configuration, evidence and trace needed to reproduce the result.</p><button onClick={() => onNavigate('about')}>RIFT architecture <ArrowUpRight size={13}/></button></Panel>
      </div>
    </div>
  </>
}

function BenchmarkPage({ agents, tasks, onLaunch, busy }) {
  const [config, setConfig] = useState(defaultConfig)
  const [suiteTasks, setSuiteTasks] = useState(tasks.filter((task) => task.suite_id === defaultConfig.suiteId))
  const [suiteLoading, setSuiteLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const suiteChoices = [
    { id: 'research-10', name: 'Research-10', category: 'Research', detail: 'Evidence quality, source verification and synthesis' },
    { id: 'coding-10', name: 'Coding-10', category: 'Coding', detail: 'Isolated Python execution with hidden task-level assertions in live mode' },
    { id: 'support-10', name: 'Support-10', category: 'Customer support', detail: 'Policy accuracy, privacy and safe communication' },
  ]
  const currentSuite = suiteChoices.find((suite) => suite.id === config.suiteId) || suiteChoices[0]
  useEffect(() => {
    let active = true
    setSuiteLoading(true)
    api(`/tasks?suite_id=${encodeURIComponent(config.suiteId)}`)
      .then((data) => {
        if (!active) return
        const nextTasks = data.tasks || []
        setSuiteTasks(nextTasks)
        setConfig((old) => ({ ...old, taskIds: nextTasks.map((task) => task.id) }))
      })
      .catch((error) => { if (active) setFormError(error.message) })
      .finally(() => { if (active) setSuiteLoading(false) })
    return () => { active = false }
  }, [config.suiteId])
  const update = (key, value) => setConfig((old) => ({ ...old, [key]: value }))
  const toggleList = (key, value) => update(key, config[key].includes(value) ? config[key].filter((x) => x !== value) : [...config[key], value])
  const toggleFault = (id, value) => update('faults', { ...config.faults, [id]: value })
  const modelList = config.models.split(',').map((item) => item.trim()).filter(Boolean)
  const runCount = config.agentIds.length * Math.max(1, modelList.length) * config.taskIds.length * config.repetitions
  const launch = async () => {
    setFormError('')
    if (!config.agentIds.length || !config.taskIds.length) return setFormError('Select at least one agent and one task.')
    if (runCount > 200) return setFormError('Keep an experiment to 200 runs or fewer.')
    if (!modelList.length) return setFormError('Enter at least one model route.')
    await onLaunch({ title: config.title, mode: config.mode, suite_id: config.suiteId, agent_ids: config.agentIds, models: modelList, task_ids: config.taskIds, evidence_mode: config.evidenceMode, repetitions: Number(config.repetitions), severity: Number(config.severity), master_seed: Number(config.masterSeed), faults: config.faults, budgets: config.budgets })
  }
  return <>
    <PageHeading page="benchmark" action={<Badge tone="green">Framework independent</Badge>} />
    <div className="benchmark-thesis-strip">
      <div><span className="eyebrow">TASK-LEVEL BENCHMARKING / COMPLETE AGENT CONFIGURATIONS</span><h2>Same task. Same conditions. <em>Different agents.</em></h2><p>Compare complete agent configurations, including prompts, tools, memory and retry behaviour, against identical task-level workloads rather than isolated model responses.</p></div>
      <div className="benchmark-thesis-meta"><span><b>30</b><small>benchmark tasks</small></span><span><b>3</b><small>task categories</small></span><span><b>5×</b><small>repeat trials</small></span></div>
    </div>
    <div className="benchmark-layout">
      <div className="benchmark-main">
        <Panel className="form-panel"><PanelHeading title="Experiment setup" detail="Select a benchmark suite and RIFT keeps each chosen task matched across agents." /><div className="form-grid">
          <Field label="Experiment name"><input value={config.title} onChange={(e) => update('title', e.target.value)} placeholder="Agent reliability benchmark" /></Field>
          <Field label="Benchmark category"><select value={config.suiteId} onChange={(e) => { update('suiteId', e.target.value); update('title', `${suiteChoices.find((item) => item.id === e.target.value)?.name || 'Agent'} benchmark`) }}>{suiteChoices.map((suite) => <option key={suite.id} value={suite.id}>{suite.name} · {suite.category}</option>)}</select></Field>
          <Field label="Execution mode"><select value={config.mode} onChange={(e) => update('mode', e.target.value)}><option value="demo">Fixture mode · no provider calls</option><option value="live">Live · connected Bifrost</option></select></Field>
          <Field label="Bifrost model route" hint="Gateway route used by built-in agents. External agents report their own model usage."><input value={config.models} onChange={(e) => update('models', e.target.value)} placeholder="general" /></Field>
        </div>
        <div className="suite-description"><span className="suite-description-mark">{currentSuite.category.slice(0,1)}</span><div><b>{currentSuite.name}</b><p>{currentSuite.detail}</p></div><Badge tone="muted">10 tasks</Badge></div>
        </Panel>
        <Panel className="form-panel"><PanelHeading title="Agent configurations" detail={`${config.agentIds.length} selected · compare the entire agent, not just its underlying model`} action={<button className="text-button" onClick={() => update('agentIds', agents.map((agent) => agent.id))}>Select all</button>} /><div className="choice-grid">{agents.map((agent) => <button type="button" className={`choice-card ${config.agentIds.includes(agent.id) ? 'selected' : ''}`} key={agent.id} onClick={() => toggleList('agentIds', agent.id)}><span className="choice-check">{config.agentIds.includes(agent.id) && <Check size={12} />}</span><span className="agent-avatar"><Bot size={20} /></span><span className="choice-copy"><b>{agent.name}</b><small>{agent.framework} · {agent.kind === 'builtin' ? 'Built-in baseline' : 'External adapter'}</small></span><span className="agent-framework-tag">{agent.kind === 'builtin' ? 'RIFT' : 'HTTP'}</span></button>)}</div></Panel>
        <Panel className="form-panel"><PanelHeading title={`${currentSuite.name} task set`} detail={`${config.taskIds.length} of ${suiteTasks.length} selected`} action={<div className="task-selection-actions"><button className="text-button" onClick={() => update('taskIds', suiteTasks.map((task) => task.id))}>Select all</button><button className="text-button" onClick={() => update('taskIds', [])}>Clear</button></div>} /><div className="task-list">{suiteTasks.map((task, index) => <button type="button" key={task.id} className={`task-choice ${config.taskIds.includes(task.id) ? 'selected' : ''}`} onClick={() => toggleList('taskIds', task.id)}><span className="task-number">{String(index + 1).padStart(2, '0')}</span><span className="task-copy"><b>{task.title}</b><small>{task.category} · {task.difficulty}</small></span><Badge tone={task.difficulty === 'Hard' ? 'red' : task.difficulty === 'Easy' ? 'green' : 'blue'}>{task.difficulty}</Badge><span className="choice-check">{config.taskIds.includes(task.id) && <Check size={12} />}</span></button>)}{suiteLoading && <div className="loading-line"><span/>Loading task suite…</div>}</div><div className="suite-grading-note"><ShieldCheck size={15}/><span>{config.suiteId === 'coding-10' ? (config.mode === 'live' ? 'Live mode executes candidate code in Judge0 with hidden task assertions. Demo mode uses structural fixtures only.' : 'Demo mode uses AST and structural fixtures only. Live mode executes candidate code in an isolated Judge0 sandbox.') : config.suiteId === 'support-10' ? 'Responses are checked against task-specific policy, privacy and communication criteria.' : 'Research outputs are checked for evidence coverage, expected concepts and citation integrity.'}</span></div></Panel>
        <Panel className="form-panel"><PanelHeading title="Execution budgets" detail="Identical limits apply to every agent trial."/><div className="budget-grid">{[['max_steps','Max steps',1,100],['max_tool_calls','Max tool calls',1,100],['timeout_seconds','Timeout (seconds)',10,600]].map(([key, label, min, max]) => <Field label={label} key={key}><input type="number" min={min} max={max} value={config.budgets[key]} onChange={(e) => update('budgets', { ...config.budgets, [key]: Number(e.target.value) })} /></Field>)}<Field label="Max cost per run (USD)"><input type="number" min="0.001" max="100" step="0.001" value={config.budgets.max_cost_usd} onChange={(e) => update('budgets', { ...config.budgets, max_cost_usd: Number(e.target.value) })} /></Field></div></Panel>
      </div>
      <aside className="benchmark-side">
        <Panel className="side-panel"><PanelHeading title="Trial protocol" detail="Control repeatability and injected conditions."/><div className="field-stack"><Field label={`Repeated trials · ${config.repetitions}×`}><input type="range" min="1" max="5" value={config.repetitions} onChange={(e) => update('repetitions', Number(e.target.value))} /></Field><div className="repetition-scale"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div><Field label="Master seed"><input type="number" value={config.masterSeed} onChange={(e) => update('masterSeed', Number(e.target.value))} /></Field><Field label={`Fault severity · ${config.severity}%`}><input type="range" min="0" max="100" step="5" value={config.severity} onChange={(e) => update('severity', Number(e.target.value))} /></Field></div><div className="divider"/><div className="field-stack"><div className="mini-heading">Fault profile</div>{[
          ['provider','Provider outage','Simulate an unavailable primary model route.'],['tool_unavailable','Broken tool','Make a required tool unavailable to the agent.'],['misleading_instruction','Misleading instruction','Add hostile instructions as untrusted task context.'],['poison','Evidence poisoning','Add adversarial evidence to research tasks.'],['latency','Network latency','Delay the task context or research tool response.'],
        ].map(([key, title, detail]) => <div className="switch-row" key={key}><div><b>{title}</b><small>{detail}</small></div><Switch checked={Boolean(config.faults[key])} onChange={(value) => toggleFault(key, value)} /></div>)}</div><div className="divider"/><div className="run-estimate"><span>Planned agent executions</span><b>{runCount}</b><small>{config.agentIds.length} agents · {config.taskIds.length} tasks · {config.repetitions} trials</small></div>{formError && <div className="form-error">{formError}</div>}<Button className="full-button" icon={Play} disabled={busy || suiteLoading} onClick={launch}>{busy ? 'Launching benchmark…' : 'Run benchmark'}</Button><p className="side-footnote">Demo mode runs offline. Live mode uses Bifrost (and Tavily for research).</p></Panel>
        <Panel className="callout-panel"><div className="callout-symbol"><ShieldCheck size={19}/></div><b>Matched evaluation</b><p>Every selected agent receives identical task versions, repetition seeds, evidence snapshots and budgets. Actual provider usage is kept separate from fixture data.</p></Panel>
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
    <PageHeading page="research" action={<Badge tone={mode === 'live' ? 'green' : 'amber'} dot>{mode === 'live' ? 'Live Tavily search' : 'Generated evidence'}</Badge>} />
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
              <Field label="Search mode"><select value={mode} onChange={(e) => setMode(e.target.value)}><option value="demo">Generated evidence</option><option value="live">Live · Tavily API</option></select></Field>
              <Field label="Search depth"><select value={depth} onChange={(e) => setDepth(e.target.value)}><option value="basic">Basic</option><option value="advanced">Advanced</option></select></Field>
              <Button icon={Search} type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search sources'}</Button>
            </div>
          </form>
          <div className="research-suggestions"><span>Try</span>{['Latest AI gateway releases', 'MCP security best practices', 'Agent observability benchmarks'].map((item) => <button type="button" key={item} onClick={() => setQuery(item)}>{item}</button>)}</div>
          {error && <div className="form-error">{error}</div>}
        </Panel>
        {result ? <>
          <div className="research-result-heading"><div><div className="eyebrow">{result.simulated ? 'RIFT generated dataset' : (result.provider || 'Evidence results')}</div><h2>Research sources</h2><p>{result.query}</p></div><div className="research-result-meta"><Badge tone={result.simulated ? 'amber' : 'green'}>{result.simulated ? 'Generated dataset' : 'Live web results'}</Badge><span>{result.source_count ?? result.sources?.length ?? 0} sources · {result.latency_ms != null ? `${result.latency_ms} ms` : 'Saved snapshot'}</span></div></div>
          {result.answer && <Panel className="research-answer"><div className="answer-mark"><Sparkles size={18}/></div><div><b>Search overview</b><p>{result.answer}</p></div></Panel>}
          <div className="research-sources">{(result.sources || []).map((source, index) => <Panel className="research-source" key={`${source.url}-${index}`}><div className="source-topline"><span className="source-number">{String(index + 1).padStart(2, '0')}</span><Badge tone={source.synthetic ? 'amber' : 'cyan'}>{source.synthetic ? 'Generated source' : 'Tavily source'}</Badge>{source.score != null && <span className="source-score">Relevance {Math.round(source.score * 100)}%</span>}</div><h3>{source.title || 'Untitled source'}</h3><div className="source-domain"><Globe2 size={13}/>{sourceHost(source.url)}{source.published_date ? ` · ${source.published_date}` : ''}</div><p>{source.content || 'No extracted passage returned.'}</p><div className="source-actions">{!source.synthetic && source.url && <a href={source.url} target="_blank" rel="noreferrer">Open source <ExternalLink size={13}/></a>}<span>{source.synthetic ? 'RIFT generated dataset' : (source.source || result.provider)}</span></div></Panel>)}</div>
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
  const [faults, setFaults] = useState({ provider: true, tool_unavailable: false, misleading_instruction: false, poison: true, latency: true })
  const [severity, setSeverity] = useState(50)
  const [seed, setSeed] = useState(42017)
  const [mode, setMode] = useState('demo')
  const [error, setError] = useState('')
  const faultsMeta = [
    { id: 'provider', title: 'Provider outage', desc: 'Return a controlled failure from the primary model dependency.', icon: Server, color: 'red', stat: `${severity}%`, metric: 'Selected model calls' },
    { id: 'tool_unavailable', title: 'Tool unavailable', desc: 'Make the research tool unavailable and test safe recovery.', icon: Globe2, color: 'amber', stat: `${severity}%`, metric: 'Eligible tool calls' },
    { id: 'misleading_instruction', title: 'Hostile instructions', desc: 'Add adversarial task context that must remain untrusted.', icon: FileText, color: 'violet', stat: `${severity}%`, metric: 'Task context injection' },
    { id: 'poison', title: 'Evidence poisoning', desc: 'Append a labelled adversarial source to the research snapshot.', icon: ShieldEllipsis, color: 'violet', stat: `${severity}%`, metric: 'Research evidence packs' },
    { id: 'latency', title: 'Added latency', desc: 'Delay the benchmark task path by a seeded amount.', icon: Timer, color: 'amber', stat: `${(4 * severity / 100).toFixed(1)}s`, metric: 'Injected delay' },
  ]
  async function run() {
    setError('')
    try {
      await onLaunch({ title: 'Fault profile · Research-10', mode, suite_id: 'research-10', agent_ids: ['agent-react', 'agent-planner'], models: ['general'], task_ids: ['research-001', 'research-009'], evidence_mode: 'snapshot', repetitions: 1, severity, master_seed: seed, faults, budgets: { max_steps: 20, max_tool_calls: 15, timeout_seconds: 120, max_cost_usd: 0.1 } })
    } catch (e) { setError(e.message) }
  }
  return <>
    <PageHeading page="chaos" action={<Badge tone="red" dot>Controlled fault injection</Badge>} />
    <div className="chaos-hero"><div><div className="eyebrow">CONTROLLED FAILURE TRIALS</div><h2>Test agent behaviour<br /><em>under failure conditions.</em></h2><p>Apply the same seeded fault schedule to each selected agent and compare task success, recovery, tool usage and execution cost.</p></div><div className="chaos-hero-note"><b>5</b><span>independent fault dimensions</span><small>One shared seed · matched agents</small></div></div>
    <div className="chaos-grid">{faultsMeta.map(({ id, title, desc, icon: Icon, color, stat, metric }) => <Panel className={`fault-card fault-${color}`} key={id}><div className="fault-card-top"><span className="fault-icon"><Icon size={20} /></span><Switch checked={faults[id]} onChange={(v) => setFaults({ ...faults, [id]: v })} /></div><h3>{title}</h3><p>{desc}</p><div className="fault-stat"><b>{stat}</b><span>{metric}</span></div><Badge tone={faults[id] ? color : 'muted'} dot>{faults[id] ? 'Enabled' : 'Disabled'}</Badge></Panel>)}</div>
    <div className="chaos-layout"><Panel className="form-panel"><PanelHeading title="Fault intensity" detail="Fault selection and injection decisions are recorded on every run." /><div className="severity-head"><span>Injection severity</span><b>{severity}%</b></div><input type="range" min="0" max="100" step="5" value={severity} onChange={(e) => setSeverity(Number(e.target.value))} /><div className="range-ends"><span>Low impact</span><span>High impact</span></div><div className="fault-resolution"><div><span>Provider / tool injection</span><b>{severity}%</b></div><div><span>Misleading context / evidence</span><b>{severity}%</b></div><div><span>Added task delay</span><b>{(4 * severity / 100).toFixed(1)} sec</b></div></div></Panel><Panel className="form-panel"><PanelHeading title="Reproducibility" detail="Repeat the same seeded fault schedule on another agent version." /><Field label="Execution mode"><select value={mode} onChange={(e) => setMode(e.target.value)}><option value="demo">Generated scenario</option><option value="live">Live · connected providers</option></select></Field><Field label="Master seed"><input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} /></Field><div className="seed-note"><Database size={16} /><span>Agent identity is excluded from fault schedule generation. Matched agents receive the same planned faults.</span></div><div className="safety-note"><ShieldCheck size={17} /><span>Demo faults use controlled fixtures. Live provider recovery requires a dedicated Bifrost test route.</span></div>{error && <div className="form-error">{error}</div>}<Button className="full-button" icon={Zap} disabled={busy || !Object.values(faults).some(Boolean)} onClick={run}>{busy ? 'Preparing fault trial…' : 'Run fault trial'}</Button></Panel></div>
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

function RunsPage({ runs, selectedRun, onSelectRun, onCancel, onExport, onAnalyze, onSaveRegression, onReview }) {
  const [search, setSearch] = useState('')
  const filtered = runs.filter((run) => `${run.id} ${run.agent_name} ${run.experiment_title} ${run.task_id}`.toLowerCase().includes(search.toLowerCase()))
  const result = selectedRun?.result || {}
  return <>
    <PageHeading page="runs" action={<Field label="Search runs"><div className="search-input"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Agent, task or run ID" /></div></Field>} />
    <div className="inspector-layout"><Panel className="run-list-panel"><PanelHeading title="Recorded runs" detail={`${filtered.length} executions`} /><div className="run-table-list">{filtered.map((run) => <button className={`run-list-item ${selectedRun?.id === run.id ? 'selected' : ''}`} key={run.id} onClick={() => onSelectRun(run.id)}><div className="run-list-top"><b>{run.agent_name || run.agent_id}</b><Badge tone={toneForStatus(run.status)}>{run.status}</Badge></div><span>{run.experiment_title || 'Experiment'} · {run.task_id}</span><small>{short(run.id)} · {relativeTime(run.started_at)}</small></button>)}{!filtered.length && <EmptyState title="No runs found" detail="Launch a benchmark to create execution records." />}</div></Panel>
      <div className="inspector-detail">{selectedRun ? <>
        <Panel className="detail-hero"><div><div className="eyebrow">RUN / {short(selectedRun.id)}</div><h2>{selectedRun.agent_name || selectedRun.agent_id}</h2><p>{selectedRun.task_id} · {selectedRun.model}</p></div><div className="detail-hero-actions"><Badge tone={toneForStatus(selectedRun.status)} dot>{selectedRun.status}</Badge><Button size="sm" variant="secondary" icon={Download} onClick={() => onExport?.(selectedRun.experiment_id)}>Export</Button>{['completed','failed','cancelled'].includes(selectedRun.status) && <><Button size="sm" variant="secondary" icon={ScanSearch} onClick={() => onAnalyze?.(selectedRun.id)}>Analyze failure</Button><Button size="sm" icon={History} onClick={() => onSaveRegression?.(selectedRun.id)}>Save regression</Button></>}</div></Panel>
        <div className="stats-grid detail-stats">
          <StatCard icon={Gauge} label="Quality" value={percent(result.quality == null ? null : result.quality * 100)} detail={`${result.assertions_passed ?? '—'}/${result.assertions_total ?? '—'} task checks`} accent="blue" />
          <StatCard icon={Clock3} label="Latency" value={result.latency_ms == null ? '—' : `${(result.latency_ms / 1000).toFixed(2)}s`} detail="End-to-end" accent="cyan" />
          <StatCard icon={Layers3} label="Agent steps" value={number(result.steps)} detail="Reported / observed" accent="violet" />
          <StatCard icon={Network} label="Tool calls" value={number(result.tool_calls)} detail="Reported / observed" accent="blue" />
          <StatCard icon={Cpu} label="Tokens" value={result.tokens_in == null || result.tokens_out == null ? '—' : number(Number(result.tokens_in) + Number(result.tokens_out))} detail={result.tokens_in == null || result.tokens_out == null ? 'Usage unavailable' : `${number(result.tokens_in)} in · ${number(result.tokens_out)} out`} accent="cyan" />
          <StatCard icon={DollarSignIcon} label="Total cost" value={money(result.total_cost_usd)} detail="Unpriced if rates missing" accent="green" />
        </div>
        {result.bifrost_request_id && <Panel className="trace-link-panel"><div><span className="eyebrow">BIFROST REQUEST CORRELATION</span><p>Use this exact request ID in the Bifrost Logs API or dashboard to inspect provider, fallback, token and cost telemetry.</p></div><code>{result.bifrost_request_id}</code></Panel>}
        {result.grader_type === 'code_sandbox' || result.validation_status ? <Panel className="validation-panel"><PanelHeading title="Executable validation" detail="Task-specific assertions executed outside the RIFT API process." action={<Badge tone={result.validation_status === 'executed' ? 'green' : 'amber'}>{result.validation_status || 'Not validated'}</Badge>} /><div className="validation-summary"><span>{result.sandbox?.provider || 'Static grader'}</span><span>{result.sandbox?.time_seconds ? `${result.sandbox.time_seconds}s execution` : result.validation_status === 'structural_demo_only' ? 'Demo fixture · no code execution' : 'Runtime unavailable'}</span><span>{result.sandbox?.network_enabled === false ? 'Network disabled' : 'Runtime network policy not reported'}</span></div>{result.assertion_results?.length > 0 && <div className="assertion-list">{result.assertion_results.map((check, index) => <div key={`${check.label}-${index}`}><span className={check.passed ? 'assertion-pass' : 'assertion-fail'}>{check.passed ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>}</span><b>{check.label}</b><small>{check.detail}</small></div>)}</div>}</Panel> : null}
        {result.research_verification && <Panel className="claim-review-panel"><PanelHeading title="Research claim verification" detail="Claim-to-excerpt support checks. This does not independently prove real-world truth." action={<Badge tone={result.research_verification.status === 'evaluated' ? 'green' : 'amber'}>{result.research_verification.status}</Badge>} /><div className="claim-review-summary"><div><b>{result.research_verification.supported_claims ?? 0}</b><small>Supported</small></div><div><b>{result.research_verification.contradicted_claims ?? 0}</b><small>Contradicted</small></div><div><b>{result.research_verification.insufficient_claims ?? 0}</b><small>Insufficient</small></div><div><b>{percent((result.research_verification.supported_rate || 0) * 100)}</b><small>Support rate</small></div></div><div className="claim-list">{(result.research_verification.claims || []).map((claim, index) => <div key={index}><div><Badge tone={claim.status === 'supported' ? 'green' : claim.status === 'contradicted' ? 'red' : 'amber'}>{claim.status}</Badge><b>{claim.claim}</b></div>{claim.quote && <blockquote>“{claim.quote}”</blockquote>}{claim.source_url && <a href={claim.source_url} target="_blank" rel="noreferrer">Open cited source <ExternalLink size={11}/></a>}</div>)}</div>{result.human_review ? <div className="human-review-result"><Badge tone={result.human_review.verdict === 'accepted' ? 'green' : result.human_review.verdict === 'rejected' ? 'red' : 'amber'}>Human review · {result.human_review.verdict}</Badge><small>{result.human_review.reviewer} · {new Date(result.human_review.reviewed_at).toLocaleString()}</small>{result.human_review.notes && <p>{result.human_review.notes}</p>}</div> : <div className="human-review-actions"><span>Reviewer confirmation</span><Button size="sm" variant="secondary" onClick={() => onReview?.(selectedRun.id, 'needs_review')}>Needs review</Button><Button size="sm" variant="secondary" onClick={() => onReview?.(selectedRun.id, 'rejected')}>Reject</Button><Button size="sm" onClick={() => onReview?.(selectedRun.id, 'accepted')}>Accept</Button></div>}</Panel>}
        {result.support_verification && <Panel className="claim-review-panel"><PanelHeading title="Support policy review" detail="Scenario-aware policy, privacy and promise checks." action={<Badge tone={result.support_verification.status === 'evaluated' ? 'green' : 'amber'}>{result.support_verification.status}</Badge>} /><div className="claim-review-summary"><div><b>{result.support_verification.passed_criteria ?? 0}</b><small>Passed criteria</small></div><div><b>{result.support_verification.total_criteria ?? 0}</b><small>Total criteria</small></div><div><b>{result.support_verification.risk_flags?.length ?? 0}</b><small>Risk flags</small></div><div><b>{percent((result.support_verification.score || 0) * 100)}</b><small>Policy score</small></div></div><div className="claim-list">{(result.support_verification.criteria || []).map((criterion) => <div key={criterion.id}><div><Badge tone={criterion.passed ? 'green' : 'red'}>{criterion.passed ? 'Pass' : 'Fail'}</Badge><b>{criterion.id.replaceAll('_', ' ')}</b></div>{criterion.evidence_quote && <blockquote>“{criterion.evidence_quote}”</blockquote>}<small>{criterion.reason}</small></div>)}</div>{result.support_verification.risk_flags?.length > 0 && <div className="support-risk-list"><b>Quote-verified policy risks</b>{result.support_verification.risk_flags.map((risk, index) => <div key={index}>{risk.quote && <blockquote>“{risk.quote}”</blockquote>}<small>{risk.reason}</small></div>)}</div>}{result.support_verification.unverified_risk_flags?.length > 0 && <div className="support-risk-list support-risk-unverified"><b>Unverified judge flags · reviewer attention</b>{result.support_verification.unverified_risk_flags.map((risk, index) => <div key={index}><small>{risk.reason}</small><Badge tone="amber">No matching response quote</Badge></div>)}</div>}{result.human_review ? <div className="human-review-result"><Badge tone={result.human_review.verdict === 'accepted' ? 'green' : result.human_review.verdict === 'rejected' ? 'red' : 'amber'}>Human review · {result.human_review.verdict}</Badge><small>{result.human_review.reviewer} · {new Date(result.human_review.reviewed_at).toLocaleString()}</small></div> : <div className="human-review-actions"><span>Human reviewer</span><Button size="sm" variant="secondary" onClick={() => onReview?.(selectedRun.id, 'needs_review')}>Needs review</Button><Button size="sm" variant="secondary" onClick={() => onReview?.(selectedRun.id, 'rejected')}>Reject</Button><Button size="sm" onClick={() => onReview?.(selectedRun.id, 'accepted')}>Accept</Button></div>}</Panel>}
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
        <StatCard icon={FileBarChart} label="Answer quality" value={percent(data.quality_avg)} detail="Task-specific assertions" accent="blue"/>
        <StatCard icon={Globe2} label="Evidence coverage" value={percent(data.evidence_avg)} detail="Research suite only" accent="cyan"/>
        <StatCard icon={ShieldCheck} label="Citation integrity" value={percent(data.citation_integrity_avg)} detail="Evidence-pack linkage" accent="violet"/>
        <StatCard icon={Activity} label="Successful runs" value={`${data.successes}/${data.total_runs}`} detail={`${percent(data.success_rate)} task completion`} accent="green"/>
      </div>
      <Panel className="repeatability-panel">
        <div className="repeatability-heading"><div><div className="eyebrow">REPEATED-TRIAL RELIABILITY</div><h3>One good run is not a benchmark.</h3><p>Observed repeated-trial rates over complete task/configuration groups. pass@k means at least one success in k attempts; pass^k means all k attempts succeed. Earlier RIFT versions labelled pass^k as reliability@k.</p></div><Badge tone={data.repeated_groups ? 'green' : 'muted'}>{data.repeated_groups || 0} repeated groups</Badge></div>
        <div className="repeatability-metrics">
          <div><span>Pass@k</span><b>{percent(data.pass_at_k_pct)}</b><small>At least one success in k trials</small></div>
          <div><span>pass^k · all k succeed</span><b>{percent(data.pass_power_k_pct ?? data.reliability_at_k_pct)}</b><small>RIFT previously labelled this reliability@k; it is the pass^k metric.</small></div>
          <div><span>Mean quality variance</span><b>{data.quality_stddev == null ? '—' : data.quality_stddev.toFixed(3)}</b><small>Population σ across trial groups</small></div>
          <div><span>Repetition count</span><b>{data.repetition_k ? `${data.repetition_k}×` : '—'}</b><small>Maximum complete group size</small></div>
        </div>
      </Panel>
      {data.by_category?.length > 0 && <Panel className="category-summary-panel"><PanelHeading title="Category performance" detail="Separate benchmarks; scores are not pooled into one domain-specific rubric."/><div className="category-table-wrap"><table className="category-table"><thead><tr><th>Category</th><th>Runs</th><th>Success</th><th>Avg quality</th><th>Avg latency</th><th>Avg steps</th><th>Avg tool calls</th></tr></thead><tbody>{data.by_category.map((row) => <tr key={row.category}><td><b>{row.category.replace('_', ' ')}</b></td><td>{number(row.runs)}</td><td>{percent(row.success_rate)}</td><td>{percent(row.quality_avg == null ? null : row.quality_avg * 100)}</td><td>{row.latency_avg_ms == null ? '—' : `${(row.latency_avg_ms / 1000).toFixed(2)}s`}</td><td>{row.steps_avg == null ? '—' : row.steps_avg.toFixed(1)}</td><td>{row.tool_calls_avg == null ? '—' : row.tool_calls_avg.toFixed(1)}</td></tr>)}</tbody></table></div></Panel>}
      <div className="evaluation-grid">
        <Panel className="evaluation-panel"><PanelHeading title="Task quality" detail="Average measured quality by benchmark task."/><div className="evaluation-bars">{data.by_task?.map((task) => <div className="evaluation-bar-row" key={task.task_id}><div><b>{task.task_id}</b><small>{task.runs} runs · {percent(task.success_rate)} success</small></div><div className="evaluation-track"><i style={{width: `${Math.max(0,Math.min(100,(task.quality_avg || 0)*100))}%`}}/></div><strong>{percent(task.quality_avg == null ? null : task.quality_avg*100)}</strong></div>)}</div></Panel>
        <Panel className="evaluation-panel"><PanelHeading title="Execution efficiency" detail="Measured across completed runs."/><div className="evaluation-kpi-list"><div><span>Average execution</span><b>{data.latency_avg_ms == null ? '—' : `${(data.latency_avg_ms/1000).toFixed(2)}s`}</b></div><div><span>Average steps</span><b>{data.steps_avg == null ? '—' : data.steps_avg.toFixed(1)}</b></div><div><span>Average tool calls</span><b>{data.tool_calls_avg == null ? '—' : data.tool_calls_avg.toFixed(1)}</b></div><div><span>Average tokens</span><b>{data.tokens_avg == null ? '—' : number(Math.round(data.tokens_avg))}</b></div><div><span>Total measured cost</span><b>{money(data.total_cost_usd)}</b></div><div><span>Cost per verified success</span><b>{money(data.cost_per_success_usd)}</b></div></div><div className="evaluation-footnote">{data.cost_complete ? 'All runs have configured pricing.' : 'Cost stays unavailable when any run lacks provider or tool pricing.'}</div></Panel>
        <Panel className="evaluation-panel"><PanelHeading title="Resilience by failure mode" detail="Only trials where the selected fault was actually injected contribute to these rates."/><div className="resilience-metrics"><div className="resilience-metric"><span>Provider recovery</span><b>{percent(data.provider_recovery_pct)}</b><small>{data.provider_fault_runs} provider-fault runs</small><ProgressBar value={data.provider_recovery_pct || 0} color="blue"/></div><div className="resilience-metric"><span>Tool outage task success</span><b>{percent(data.tool_fault_success_pct)}</b><small>{data.tool_fault_runs} tool-outage runs</small><ProgressBar value={data.tool_fault_success_pct || 0} color="green"/></div><div className="resilience-metric"><span>Hostile-context task success</span><b>{percent(data.instruction_resistance_pct)}</b><small>{data.instruction_fault_runs} instruction-fault runs</small><ProgressBar value={data.instruction_resistance_pct || 0} color="violet"/></div><div className="resilience-metric"><span>Evidence poison resistance</span><b>{percent(data.poison_resistance_pct)}</b><small>{data.poison_runs} poisoned runs</small><ProgressBar value={data.poison_resistance_pct || 0} color="violet"/></div><div className="resilience-metric"><span>Average injected delay</span><b>{data.avg_added_latency_ms == null ? '—' : `${(data.avg_added_latency_ms/1000).toFixed(2)}s`}</b><small>{data.latency_fault_runs} latency-fault runs</small><ProgressBar value={Math.min(100,(data.avg_added_latency_ms || 0)/4000*100)} color="amber"/></div></div></Panel>
        <Panel className="evaluation-panel"><PanelHeading title="Configuration performance" detail="Matched configuration summaries."/><div className="evaluation-config-list">{(data.by_agent || []).map((item) => <div className="evaluation-config" key={`${item.agent_id}-${item.model}`}><span className="agent-avatar"><Bot size={17}/></span><div><b>{item.agent_name}</b><small>{item.framework} · {item.model}</small><ProgressBar value={item.quality_avg == null ? 0 : item.quality_avg*100}/></div><strong>{percent(item.quality_avg == null ? null : item.quality_avg*100)}</strong></div>)}</div></Panel>
      </div>
    </> : <Panel><EmptyState icon={FileBarChart} title="No evaluation data yet" detail="Run a benchmark to populate quality, evidence, efficiency and resilience metrics." action={<Button onClick={() => { location.hash = 'benchmark' }}>Open Benchmark Lab</Button>}/></Panel>}
  </>
}

function ParetoChart({ results }) {
  const points = results
    .filter((item) => item.cost_per_success_usd != null && item.pass_power_k_pct != null && Number.isFinite(Number(item.cost_per_success_usd)) && Number.isFinite(Number(item.pass_power_k_pct)))
    .map((item) => ({ ...item, cost: Number(item.cost_per_success_usd), reliability: Number(item.pass_power_k_pct) }))
    .filter((item) => item.cost >= 0 && item.reliability >= 0 && item.reliability <= 100)
  const frontier = points.filter((point) => !points.some((other) =>
    other !== point && other.cost <= point.cost && other.reliability >= point.reliability &&
    (other.cost < point.cost || other.reliability > point.reliability)
  )).sort((a, b) => a.cost - b.cost)
  if (!points.length) return <Panel className="pareto-panel"><PanelHeading title="Cost vs reliability frontier" detail="Cost per success vs pass^k."/><EmptyState icon={GitCompareArrows} title="Not enough measured data" detail="Run each agent at least twice and set model pricing to see this chart." /></Panel>
  const W = 760, H = 310, L = 68, R = 24, T = 20, B = 48
  const innerW = W - L - R, innerH = H - T - B
  const maxCost = Math.max(...points.map((point) => point.cost), 0.000001)
  const minCost = Math.min(...points.map((point) => point.cost))
  const spread = Math.max(maxCost - minCost, maxCost * 0.18, 0.000001)
  const xMin = Math.max(0, minCost - spread * 0.12)
  const xMax = maxCost + spread * 0.12
  const x = (cost) => L + ((cost - xMin) / (xMax - xMin || 1)) * innerW
  const y = (reliability) => T + ((100 - reliability) / 100) * innerH
  const polyline = frontier.map((point) => `${x(point.cost)},${y(point.reliability)}`).join(' ')
  return <Panel className="pareto-panel">
    <PanelHeading title="Cost vs reliability frontier" detail="Each point is a complete agent configuration. Lower cost and higher pass^k are better; the frontier marks non-dominated configurations." />
    <div className="pareto-legend"><span><i className="pareto-dot frontier"/> Pareto-efficient</span><span><i className="pareto-dot"/> Other configurations</span><span className="pareto-note">Cost per verified task success · USD</span></div>
    <div className="pareto-chart-wrap">
      <svg className="pareto-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Scatter plot of cost per verified success versus pass to the k power reliability">
        {[0, 25, 50, 75, 100].map((tick) => <g key={tick}><line x1={L} x2={W-R} y1={y(tick)} y2={y(tick)} className="pareto-gridline"/><text x={L-12} y={y(tick)+4} textAnchor="end" className="pareto-axis-label">{tick}%</text></g>)}
        <line x1={L} y1={T} x2={L} y2={H-B} className="pareto-axis"/><line x1={L} y1={H-B} x2={W-R} y2={H-B} className="pareto-axis"/>
        {[0, .25, .5, .75, 1].map((part) => { const value = xMin + (xMax-xMin)*part; return <g key={part}><line x1={x(value)} x2={x(value)} y1={T} y2={H-B} className="pareto-gridline vertical"/><text x={x(value)} y={H-B+22} textAnchor="middle" className="pareto-axis-label">${value.toFixed(value < .01 ? 4 : 3)}</text></g> })}
        <text x={16} y={T+innerH/2} transform={`rotate(-90 16 ${T+innerH/2})`} className="pareto-axis-title" textAnchor="middle">pass^k · all k trials succeed</text>
        <text x={L+innerW/2} y={H-6} className="pareto-axis-title" textAnchor="middle">Cost per verified success (USD)</text>
        {frontier.length > 1 && <polyline points={polyline} className="pareto-frontier-line"/>}
        {points.map((point) => <g key={`${point.agent_id}-${point.model}`} className="pareto-point"><title>{`${point.agent} · ${point.model}\nCost / success: $${point.cost.toFixed(6)}\npass^k: ${point.reliability}%\nk=${point.repetition_k}`}</title><circle cx={x(point.cost)} cy={y(point.reliability)} r={frontier.includes(point) ? 7 : 5} className={frontier.includes(point) ? 'pareto-point-mark frontier' : 'pareto-point-mark'}/><text x={x(point.cost)+10} y={y(point.reliability)-10} className="pareto-point-label">{point.agent}</text></g>)}
      </svg>
    </div>
    <div className="pareto-footnote">Only fully priced, fully repeated configurations are plotted.</div>
  </Panel>
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
      <ParetoChart results={results} />
      <Panel className="compare-panel"><PanelHeading title="Agent configuration comparison" detail="Higher quality is better. Cost stays separate from quality." /><div className="compare-legend"><span><i className="bar-quality" /> Average quality</span><span><i className="bar-success" /> Task success</span></div><div className="compare-bars">{results.map((item) => <div className="compare-row" key={`${item.agent_id}-${item.model}`}><div className="compare-name"><b>{item.agent}</b><small>{item.model}</small></div><div className="compare-bar-stack"><div className="bar-line"><span className="bar-label">Quality</span><div className="bar-track"><i className="bar-quality" style={{ width: `${item.quality_avg || 0}%` }} /></div><b>{percent(item.quality_avg)}</b></div><div className="bar-line"><span className="bar-label">Success</span><div className="bar-track"><i className="bar-success" style={{ width: `${item.success_rate || 0}%` }} /></div><b>{percent(item.success_rate)}</b></div></div><div className="compare-cost"><span>Cost / verified success</span><b>{money(item.cost_per_success_usd)}</b></div></div>)}</div></Panel>
      <div className="stats-grid"><StatCard icon={ShieldCheck} label="Best success" value={percent(Math.max(...results.map((r) => r.success_rate || 0)))} detail="Among tested configurations" accent="green" /><StatCard icon={Clock3} label="Fastest average" value={results.some((r) => r.latency_avg_ms != null) ? `${(Math.min(...results.map((r) => r.latency_avg_ms).filter((x) => x != null)) / 1000).toFixed(2)}s` : '—'} detail="End-to-end latency" accent="cyan" /><StatCard icon={Globe2} label="Best evidence" value={percent(Math.max(...results.map((r) => r.evidence_score_avg || 0)))} detail="Evidence quality" accent="blue" /><StatCard icon={DollarSignIcon} label="Lowest cost / success" value={results.some((r) => r.cost_per_success_usd != null) ? money(Math.min(...results.map((r) => r.cost_per_success_usd).filter((x) => x != null))) : '—'} detail="Only priced runs included" accent="violet" /></div>
      <Panel className="table-panel comparison-detail"><PanelHeading title="Execution quality breakdown" detail="Use matched models to isolate agent strategy, or matched agents to isolate model effects." /><div className="table-scroll"><table><thead><tr><th>Configuration</th><th>Evidence</th><th>Citation integrity</th><th>pass@k</th><th>pass^k</th><th>Steps</th><th>Tool calls</th><th>Tokens</th><th>Latency</th><th>Poison resistance</th><th>Provider recovery</th><th>Tool outage success</th><th>Hostile-context success</th></tr></thead><tbody>{results.map((item) => <tr key={`detail-${item.agent_id}-${item.model}`}><td><b>{item.agent}</b><small>{item.framework} · {item.model}</small></td><td>{percent(item.evidence_score_avg)}</td><td>{percent(item.citation_integrity_avg)}</td><td>{percent(item.pass_at_k_pct)}</td><td>{percent(item.pass_power_k_pct)}</td><td>{number(item.steps_avg)}</td><td>{number(item.tool_calls_avg)}</td><td>{number(item.tokens_avg)}</td><td>{item.latency_avg_ms == null ? '—' : `${(item.latency_avg_ms / 1000).toFixed(2)}s`}</td><td>{percent(item.poison_resistance)}</td><td>{percent(item.provider_recovery)}</td><td>{percent(item.tool_fault_success)}</td><td>{percent(item.instruction_resistance)}</td></tr>)}</tbody></table></div></Panel>
      <Panel className="attribution-panel"><div className="attribution-mark"><GitCompareArrows size={20} /></div><div><b>Compare the agent configuration at task level.</b><p>Same model does not mean same agent configuration. Prompts, tools, memory, orchestration and retry strategies change task-level cost and outcomes. pass@k means at least one success in k trials; pass^k means all k trials succeed. Earlier RIFT versions labelled pass^k as reliability@k.</p></div></Panel>
    </> : <Panel><EmptyState title="No comparison data yet" detail="Complete a benchmark experiment with at least one agent and task." /></Panel>}
  </>
}

function LeaderboardPage({ entries, onRefresh }) {
  const best = entries[0]
  return <>
    <PageHeading page="leaderboard" action={<Button variant="secondary" icon={RefreshCw} onClick={onRefresh}>Refresh</Button>} />
    {best && <div className="leader-hero"><div><div className="eyebrow">CURRENT FRONT RUNNER</div><h2>{best.name}</h2><p>{best.framework} · {best.model}</p><div className="leader-hero-stats"><div><b>{percent(best.success_rate)}</b><span>Success</span></div><div><b>{best.quality}%</b><span>Quality</span></div><div><b>{money(best.cost_per_success_usd)}</b><span>Cost / success</span></div></div></div><div className="leader-cup"><Trophy size={54} /></div></div>}
    <Panel className="table-panel"><PanelHeading title="Agent leaderboard" detail="Completed benchmark runs only. Incomplete and unpriced values remain visible as unavailable." /><div className="table-scroll"><table><thead><tr><th>Rank</th><th>Configuration</th><th>Runs</th><th>Success</th><th>Quality</th><th>Latency</th><th>Avg steps</th><th>Tokens</th><th>Cost / success</th><th>Provider</th><th>Tool outage</th><th>Hostile context</th></tr></thead><tbody>{entries.map((entry, i) => <tr key={`${entry.agent_id}-${entry.model}`}><td><span className={`rank-mark rank-${i + 1}`}>{String(i + 1).padStart(2, '0')}</span></td><td><b>{entry.name}</b><small>{entry.framework} · {entry.model}</small></td><td>{entry.runs}</td><td><b>{percent(entry.success_rate)}</b></td><td>{entry.quality}%</td><td>{(entry.avg_latency_ms / 1000).toFixed(2)}s</td><td>{entry.avg_steps == null ? '—' : entry.avg_steps.toFixed(1)}</td><td>{number(entry.avg_tokens)}</td><td>{money(entry.cost_per_success_usd)}</td><td>{percent(entry.provider_recovery_pct)}</td><td>{percent(entry.tool_fault_success_pct)}</td><td>{percent(entry.instruction_resistance_pct)}</td></tr>)}</tbody></table></div>{!entries.length && <EmptyState icon={Trophy} title="No ranked runs yet" detail="Complete a benchmark before the leaderboard can rank an agent." />}</Panel>
  </>
}

function SettingsPage({ integrations, onTest, checking, health }) {
  const [copied, setCopied] = useState('')
  const mcpUrl = 'https://riftz.vercel.app/mcp/'
  async function copy(value, label) {
    try {
      await navigator.clipboard?.writeText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(''), 1800)
    } catch {
      setCopied('Copy unavailable')
    }
  }
  const databaseType = integrations?.database?.type || health?.database || 'sqlite'
  const databaseLabel = databaseType === 'neon-postgres' ? 'Neon PostgreSQL' : 'Embedded storage'
  const connected = integrations?.mode === 'connected'
  return <>
    <PageHeading page="settings" action={<Button icon={RefreshCw} variant="secondary" onClick={onTest} disabled={checking}>{checking ? 'Verifying…' : 'Verify integrations'}</Button>} />
    <div className="settings-grid">
      <Panel className="integration-panel">
        <PanelHeading title="Connected services" detail="Credentials remain on the backend." />
        <div className="integration-row"><span className="integration-logo bifrost-logo"><Network size={20} /></span><div className="integration-copy"><b>Bifrost AI Gateway</b><small>{integrations?.bifrost?.base_url || 'Base URL not configured'} · {integrations?.bifrost?.model || 'Model route not set'}</small></div><Badge tone={integrations?.bifrost?.configured ? 'green' : 'amber'} dot>{integrations?.bifrost?.configured ? 'Configured' : 'Missing'}</Badge></div>
        <div className="integration-row"><span className="integration-logo tavily-logo"><Globe2 size={20} /></span><div className="integration-copy"><b>Tavily Research</b><small>{integrations?.tavily?.base_url || 'https://api.tavily.com'}</small></div><Badge tone={integrations?.tavily?.configured ? 'green' : 'amber'} dot>{integrations?.tavily?.configured ? 'Configured' : 'Missing'}</Badge></div>
        <div className="integration-row"><span className="integration-logo db-logo"><Database size={20} /></span><div className="integration-copy"><b>Database</b><small>{databaseLabel}</small></div><Badge tone={databaseType === 'neon-postgres' ? 'green' : 'blue'} dot>{databaseType === 'neon-postgres' ? 'Neon connected' : 'Available'}</Badge></div>
        <div className="verify-results">{health && <div className="verify-chip"><Check size={14} /> API reachable · {health.status}</div>}{integrations?.mode && <div className="verify-chip"><Radio size={14} /> {connected ? 'Services connected' : 'Setup required'}</div>}{health?.mcp?.enabled && <div className="verify-chip"><Network size={14} /> Remote MCP endpoint ready</div>}</div>
      </Panel>
      <Panel className="setup-panel">
        <PanelHeading title="Service configuration" detail="Set these values in the backend environment." />
        <div className="env-snippet">
          <div><span>DATABASE_URL</span><code>postgresql://USER:PASSWORD@HOST/DB?sslmode=require</code><button onClick={() => copy('DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require', 'database')} aria-label="Copy database variable"><Copy size={14} /></button></div>
          <div><span>BIFROST_BASE_URL</span><code>https://bifrost-deploy.onrender.com/v1</code><button onClick={() => copy('BIFROST_BASE_URL=https://bifrost-deploy.onrender.com/v1', 'bifrost')} aria-label="Copy Bifrost URL"><Copy size={14} /></button></div>
          <div><span>BIFROST_API_KEY</span><code>your Bifrost virtual key</code><button onClick={() => copy('BIFROST_API_KEY=', 'key')} aria-label="Copy Bifrost key variable"><Copy size={14} /></button></div>
          <div><span>BIFROST_MODEL</span><code>general</code><button onClick={() => copy('BIFROST_MODEL=general', 'model')} aria-label="Copy model variable"><Copy size={14} /></button></div>
          <div><span>TAVILY_API_KEY</span><code>tvly-your-key</code><button onClick={() => copy('TAVILY_API_KEY=', 'tavily')} aria-label="Copy Tavily variable"><Copy size={14} /></button></div>
        </div>
        {copied && <div className="copy-state">{copied === 'Copy unavailable' ? copied : `Copied ${copied === 'database' ? 'database template' : copied} variable.`}</div>}
        <div className="setup-tip"><ShieldCheck size={16} /><span>Never paste provider secrets into frontend code or commit your environment file. RIFT reads credentials on the server only.</span></div>
        <div className="setup-links"><a href="https://neon.tech/docs/get-started/connect-neon" target="_blank" rel="noreferrer">Neon connection guide <ExternalLink size={13} /></a><a href="https://docs.getbifrost.ai" target="_blank" rel="noreferrer">Bifrost docs <ExternalLink size={13} /></a><a href="https://docs.tavily.com" target="_blank" rel="noreferrer">Tavily docs <ExternalLink size={13} /></a></div>
      </Panel>
      <Panel className="mcp-connector-panel full-span">
        <div className="mcp-connector-head">
          <div><div className="eyebrow">MODEL CONTEXT PROTOCOL</div><h3>Connect RIFT to your AI assistants</h3><p>Give ChatGPT, Claude and other MCP-compatible clients full read-only access to RIFT's benchmark data, experiment records, run traces, evidence and evaluation reports.</p></div>
          <span className="mcp-connector-mark"><Network size={25} /></span>
        </div>
        <div className="mcp-endpoint-row"><div><span>Remote MCP endpoint</span><code>{mcpUrl}</code></div><Button size="sm" icon={copied === 'mcp' ? Check : Copy} onClick={() => copy(mcpUrl, 'mcp')}>{copied === 'mcp' ? 'Copied' : 'Copy URL'}</Button></div>
        <div className="mcp-client-grid">
          <a className="mcp-client-card" href="https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt" target="_blank" rel="noreferrer"><span className="mcp-client-icon chatgpt"><Bot size={20} /></span><span><b>ChatGPT</b><small>Custom MCP app setup</small></span><ExternalLink size={14} /></a>
          <a className="mcp-client-card" href="https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp" target="_blank" rel="noreferrer"><span className="mcp-client-icon claude"><Sparkles size={20} /></span><span><b>Claude</b><small>Remote connector setup</small></span><ExternalLink size={14} /></a>
          <div className="mcp-client-card mcp-client-generic"><span className="mcp-client-icon other"><Command size={20} /></span><span><b>Other MCP clients</b><small>Streamable HTTP transport</small></span><Badge tone="green">Standard</Badge></div>
        </div>
        <div className="mcp-scope-row"><span><ShieldCheck size={16} /> Full read-only access</span><p>Assistants can search and inspect every saved RIFT data area: tasks, agents, complete experiment configuration, runs, ordered event traces, research sources, evidence snapshots, evaluation metrics, comparison reports and leaderboards. They cannot launch or cancel runs, register agents, change settings or trigger provider usage.</p></div>
        <div className="mcp-tools-list"><span>21 read-only tools</span><code>rift_search_workspace</code><code>rift_get_data_catalog</code><code>rift_get_overview</code><code>rift_list_tasks</code><code>rift_get_task</code><code>rift_list_agents</code><code>rift_get_agent</code><code>rift_list_experiments</code><code>rift_get_experiment</code><code>rift_list_runs</code><code>rift_get_run</code><code>rift_get_run_events</code><code>rift_list_events</code><code>rift_get_experiment_evidence</code><code>rift_get_leaderboard</code><code>rift_get_evaluation_summary</code><code>rift_get_experiment_report</code><code>rift_list_research_snapshots</code><code>rift_get_research_snapshot</code><code>rift_get_integration_status</code><code>rift_get_database_summary</code></div>
        <div className="mcp-public-warning"><ShieldCheck size={16} /><p><b>Shared demo workspace</b> Authentication is disabled in this build. Do not expose this read-only connector or the shared workspace to untrusted users.</p></div><p className="mcp-connect-note">Add the URL as a remote MCP server in your assistant's connector settings. Support depends on your plan and workspace permissions.</p>
      </Panel>
      <Panel className="setup-panel full-span"><PanelHeading title="Usage and evaluation" detail="Keep benchmark reports interpretable." /><div className="settings-info-grid"><div><b>Cost calculation</b><p>Set model input and output price per million tokens, plus Tavily search cost, to enable cost per verified success.</p></div><div><b>Evidence snapshots</b><p>Collect the same Tavily evidence once and share it across matched agents for fair comparison.</p></div><div><b>Live execution</b><p>Run real provider and research calls. Public web results may change between executions.</p></div><div><b>Agent instrumentation</b><p>Gateway usage is observable. Internal planning steps require adapter or OpenTelemetry events.</p></div></div></Panel>
    </div>
  </>
}


function MCPMonitorPage() {
  const [monitors, setMonitors] = useState([])
  const [selected, setSelected] = useState(null)
  const [selectedSnapshotId, setSelectedSnapshotId] = useState(null)
  const [name, setName] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const load = useCallback(async () => {
    try { const result = await api('/mcp-monitors'); setMonitors(result.monitors || []) }
    catch (e) { setError(e.message) }
  }, [])
  useEffect(() => { load() }, [load])
  const open = async (id) => {
    try { const detail = await api(`/mcp-monitors/${id}`); setSelected(detail); setSelectedSnapshotId(detail.snapshots?.[0]?.id || null); setError('') }
    catch (e) { setError(e.message) }
  }
  const create = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const result = await api('/mcp-monitors', { method: 'POST', body: JSON.stringify({ name, endpoint }) })
      setNotice(`Baseline captured · manifest v${result.version}`); setName(''); setEndpoint(''); await load(); await open(result.monitor_id)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  const scan = async (id) => {
    setBusy(true); setError(''); setNotice('')
    try { const result = await api(`/mcp-monitors/${id}/scan`, { method: 'POST' }); setNotice(result.changed ? `Manifest changed · captured v${result.version}` : 'No manifest changes detected.'); await load(); await open(id) }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  const remove = async (id) => {
    if (!window.confirm('Remove this MCP monitor and its captured manifest history?')) return
    try { await api(`/mcp-monitors/${id}`, { method: 'DELETE' }); setSelected(null); await load() }
    catch (e) { setError(e.message) }
  }
  const snapshots = selected?.snapshots || []
  const latest = snapshots[0]
  const viewingSnapshot = snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) || latest
  const latestChanges = viewingSnapshot?.changes?.filter((change) => change.kind !== 'initial_snapshot' && change.kind !== 'no_change') || []
  return <>
    <PageHeading page="mcp" action={<Button variant="secondary" icon={RefreshCw} onClick={load}>Refresh list</Button>} />
    <div className="mcp-monitor-layout">
      <div className="mcp-monitor-main">
        <Panel className="mcp-monitor-form-panel">
          <PanelHeading title="Add an MCP endpoint" detail="RIFT reads initialize and tools/list, captures a baseline and re-scans every 15 minutes." />
          <form className="mcp-monitor-form" onSubmit={create}>
            <Field label="Display name"><input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} placeholder="Internal knowledge server" /></Field>
            <Field label="Streamable HTTP endpoint" hint="Public, unauthenticated HTTPS endpoints only. localhost is allowed for local development. Private IP ranges are blocked."><input type="url" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} required placeholder="https://mcp.example.com/mcp" /></Field>
            <div className="mcp-form-footer"><span><ShieldCheck size={14}/> Read-only discovery. RIFT calls initialize and tools/list only.</span><Button type="submit" icon={Plus} disabled={busy}>{busy ? 'Connecting…' : 'Capture baseline'}</Button></div>
          </form>
          {error && <div className="form-error">{error}</div>}{notice && <div className="inline-success"><Check size={14}/>{notice}</div>}
        </Panel>
        <Panel className="mcp-monitor-list-panel">
          <PanelHeading title="Monitored servers" detail={`${monitors.length} endpoints tracked`} action={<Badge tone="muted">Manifest history</Badge>} />
          {monitors.length ? <div className="monitor-list">{monitors.map((monitor) => <button key={monitor.id} className={`monitor-list-item ${selected?.monitor?.id === monitor.id ? 'selected' : ''}`} onClick={() => open(monitor.id)}><span className="monitor-icon"><Server size={17}/></span><span className="monitor-list-copy"><b>{monitor.name}</b><small>{monitor.endpoint}</small><em>{monitor.tool_count} tools · {monitor.snapshot_count} snapshots · v{monitor.latest_version}</em></span><Badge tone={monitor.status === 'active' ? 'green' : 'red'} dot>{monitor.status}</Badge><ChevronRight size={15}/></button>)}</div> : <EmptyState icon={Fingerprint} title="No MCP endpoints monitored" detail="Add a Streamable HTTP server to capture its initial tool manifest." />}
        </Panel>
      </div>
      <div className="mcp-monitor-detail">
        {selected ? <>
          <Panel className="monitor-detail-head"><div className="monitor-detail-title"><div className="eyebrow">MANIFEST HISTORY</div><h2>{selected.monitor?.name}</h2><p>{selected.monitor?.endpoint}</p></div><div className="monitor-detail-actions"><Button size="sm" variant="secondary" icon={RefreshCw} disabled={busy} onClick={() => scan(selected.monitor.id)}>Scan now</Button><Button size="sm" variant="quiet" icon={Trash2} onClick={() => remove(selected.monitor.id)}>Remove</Button></div></Panel>
          <Panel className="monitor-snapshot-panel"><PanelHeading title={viewingSnapshot ? `Manifest snapshot · v${viewingSnapshot.version}` : 'Manifest snapshot'} detail={viewingSnapshot ? `Captured ${relativeTime(viewingSnapshot.captured_at)} · ${viewingSnapshot.manifest_hash.slice(0, 16)}` : 'No snapshots yet'} />
            {viewingSnapshot ? <><div className="monitor-metrics"><div><b>{viewingSnapshot.version}</b><small>Version</small></div><div><b>{viewingSnapshot.manifest?.tools?.length || 0}</b><small>Tools</small></div><div><b>{latestChanges.length}</b><small>Changes in version</small></div></div>
            {latestChanges.length ? <div className="change-list">{latestChanges.map((change, index) => <div className="change-row" key={`${change.kind}-${change.tool || index}`}><span className={`change-severity severity-${change.severity}`}/><div><b>{change.summary}</b><small>{change.kind.replaceAll('_', ' ')}{change.tool ? ` · ${change.tool}` : ''}</small>{change.before !== undefined || change.after !== undefined ? <details className="change-inspect"><summary>Inspect change</summary><div className="change-diff-grid"><div><small>Previous</small><pre>{JSON.stringify(change.before ?? null, null, 2)}</pre></div><div><small>Current</small><pre>{JSON.stringify(change.after ?? null, null, 2)}</pre></div></div></details> : null}</div><Badge tone={change.severity === 'critical' || change.severity === 'high' ? 'red' : change.severity === 'medium' ? 'amber' : 'muted'}>{change.severity}</Badge></div>)}</div> : <div className="monitor-no-change"><Check size={15}/> No changes in this snapshot.</div>}
            <div className="manifest-tools"><div className="eyebrow">EXPOSED TOOLS</div>{(viewingSnapshot.manifest?.tools || []).map((tool) => <div className="manifest-tool" key={tool.name}><code>{tool.name}</code><span>{tool.description || 'No description supplied'}</span><small>{tool.annotations?.readOnlyHint === true ? 'Read only' : tool.annotations?.destructiveHint === true ? 'Destructive hint' : 'No read-only hint'}</small></div>)}</div></> : <EmptyState title="No manifest captured" detail="Scan the endpoint to create its first snapshot." />}
          </Panel>
          <Panel className="monitor-history-panel"><PanelHeading title="Snapshot history" detail="Select a version to inspect its exact manifest" />{snapshots.map((snapshot) => <button className={`snapshot-history-row ${viewingSnapshot?.id === snapshot.id ? 'selected' : ''}`} key={snapshot.id} onClick={() => setSelectedSnapshotId(snapshot.id)}><span className="snapshot-version">v{snapshot.version}</span><div><b>{snapshot.changes?.length === 1 && snapshot.changes[0].kind === 'no_change' ? 'No changes' : `${snapshot.changes?.length || 0} manifest changes`}</b><small>{relativeTime(snapshot.captured_at)}</small></div><code>{snapshot.manifest_hash.slice(0, 12)}</code></button>)}</Panel>
        </> : <Panel className="monitor-empty"><EmptyState icon={ScanSearch} title="Select a monitored server" detail="Choose an endpoint to inspect tool definitions, permission hints and manifest changes." /></Panel>}
      </div>
    </div>
  </>
}

function CounterfactualsPage({ onSelectRun }) {
  const [analyses, setAnalyses] = useState([])
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([api('/counterfactual-analyses'), api('/runs?limit=100')])
      setAnalyses(a.analyses || []); setRuns(r.runs || []); setError('')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load(); const timer = window.setInterval(load, 3500); return () => window.clearInterval(timer) }, [load])
  const runAnalysis = async (runId) => {
    try { await api(`/runs/${runId}/counterfactual-analysis`, { method: 'POST', body: '{}' }); await load() }
    catch (e) { setError(e.message) }
  }
  return <>
    <PageHeading page="counterfactuals" action={<Button variant="secondary" icon={RefreshCw} onClick={load}>Refresh</Button>} />
    <Panel className="analysis-run-picker"><PanelHeading title="Choose an execution" detail="RIFT reads the recorded trace, identifies observable fault signals and launches controlled one-variable reruns." /><div className="analysis-run-list">{runs.filter((run) => ['completed', 'failed', 'cancelled'].includes(run.status)).slice(0, 12).map((run) => <div className="analysis-run-row" key={run.id}><div className="run-id-mark"><Bug size={16}/></div><div><b>{run.agent_name || run.agent_id}</b><small>{run.task_id} · {short(run.id)} · {relativeTime(run.started_at)}</small></div><Badge tone={toneForStatus(run.status)}>{run.status}</Badge><Button size="sm" variant="secondary" onClick={() => runAnalysis(run.id)}>Analyze</Button></div>)}{!runs.length && <EmptyState title="No completed runs" detail="Run a benchmark before launching a counterfactual analysis." />}</div></Panel>
    {error && <div className="form-error">{error}</div>}
    <div className="counterfactual-analysis-list">{analyses.map((analysis) => <Panel className="counterfactual-card" key={analysis.id}><div className="counterfactual-card-head"><div><div className="eyebrow">ANALYSIS / {short(analysis.id)}</div><h3>Run {short(analysis.run_id)}</h3><small>{relativeTime(analysis.created_at)}</small></div><Badge tone={analysis.variants?.every((variant) => ['completed','failed','cancelled'].includes(variant.status)) ? 'green' : 'blue'} dot>{analysis.variants?.every((variant) => ['completed','failed','cancelled'].includes(variant.status)) ? 'Comparisons ready' : 'Reruns in progress'}</Badge></div>
      <div className="analysis-findings">{(analysis.findings || []).map((finding, index) => <div className="analysis-finding" key={`${finding.cause}-${index}`}><span className={`finding-dot finding-${finding.signal_strength}`}/><div><b>{finding.cause}</b><small>{finding.rationale}</small></div><Badge tone={finding.signal_strength === 'high' ? 'red' : finding.signal_strength === 'medium' ? 'amber' : 'muted'}>{finding.signal_strength} signal</Badge></div>)}</div>
      <div className="variant-table-wrap"><table className="variant-table"><thead><tr><th>Controlled variation</th><th>Status</th><th>Quality</th><th>Task outcome</th><th>Latency</th></tr></thead><tbody>{(analysis.variants || []).map((variant) => <tr key={variant.run_id}><td><b>{variant.label}</b><small>{Object.entries(variant.faults || {}).filter(([,value]) => value).map(([key]) => key).join(', ') || 'No injected faults'}</small></td><td><Badge tone={toneForStatus(variant.status)}>{variant.status}</Badge></td><td>{variant.result?.quality == null ? '—' : percent(variant.result.quality * 100)}</td><td>{variant.result?.success == null ? '—' : variant.result.success ? 'Passed' : 'Failed'}</td><td>{variant.result?.latency_ms == null ? '—' : `${(variant.result.latency_ms / 1000).toFixed(2)}s`}</td></tr>)}</tbody></table></div>
      <div className="analysis-disclaimer">These are controlled rerun comparisons. Signal strength describes trace evidence, not statistical proof of causality.</div>
    </Panel>)}{!loading && !analyses.length && <Panel><EmptyState icon={ScanSearch} title="No failure analyses yet" detail="Choose a finished execution above. RIFT will create a clean control and one-variable fault removals." /></Panel>}</div>
  </>
}

function RegressionPage({ agents }) {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [suiteAgentId, setSuiteAgentId] = useState(agents[0]?.id || '')
  const [suiteBusy, setSuiteBusy] = useState(false)
  const [suiteNotice, setSuiteNotice] = useState('')
  const load = useCallback(async () => { try { const result = await api('/regression-cases'); setCases(result.cases || []); setError('') } catch (e) { setError(e.message) } finally { setLoading(false) } }, [])
  useEffect(() => { load(); const timer = window.setInterval(load, 3500); return () => window.clearInterval(timer) }, [load])
  useEffect(() => { if (!suiteAgentId && agents.length) setSuiteAgentId(agents[0].id) }, [agents, suiteAgentId])
  const replay = async (caseId, agentId) => {
    try { await api(`/regression-cases/${caseId}/replay`, { method: 'POST', body: JSON.stringify({ agent_id: agentId || null }) }); await load() }
    catch (e) { setError(e.message) }
  }
  const replaySuite = async () => {
    if (!suiteAgentId || !cases.length || suiteBusy) return
    const liveCases = cases.filter((item) => item.mode === 'live').length
    const costNote = liveCases ? `\n\n${liveCases} saved case(s) use live mode and may incur provider costs.` : ''
    if (!window.confirm(`Run all ${cases.length} saved regression case(s) against ${agents.find((agent) => agent.id === suiteAgentId)?.name || suiteAgentId}?${costNote}`)) return
    setSuiteBusy(true); setSuiteNotice('')
    try {
      const result = await api('/regression-cases/replay-suite', { method: 'POST', body: JSON.stringify({ agent_id: suiteAgentId }) })
      setSuiteNotice(`${result.queued_count} regression replay(s) queued against ${suiteAgentId}.`)
      await load()
    } catch (e) { setError(e.message) }
    finally { setSuiteBusy(false) }
  }
  const remove = async (caseId) => {
    if (!window.confirm('Delete this regression case and its replay history?')) return
    try { await api(`/regression-cases/${caseId}`, { method: 'DELETE' }); await load() }
    catch (e) { setError(e.message) }
  }
  return <>
    <PageHeading page="regression" action={<Button variant="secondary" icon={RefreshCw} onClick={load}>Refresh cases</Button>} />
    <Panel className="regression-intro"><div className="regression-intro-icon"><History size={22}/></div><div><h2>Failures worth remembering</h2><p>Save a finished run as a regression case. RIFT preserves the task, agent route, seed, fault schedule and evidence snapshot so future executions can be compared against the same conditions.</p></div><div className="regression-count"><b>{cases.length}</b><small>saved cases</small></div></Panel>
    <Panel className="regression-suite-bar"><div><b>Run the saved suite</b><p>After registering an updated agent adapter, replay every case against that version. Each replay keeps its original seed and evidence.</p></div><Field label="Target agent"><select value={suiteAgentId} onChange={(event) => setSuiteAgentId(event.target.value)}><option value="">Select an agent</option>{agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}</select></Field><Button icon={Play} disabled={!cases.length || !suiteAgentId || suiteBusy} onClick={replaySuite}>{suiteBusy ? 'Queueing suite…' : `Run all ${cases.length} cases`}</Button></Panel>
    {suiteNotice && <div className="inline-success"><Check size={14}/>{suiteNotice}</div>}
    {error && <div className="form-error">{error}</div>}
    <div className="regression-grid">{cases.map((item) => <Panel className="regression-card" key={item.id}><div className="regression-card-top"><span className="regression-case-mark"><FilePlus2 size={17}/></span><Badge tone="muted">{item.task_id}</Badge><button className="icon-button small" onClick={() => remove(item.id)} aria-label="Delete regression case"><Trash2 size={14}/></button></div><h3>{item.title}</h3><p>{item.description || 'Captured from a recorded execution.'}</p><div className="regression-meta"><span><b>{item.agent_id}</b><small>Agent</small></span><span><b>{item.model}</b><small>Model</small></span><span><b>{item.replays?.length || 0}</b><small>Replays</small></span></div><div className="regression-baseline"><span>Baseline outcome</span><Badge tone={item.baseline_result?.success ? 'green' : 'red'}>{item.baseline_result?.success ? 'Passed' : 'Failed'}</Badge><span>Quality</span><b>{item.baseline_result?.quality == null ? '—' : percent(item.baseline_result.quality * 100)}</b></div><Field label="Replay against agent"><select id={`agent-${item.id}`} defaultValue={item.agent_id}><option value={item.agent_id}>{item.agent_id} · baseline</option>{agents.filter((agent) => agent.id !== item.agent_id).map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></Field><Button block icon={Play} onClick={() => replay(item.id, document.getElementById(`agent-${item.id}`)?.value)}>Replay test case</Button><div className="regression-replay-list">{(item.replays || []).slice(0, 3).map((replay) => { const hasOutcome = replay.result?.success != null; const baselinePassed = Boolean(item.baseline_result?.success); const replayPassed = Boolean(replay.result?.success); const outcome = !hasOutcome ? 'Pending' : !baselinePassed && replayPassed ? 'Resolved' : baselinePassed && !replayPassed ? 'Regression' : baselinePassed ? 'Stable' : 'Still failing'; const tone = outcome === 'Resolved' || outcome === 'Stable' ? 'green' : outcome === 'Regression' ? 'red' : 'muted'; return <div key={replay.replay_id}><span className={`tiny-status ${toneForStatus(replay.status)}`}/><small>{short(replay.run_id)} · {relativeTime(replay.created_at)}</small><Badge tone={tone}>{outcome}</Badge><b>{replay.result?.quality == null ? '—' : percent(replay.result.quality * 100)}</b></div>})}</div></Panel>)}{!loading && !cases.length && <Panel className="regression-empty"><EmptyState icon={History} title="Regression memory is empty" detail="Open a completed or failed run in Run inspector and choose Save regression to preserve it." /></Panel>}</div>
  </>
}

function GatewayOverviewPage({ integrations, onNavigate }) {
  const [snapshot, setSnapshot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try { const result = await api('/gateway/overview'); setSnapshot(result); setError('') }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load(); const timer = window.setInterval(load, 10000); return () => window.clearInterval(timer) }, [load])
  const connected = Boolean(integrations?.bifrost?.configured)
  const recent = snapshot?.recent_evaluations || []
  return <>
    <PageHeading page="overview" action={<Button icon={Route} onClick={() => onNavigate('route-lab')}>Evaluate routes</Button>} />
    <Panel className="gateway-status-strip">
      <div className="gateway-status-main"><span className={`gateway-status-led ${connected ? 'is-live' : ''}`} /><div><span className="eyebrow">BIFROST GATEWAY</span><h2>{connected ? 'Gateway connection configured' : 'Gateway connection required'}</h2><p>{integrations?.bifrost?.base_url || 'Set BIFROST_BASE_URL in the backend environment.'}</p></div></div>
      <div className="gateway-status-meta"><div><small>Default route</small><b>{integrations?.bifrost?.model || 'Not configured'}</b></div><div><small>Telemetry source</small><b>RIFT route trials</b></div><Badge tone={connected ? 'green' : 'amber'} dot>{connected ? 'Configured' : 'Setup required'}</Badge></div>
    </Panel>
    {error && <div className="form-error">{error}</div>}
    <div className="gateway-kpi-grid">
      <StatCard icon={Route} label="Route evaluations" value={number(snapshot?.evaluations)} detail="Saved matched experiments" accent="blue" />
      <StatCard icon={Activity} label="Gateway calls tested" value={number(snapshot?.completed_trials)} detail={`${number(snapshot?.trials)} total trial attempts`} accent="cyan" />
      <StatCard icon={Gauge} label="Mean response time" value={snapshot?.avg_latency_ms == null ? '—' : `${Math.round(snapshot.avg_latency_ms)} ms`} detail="Across completed route trials" accent="violet" />
      <StatCard icon={CheckCircle2} label="Assertion pass rate" value={percent(snapshot?.pass_rate)} detail="Explicit workload assertions" accent="green" />
    </div>
    <div className="gateway-dashboard-grid">
      <Panel className="gateway-recent-panel">
        <PanelHeading title="Recent route evaluations" detail="Same prompts, different Bifrost model routes" action={<Button size="sm" variant="secondary" onClick={() => onNavigate('route-lab')}>Open route lab <ArrowRight size={13}/></Button>} />
        {recent.length ? <div className="table-scroll"><table className="gateway-table"><thead><tr><th>Evaluation</th><th>Routes</th><th>Recommended route</th><th>Status</th><th>Created</th></tr></thead><tbody>{recent.map((item) => <tr key={item.id}><td><b>{item.title}</b><small className="mono">{short(item.id)}</small></td><td>{(item.models || []).length}</td><td>{item.summary?.recommended_model || 'Pending'}</td><td><Badge tone={toneForStatus(item.status)} dot>{item.status}</Badge></td><td>{relativeTime(item.created_at)}</td></tr>)}</tbody></table></div> : <EmptyState icon={Route} title="No route evaluations yet" detail="Start with the built-in RIFT Gateway Core workload. Each candidate route receives the same prompts." action={<Button onClick={() => onNavigate('route-lab')}>Start first evaluation</Button>} />}
      </Panel>
      <Panel className="gateway-brief-panel">
        <PanelHeading title="What RIFT measures" detail="The layer above your gateway" />
        <div className="gateway-brief-list">
          <div><span className="gateway-brief-icon"><Scale size={17}/></span><div><b>Quality-adjusted routing</b><p>Choose a route by task outcomes, not latency or price alone.</p></div></div>
          <div><span className="gateway-brief-icon"><Clock size={17}/></span><div><b>Workload replay</b><p>Replay representative prompts against candidate routes under matched conditions.</p></div></div>
          <div><span className="gateway-brief-icon"><ShieldCheck size={17}/></span><div><b>Release confidence</b><p>Keep failure cases and compare new route configurations before rollout.</p></div></div>
        </div>
        <div className="gateway-brief-actions"><Button variant="secondary" block onClick={() => onNavigate('traffic')}>Import workload</Button><Button variant="secondary" block onClick={() => onNavigate('chaos')}>Test failure recovery</Button></div>
      </Panel>
    </div>
    <div className="gateway-footnote"><AlertCircle size={14}/><span>Numbers on this page come from RIFT's own route evaluations. They are not live Bifrost production traffic metrics unless you import and replay that traffic.</span></div>
  </>
}

function RouteLabPage({ initialWorkloadId, onWorkloadUsed, onNavigate }) {
  const [workloads, setWorkloads] = useState([])
  const [modelsAvailable, setModelsAvailable] = useState([])
  const [gatewayConfigured, setGatewayConfigured] = useState(false)
  const [modelsText, setModelsText] = useState('')
  const [workloadId, setWorkloadId] = useState(initialWorkloadId || '')
  const [objective, setObjective] = useState('balanced')
  const [title, setTitle] = useState('Bifrost route comparison')
  const [evaluations, setEvaluations] = useState([])
  const [activeId, setActiveId] = useState('')
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      const [w, m, e] = await Promise.all([api('/gateway/workloads'), api('/gateway/models'), api('/gateway/route-evaluations')])
      setWorkloads(w.workloads || []); setModelsAvailable(m.models || []); setGatewayConfigured(Boolean(m.configured));
      setEvaluations(e.evaluations || [])
      if (!workloadId && w.workloads?.length) setWorkloadId(initialWorkloadId || w.workloads[0].id)
      if (!modelsText && m.models?.length) setModelsText(m.models.slice(0, 3).join(', '))
      setError('')
    } catch (e) { setError(e.message) }
  }, [initialWorkloadId, modelsText, workloadId])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (initialWorkloadId) setWorkloadId(initialWorkloadId) }, [initialWorkloadId])
  const refreshDetail = useCallback(async (id) => {
    if (!id) return
    try { const result = await api(`/gateway/route-evaluations/${id}`); setDetail(result); setEvaluations((old) => [result, ...old.filter((item) => item.id !== result.id)]) }
    catch (e) { setError(e.message) }
  }, [])
  useEffect(() => {
    if (!activeId) return undefined
    refreshDetail(activeId)
    const timer = window.setInterval(() => refreshDetail(activeId), 2500)
    return () => window.clearInterval(timer)
  }, [activeId, refreshDetail])
  const selectedWorkload = workloads.find((item) => item.id === workloadId)
  const models = [...new Set(modelsText.split(',').map((item) => item.trim()).filter(Boolean))]
  const launch = async () => {
    if (!selectedWorkload || !models.length || busy) return
    setBusy(true); setError(''); setDetail(null)
    try {
      const result = await api('/gateway/route-evaluations', { method: 'POST', body: JSON.stringify({ title, workload_id: workloadId, models, objective }) })
      setActiveId(result.evaluation_id); onWorkloadUsed?.(workloadId)
      await load()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  const openEvaluation = async (id) => { setActiveId(id); await refreshDetail(id) }
  return <>
    <PageHeading page="route-lab" action={<Button variant="secondary" icon={Upload} onClick={() => onNavigate('traffic')}>Manage workloads</Button>} />
    <div className="route-lab-layout">
      <Panel className="route-config-panel">
        <PanelHeading title="Evaluation setup" detail="One workload, identical prompts, multiple Bifrost routes." />
        <Field label="Evaluation name"><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} /></Field>
        <Field label="Workload"><select value={workloadId} onChange={(e) => { setWorkloadId(e.target.value); onWorkloadUsed?.(e.target.value) }}>{workloads.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.cases?.length || 0} cases</option>)}</select></Field>
        <Field label="Bifrost model routes" hint="Use the exact model IDs or routing aliases exposed by your Bifrost instance. Separate with commas."><input value={modelsText} onChange={(e) => setModelsText(e.target.value)} placeholder="general, fast, quality" /></Field>
        {modelsAvailable.length > 0 && <div className="route-model-suggestions"><small>Discovered routes</small><div>{modelsAvailable.map((model) => <button key={model} type="button" onClick={() => setModelsText((old) => [...new Set([...old.split(',').map((v) => v.trim()).filter(Boolean), model])].join(', '))}>{model}<Plus size={11}/></button>)}</div></div>}
        <Field label="Optimization objective"><div className="objective-options">{[['balanced','Balanced'],['quality','Quality'],['speed','Speed'],['cost','Cost']].map(([value,label]) => <button type="button" key={value} className={objective === value ? 'selected' : ''} onClick={() => setObjective(value)}>{label}</button>)}</div></Field>
        <div className="route-call-estimate"><span>{models.length * (selectedWorkload?.cases?.length || 0)} model calls</span><small>{selectedWorkload?.cases?.length || 0} cases × {models.length} routes · real Bifrost usage</small></div>
        <Button block icon={Play} disabled={!gatewayConfigured || !models.length || !selectedWorkload || busy} onClick={launch}>{busy ? 'Starting evaluation…' : 'Run matched evaluation'}</Button>
        {!gatewayConfigured && <div className="gateway-inline-warning"><AlertCircle size={14}/> Configure Bifrost in Integrations & settings to run real model calls.</div>}
        {error && <div className="form-error">{error}</div>}
        <p className="route-cost-note">Each case is sent to every selected route. Provider usage and charges may apply. RIFT does not alter Bifrost routing or production policies.</p>
      </Panel>
      <div className="route-results-column">
        {detail ? <Panel className="route-result-panel">
          <div className="route-result-head"><div><div className="eyebrow">ROUTE EVALUATION / {short(detail.id)}</div><h2>{detail.title}</h2><p>{detail.status} · {relativeTime(detail.created_at)}</p></div><Badge tone={toneForStatus(detail.status)} dot>{detail.status}</Badge></div>
          {detail.summary?.models?.length ? <>
            <div className="route-recommendation"><div><span className="eyebrow">BEST MEASURED ROUTE</span><h3>{detail.summary.recommended_model}</h3><p>{detail.summary.recommendation_reason}</p></div><div className="route-readiness"><Badge tone={detail.summary.rollout_gate === 'ready_for_canary' ? 'green' : 'amber'}>{detail.summary.rollout_gate === 'ready_for_canary' ? 'Canary candidate' : 'More evidence needed'}</Badge><small>Suggested as a test candidate, not deployed automatically</small></div></div>
            <div className="table-scroll"><table className="route-ranking-table"><thead><tr><th>Rank</th><th>Model route</th><th>Score</th><th>Pass rate</th><th>Mean latency</th><th>Cost / pass</th></tr></thead><tbody>{detail.summary.models.map((item,index) => <tr key={item.model}><td>{index+1}</td><td><b>{item.model}</b>{index===0 && <Badge tone="green">Recommended</Badge>}</td><td><b>{item.score}</b></td><td>{percent(item.pass_rate)}</td><td>{item.avg_latency_ms == null ? '—' : `${Math.round(item.avg_latency_ms)} ms`}</td><td>{item.cost_per_pass_usd == null ? 'Not priced' : money(item.cost_per_pass_usd)}</td></tr>)}</tbody></table></div>
            <div className="route-score-note">{detail.summary.score_note}</div>
            <div className="route-trial-details"><PanelHeading title="Case-level results" detail="Expand a trial to inspect the exact model response and assertion coverage." />{(detail.trials || []).map((trial) => <details key={trial.id} className="route-trial-row"><summary><span><b>{trial.model}</b><small>{trial.case_title}</small></span><Badge tone={trial.status === 'completed' ? (trial.passed ? 'green' : 'amber') : 'red'}>{trial.status === 'completed' ? (trial.passed === null ? 'Measured' : trial.passed ? 'Passed' : `${Math.round(trial.quality_score || 0)}% match`) : 'Error'}</Badge><span className="route-trial-latency">{Math.round(trial.latency_ms || 0)} ms</span><ChevronDown size={14}/></summary><div className="route-trial-output">{trial.error ? <pre>{trial.error}</pre> : <pre>{trial.output}</pre>}</div></details>)}</div>
          </> : <div className="route-pending-state"><Activity size={20}/><b>{detail.status === 'failed' ? 'Evaluation failed' : 'Waiting for route trials'}</b><p>{detail.summary?.error || 'RIFT is sending the selected workload through Bifrost and recording each response.'}</p></div>}
        </Panel> : <Panel className="route-placeholder"><div className="route-placeholder-top"><span className="route-placeholder-mark"><Route size={22}/></span><Badge tone="muted">Matched test protocol</Badge></div><h2>Choose routes. Hold the workload constant.</h2><p>RIFT runs each test case against every candidate model route through Bifrost. The comparison makes latency, task assertions and configured token cost visible side by side.</p><div className="route-protocol"><div><b>01</b><span>Same input</span></div><div><b>02</b><span>Different routes</span></div><div><b>03</b><span>Measured outcomes</span></div></div><Button variant="secondary" onClick={() => onNavigate('traffic')}>Import a workload <ArrowRight size={13}/></Button></Panel>}
        <Panel className="route-history-panel"><PanelHeading title="Evaluation history" detail="Saved comparisons can be inspected again." action={<Button size="sm" variant="quiet" icon={RefreshCw} onClick={load}>Refresh</Button>} />{evaluations.length ? evaluations.slice(0,8).map((item) => <button key={item.id} className={`route-history-item ${activeId === item.id ? 'active' : ''}`} onClick={() => openEvaluation(item.id)}><span className="route-history-mark"><Route size={15}/></span><span><b>{item.title}</b><small>{item.models?.join(' · ')} · {relativeTime(item.created_at)}</small></span><Badge tone={toneForStatus(item.status)}>{item.status}</Badge><ChevronRight size={14}/></button>) : <p className="route-no-history">No evaluations saved yet.</p>}</Panel>
      </div>
    </div>
  </>
}

function TrafficReplayPage({ onNavigate, onSelectWorkload }) {
  const [workloads, setWorkloads] = useState([])
  const [title, setTitle] = useState('Imported production sample')
  const [source, setSource] = useState('bifrost-export')
  const [raw, setRaw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const load = useCallback(async () => { try { const result = await api('/gateway/workloads'); setWorkloads(result.workloads || []) } catch (e) { setError(e.message) } }, [])
  useEffect(() => { load() }, [load])
  const redact = (value) => String(value || '')
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_KEY]')
    .replace(/\btvly-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/(api[_-]?key|token|secret)(\s*[:=]\s*)["']?[^\s,"'}]+/gi, '$1$2[REDACTED]')
  const normalize = (item, index) => {
    const messages = Array.isArray(item.messages) ? item.messages : null
    const prompt = item.prompt || item.input || item.request?.prompt || (messages ? messages.map((message) => `${message.role || 'user'}: ${typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}`).join('\n\n') : '')
    if (!prompt || typeof prompt !== 'string') throw new Error(`Case ${index+1} has no prompt or messages.`)
    return { id: String(item.id || `import-${index+1}`).slice(0,80), title: String(item.title || item.name || `Imported case ${index+1}`).slice(0,120), prompt: redact(prompt).slice(0,12000), expected_terms: Array.isArray(item.expected_terms) ? item.expected_terms.slice(0,30).map((term) => redact(term).slice(0,100)) : [], max_tokens: Math.min(2000, Math.max(16, Number(item.max_tokens || 400))) }
  }
  const parseCases = () => {
    const trimmed = raw.trim()
    if (!trimmed) throw new Error('Paste JSON or JSONL traffic first.')
    let values
    try {
      if (trimmed.startsWith('[') || trimmed.startsWith('{') && trimmed.includes('"cases"')) {
        const parsed = JSON.parse(trimmed)
        values = Array.isArray(parsed) ? parsed : parsed.cases || parsed.records || [parsed]
      } else {
        values = trimmed.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
      }
    } catch (e) { throw new Error(`Could not parse workload: ${e.message}`) }
    if (!Array.isArray(values) || !values.length) throw new Error('The import must contain at least one request.')
    return values.slice(0,100).map(normalize)
  }
  const importFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setRaw(text); setTitle(file.name.replace(/\.(jsonl?|ndjson|txt)$/i, '') || 'Imported workload')
    setError(''); setNotice(`${file.name} loaded. Review the cases and save the workload.`)
  }
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const cases = parseCases()
      const result = await api('/gateway/workloads', { method: 'POST', body: JSON.stringify({ title, source, cases }) })
      setNotice(`Saved ${cases.length} cases. Ready for route replay.`); setRaw(''); await load()
      onSelectWorkload?.(result.workload.id)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  const remove = async (id) => {
    if (!window.confirm('Delete this workload? Saved evaluations retain their original trial records.')) return
    try { await api(`/gateway/workloads/${id}`, { method: 'DELETE' }); await load() } catch (e) { setError(e.message) }
  }
  return <>
    <PageHeading page="traffic" action={<Button variant="secondary" icon={RefreshCw} onClick={load}>Refresh workloads</Button>} />
    <div className="traffic-replay-layout">
      <Panel className="traffic-import-panel">
        <PanelHeading title="Import a workload" detail="Use anonymised OpenAI-compatible request JSON or JSONL. Secrets are redacted in prompt text before storage." />
        <form onSubmit={save}>
          <div className="traffic-file-drop"><FileUp size={20}/><div><b>Load a JSON / JSONL export</b><small>One request per line, or a JSON array. Max 100 cases per workload.</small></div><label className="button button-secondary button-sm">Choose file<input type="file" accept=".json,.jsonl,.ndjson,.txt,application/json" onChange={importFile} hidden /></label></div>
          <Field label="Workload name"><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100}/></Field>
          <Field label="Source label"><input value={source} onChange={(e) => setSource(e.target.value)} maxLength={40} placeholder="bifrost-export" /></Field>
          <Field label="Request dataset" hint="JSON/JSONL fields: title, prompt or messages, expected_terms (optional), max_tokens (optional)."><textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={13} placeholder={'{\n  "title": "Support response",\n  "messages": [{"role": "user", "content": "Draft a concise response to..."}],\n  "expected_terms": ["refund", "timeline"]\n}\n{\n  "title": "JSON extraction",\n  "prompt": "Extract...",\n  "expected_terms": ["id", "status"]\n}'} /></Field>
          <div className="traffic-import-actions"><span>Prompts are stored in RIFT to keep future replays consistent.</span><Button type="submit" icon={Upload} disabled={busy || !raw.trim()}>{busy ? 'Saving…' : 'Save workload'}</Button></div>
        </form>
        {notice && <div className="inline-success"><Check size={14}/>{notice}</div>}{error && <div className="form-error">{error}</div>}
      </Panel>
      <Panel className="traffic-library-panel">
        <PanelHeading title="Workload library" detail={`${workloads.length} reusable datasets`} />
        <div className="traffic-workload-list">{workloads.map((item) => <div className="traffic-workload-item" key={item.id}><span className="traffic-workload-icon"><Layers size={17}/></span><div><b>{item.title}</b><small>{item.cases?.length || 0} cases · {item.source} · {relativeTime(item.created_at)}</small><p>{(item.cases || []).slice(0,2).map((test) => test.title).join(' / ')}</p></div><div className="traffic-workload-actions"><Button size="sm" onClick={() => { onSelectWorkload?.(item.id); onNavigate('route-lab') }}>Evaluate <ArrowRight size={12}/></Button>{item.id !== 'workload-rift-core' && <button className="icon-button small" aria-label="Delete workload" onClick={() => remove(item.id)}><Trash2 size={13}/></button>}</div></div>)}{!workloads.length && <EmptyState icon={Database} title="No workloads" detail="Import a request dataset or reload the built-in gateway core suite." />}</div>
      </Panel>
    </div>
    <div className="traffic-privacy-note"><ShieldCheck size={15}/><p><b>Data handling:</b> imported prompts remain in your RIFT database and are sent to each selected Bifrost route when replayed. Remove customer identifiers and confidential content before importing. RIFT redacts common API-key patterns, but this is not a complete DLP system.</p></div>
  </>
}

function AboutPage() {
  return <>
    <PageHeading page="about" />
    <div className="about-layout"><Panel className="about-main"><div className="eyebrow">RIFT / ENGINEERING NOTES</div><h2>Task-level benchmarks for complete agent configurations.</h2><p>RIFT compares complete agents at task level across identical workloads and repeated trials. It combines task outcomes with observed steps, tool calls, model usage, cost and latency, then tests how those agents behave when dependencies fail. Bifrost is an optional telemetry source, not the product centre.</p><div className="about-pill-row"><Badge tone="muted">Bifrost</Badge><Badge tone="muted">FastAPI</Badge><Badge tone="muted">React</Badge><Badge tone="muted">SQLite / Neon</Badge><Badge tone="muted">OpenAI-compatible API</Badge></div></Panel><div className="about-capabilities">{[[FlaskConical,'Task-level evaluation','Matched tasks, repeated trials and agent configuration comparisons.'],[Scale,'Counterfactual analysis','Trace-derived hypotheses with controlled one-variable reruns.'],[History,'Regression memory','Saved failure cases with preserved seed and evidence snapshots.'],[Fingerprint,'Optional integrations','Gateway correlation and MCP monitoring remain supporting tools, not the core product.']].map(([Icon,title,detail]) => <Panel className="about-capability" key={title}><Icon size={18}/><div><b>{title}</b><p>{detail}</p></div></Panel>)}</div></div>
  </>
}

function App() {
  const [page, setPage] = useState('benchmark')
  const [selectedGatewayWorkloadId, setSelectedGatewayWorkloadId] = useState('')
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
  const [plannedRuns, setPlannedRuns] = useState(0)
  const [finishedReport, setFinishedReport] = useState(null)
  useEffect(() => {
    const id = activeExperiment?.id
    const st = activeExperiment?.status
    if (!id || !st || ['running', 'queued'].includes(st)) { setFinishedReport(null); return }
    let live = true
    api(`/experiments/${id}/report`).then((d) => { if (live) setFinishedReport(d) }).catch(() => {})
    return () => { live = false }
  }, [activeExperiment?.id, activeExperiment?.status])
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

  // RIFT currently runs as a single shared demo workspace. Authentication is
  // intentionally disabled in this build; keep all hooks unconditional so a
  // configuration change can never change the hook order between renders.
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const onHash = () => setPage((location.hash.replace('#', '') === 'overview' || !location.hash) ? 'benchmark' : location.hash.replace('#', ''))
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
      socket = new WebSocket(`${WS_BASE}/ws/${activeExperimentId}`)
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
      setPlannedRuns(result.run_count || 0)
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
  const analyzeRun = async (id) => {
    try {
      const result = await api(`/runs/${id}/counterfactual-analysis`, { method: 'POST', body: '{}' })
      notify(`Failure analysis started · ${result.variants.length} controlled reruns`)
      navigate('counterfactuals')
    } catch (e) { notify(e.message, 'error') }
  }
  const saveRegression = async (id) => {
    try {
      const result = await api(`/regression-cases/from-run/${id}`, { method: 'POST', body: JSON.stringify({ description: 'Saved from Run inspector for future regression replay.' }) })
      notify(`Saved regression case · ${short(result.case_id)}`)
      navigate('regression')
    } catch (e) { notify(e.message, 'error') }
  }
  const reviewRun = async (id, verdict) => {
    try {
      await api(`/runs/${id}/review`, { method: 'POST', body: JSON.stringify({ verdict, notes: verdict === 'accepted' ? 'Reviewed and accepted in the RIFT run inspector.' : verdict === 'rejected' ? 'Rejected during human evaluation review.' : 'Requires additional human verification.' }) })
      await selectRun(id)
      notify(`Human review saved · ${verdict.replace('_', ' ')}`)
    } catch (error) { notify(error.message, 'error') }
  }
  const exportExperiment = async (id) => {
    if (!id) return
    try {
      const response = await fetch(`${API}/experiments/${id}/export`)
      if (!response.ok) throw new Error('Export request failed')
      const blob = await response.blob(); const url = URL.createObjectURL(blob)
      const link = document.createElement('a'); link.href = url; link.download = `rift-${id}.csv`; link.click(); URL.revokeObjectURL(url)
    } catch (error) { notify(error.message, 'error') }
  }
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
      <button className="brand" onClick={() => navigate('benchmark')}><span className="brand-symbol"><i /><i /><i /></span><span><strong>RIFT</strong><small>AGENT BENCHMARKS</small></span></button>
      <div className="workspace-select"><span className="workspace-avatar">R</span><span><b>Benchmark workspace</b><small>Framework independent</small></span><ChevronDown size={14} /></div>
      {navGroups.map((group) => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(([id, label, Icon]) => <button key={id} className={`nav-link ${page === id ? 'active' : ''}`} onClick={() => navigate(id)}><span className="nav-icon-wrap"><Icon size={17} strokeWidth={1.9} /></span><span className="nav-item-label">{label}</span>{id === 'benchmark' && <em>NEW</em>}{id === 'chaos' && <i className="nav-dot" />}</button>)}</div>)}
      <div className="sidebar-spacer" />
      <div className="sidebar-connection"><span className={`connection-led ${integrations?.bifrost?.configured && integrations?.tavily?.configured ? 'online' : ''}`} /><div><b>{integrations?.bifrost?.configured ? 'Bifrost connected' : 'Fixture mode ready'}</b><small>{integrations?.database?.type === 'neon-postgres' ? 'Neon PostgreSQL' : integrations?.database?.type ? 'Local database' : 'Checking storage'}</small></div></div>
      <div className="sidebar-profile"><span className="profile-mark">R</span><span><b>Shared workspace</b><small>Single-workspace demo</small></span><button title="Integrations and settings" onClick={() => navigate('settings')}><Settings2 size={15} /></button></div>
      <button className={`sidebar-about-link ${page === 'about' ? 'active' : ''}`} onClick={() => navigate('about')}><CircleHelp size={15}/><span>About RIFT</span><ArrowUpRight size={13}/></button>
    </aside>
    {sidebarOpen && <button className="mobile-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={18} /></button><span>RIFT</span><ChevronRight size={13} /><b>{pageTitles[page]?.[0] || 'Benchmark Lab'}</b></div><div className="topbar-right"><Badge tone={integrations?.bifrost?.configured ? 'green' : 'muted'} dot>{integrations?.bifrost?.configured ? 'Bifrost ready' : 'Fixture mode'}</Badge><button className="icon-button" onClick={refresh} title="Refresh workspace"><RefreshCw size={16} /></button><span className="top-avatar">R</span></div></header>
      <RunDock busy={busy} experiment={activeExperiment} planned={plannedRuns} report={finishedReport} onNavigate={navigate} />
      <div className="page-root" key={page}>
        {page === 'bifrost' && <GatewayOverviewPage integrations={integrations} onNavigate={navigate} />}
        {page === 'route-lab' && <RouteLabPage initialWorkloadId={selectedGatewayWorkloadId} onWorkloadUsed={setSelectedGatewayWorkloadId} onNavigate={navigate} />}
        {page === 'traffic' && <TrafficReplayPage onNavigate={navigate} onSelectWorkload={setSelectedGatewayWorkloadId} />}
        {page === 'benchmark' && <BenchmarkPage agents={agents} tasks={tasks} onLaunch={launchExperiment} busy={busy} />}
        {page === 'agents' && <AgentsPage agents={agents} onCreate={createAgent} onTest={testAgent} onDelete={deleteAgent} busy={busy} />}
        {page === 'research' && <ResearchPage />}
        {page === 'mcp' && <MCPMonitorPage />}
        {page === 'counterfactuals' && <CounterfactualsPage />}
        {page === 'regression' && <RegressionPage agents={agents} />}
        {page === 'chaos' && <ChaosPage onLaunch={launchExperiment} busy={busy} />}
        {page === 'arena' && <ArenaPage experiment={activeExperiment} events={arenaEvents} runs={runs} activeFault={activeFault} onReplay={replay} onPause={() => setPaused((v) => !v)} paused={paused} onNavigate={navigate} replayMode={replayMode} replayCursor={replayCursor} replayTotal={replayEvents.length} onReplaySeek={setReplayCursor} />}
        {page === 'evaluation' && <EvaluationPage />}
        {page === 'runs' && <RunsPage runs={runs} selectedRun={selectedRun} onSelectRun={selectRun} onCancel={cancelRun} onExport={exportExperiment} onAnalyze={analyzeRun} onSaveRegression={saveRegression} onReview={reviewRun} />}
        {page === 'compare' && <ComparePage experiments={experiments} />}
        {page === 'leaderboard' && <LeaderboardPage entries={leaderboard} onRefresh={refresh} />}
        {page === 'settings' && <SettingsPage integrations={integrations} onTest={testIntegrations} checking={checking} health={health} />}
        {page === 'about' && <AboutPage />}
      </div>
    </main>
    {toast && <div className={`toast toast-${toast.kind}`}><span>{toast.kind === 'error' ? <AlertTriangle size={15} /> : <Check size={15} />}</span>{toast.message}<button onClick={() => setToast(null)}><X size={14} /></button></div>}
  </div>
}

export default App
