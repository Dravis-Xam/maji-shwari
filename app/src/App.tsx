import { useEffect, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowUpRight, Bell, CheckCircle2, ChevronDown,
  CircleDollarSign, FileCheck2, Filter, LayoutDashboard, Map, Menu,
  MessageSquareText, MoreHorizontal, Search, ShieldCheck, Sprout, X,
} from 'lucide-react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const demoProjects = [
  { id: 'BHR-042', name: 'Makueni Borehole 042', county: 'Makueni', status: 'Verified', confirmations: '18 / 12', progress: 92, amount: 'KES 4.8M', color: 'green' },
  { id: 'WTR-117', name: 'Tana River Water Pan', county: 'Tana River', status: 'In review', confirmations: '7 / 12', progress: 58, amount: 'KES 7.2M', color: 'amber' },
  { id: 'FRM-089', name: 'Kitui Agroforestry Hub', county: 'Kitui', status: 'Verified', confirmations: '24 / 12', progress: 76, amount: 'KES 3.1M', color: 'green' },
]
const demoReports = [
  { message: 'BHR-042 DONE', source: 'SMS · +254 712 ••• 381', time: '8 min ago', tone: 'positive', label: 'Confirmed' },
  { message: 'WTR-117 DELAYED', source: 'SMS · +254 728 ••• 104', time: '21 min ago', tone: 'warning', label: 'Audit flag' },
  { message: 'FRM-089 DONE', source: 'SMS · +254 701 ••• 927', time: '34 min ago', tone: 'positive', label: 'Confirmed' },
]
const demoMetrics = { capitalMonitored: 'KES 84.6M', activeProjects: 24, confirmations: 1284, reportsNeedingReview: 3 }
const demoWorkspace = {
  releases: [
    { projectId: 'BHR-042', projectName: 'Makueni Borehole 042', amount: 'KES 4.8M', status: 'Approved', milestone: 'milestone 1 of 3' },
    { projectId: 'WTR-117', projectName: 'Tana River Water Pan', amount: 'KES 7.2M', status: 'Pending approval', milestone: 'milestone 2 of 3' },
    { projectId: 'FRM-089', projectName: 'Kitui Agroforestry Hub', amount: 'KES 3.1M', status: 'Approved', milestone: 'milestone 3 of 3' },
  ],
  vulnerability: [['Turkana', '82', 'High risk', 'risk-high'], ['Tana River', '73', 'Watch', 'risk-mid'], ['Kitui', '64', 'Watch', 'risk-mid'], ['Makueni', '41', 'Stable', 'risk-low']],
  rules: [['Unique reporters', 'Count one confirmation per reporter, project, and status.'], ['Threshold', 'A project reaches verified after its configured confirmation count.'], ['Audit flags', 'DELAYED, INCOMPLETE, and PROBLEM reports create an audit flag.'], ['Evidence format', 'Messages must use PROJECT-CODE STATUS, such as BHR-042 DONE.']],
  activity: [['Dashboard data synchronized', 'MajiShwari system', '1 hour ago'], ['WTR-117 marked for audit review', 'Verification engine', '2 hours ago'], ['BHR-042 reached verification threshold', 'Verification engine', '3 hours ago'], ['Daily reconciliation scheduled for 02:00 UTC', 'System scheduler', '4 hours ago']],
}
const riskCoordinates: Record<string, [number, number]> = {
  Turkana: [3.1, 35.6],
  'Tana River': [-1.5, 39.8],
  Kitui: [-1.4, 38.0],
  Makueni: [-2.2, 37.9],
}
type Role = 'community' | 'government' | 'donor'
type User = { name: string; role: Role }

function MapFocus({ county }: { county: string }) {
  const map = useMap()
  useEffect(() => {
    const coordinates = riskCoordinates[county]
    if (coordinates) map.flyTo(coordinates, 8, { duration: 0.7 })
  }, [county, map])
  return null
}

function App() {
  const [activeNav, setActiveNav] = useState('Overview')
  const [showReport, setShowReport] = useState(false)
  const [actionKind, setActionKind] = useState<'project' | 'request' | 'rod' | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [loginName, setLoginName] = useState('')
  const [actionProject, setActionProject] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [actionAmount, setActionAmount] = useState('')
  const [actionName, setActionName] = useState('')
  const [actionCounty, setActionCounty] = useState('')
  const [actionPlan, setActionPlan] = useState('')
  const [actionArtifacts, setActionArtifacts] = useState('')
  const [actionContact, setActionContact] = useState('')
  const [notice, setNotice] = useState('')
  const [projects, setProjects] = useState(demoProjects)
  const [reports, setReports] = useState(demoReports)
  const [metrics, setMetrics] = useState(demoMetrics)
  const [dataSource, setDataSource] = useState<'demo' | 'neon'>('demo')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reportMessage, setReportMessage] = useState('')
  const [reportPhone, setReportPhone] = useState('')
  const [workspace, setWorkspace] = useState(demoWorkspace)
  const [selectedCounty, setSelectedCounty] = useState('Turkana')

  useEffect(() => {
    fetch('/api/auth/me').then((response) => response.ok ? response.json() : Promise.reject()).then((payload) => setUser(payload.user)).catch(() => setUser(null)).finally(() => setAuthChecked(true))
  }, [])

  useEffect(() => {
    if (!user) return
    fetch('/api/dashboard')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Dashboard unavailable')))
      .then((payload) => { setProjects(payload.projects); setReports(payload.reports); setMetrics(payload.metrics); setDataSource(payload.source) })
      .catch(() => setDataSource('demo'))
    fetch('/api/workspace')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Workspace unavailable')))
      .then((payload) => { setWorkspace(payload); setDataSource(payload.source) })
      .catch(() => setDataSource('demo'))
  }, [user])

  const handleLogin = async () => {
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: loginName }) })
      const payload = await response.json()
      if (!response.ok) return setNotice(payload.error ?? 'Login failed.')
      setUser(payload.user)
      setNotice(`Signed in as ${payload.user.role}.`)
    } catch {
      setUser({ name: loginName.trim(), role: 'community' })
      setDataSource('demo')
    }
  }

  const handleLogout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); setUser(null); setActiveNav('Overview') }

  const handleAction = async () => {
    const endpoint = actionKind === 'project' ? '/api/projects' : '/api/funding-requests'
    const body = actionKind === 'project' ? { id: actionProject, name: actionName, county: actionCounty, plan: actionPlan, artifacts: actionArtifacts, contact: actionContact } : { projectId: actionProject, message: actionMessage, amountCents: Math.round(Number(actionAmount) * 100), kind: actionKind === 'rod' ? 'rod' : 'request' }
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const payload = await response.json()
    if (!response.ok) return setNotice(payload.error ?? 'Action could not be completed.')
    setActionKind(null)
    setNotice(actionKind === 'project' ? 'Project created as Draft and queued for validation.' : actionKind === 'rod' ? 'Request to donate sent to the project owner.' : 'Funding request sent to donors.')
    window.setTimeout(() => setNotice(''), 4500)
  }

  if (!authChecked) return <div className="auth-screen"><div className="auth-card"><span className="brand-mark"><Sprout size={19} /></span><h1>Loading MajiShwari</h1><p>Checking your secure session...</p></div></div>
  if (!user) return <div className="auth-screen"><div className="auth-card"><span className="brand-mark"><Sprout size={19} /></span><p className="eyebrow">KENYA CLIMATE DESK</p><h1>Sign in to MajiShwari</h1><p>Use your approved Google account. Your role is assigned securely from your approved account.</p><button className="google-button" onClick={() => { window.location.href = '/api/auth/google/start' }}><span>G</span> Continue with Google</button>{import.meta.env.DEV && <details className="dev-login"><summary>Local community preview</summary><input className="auth-input" value={loginName} onChange={(event) => setLoginName(event.target.value)} placeholder="Your name" /><button className="secondary-button auth-button" disabled={loginName.trim().length < 2} onClick={handleLogin}>Preview as community</button></details>}</div></div>

  const handleReport = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/reports', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: reportMessage, phone: reportPhone }) })
      const payload = await response.json()
      if (!response.ok) {
        setNotice(payload.error ?? 'Report could not be submitted.')
        return
      }
      setShowReport(false)
      setReportMessage('')
      setReportPhone('')
      const refreshed = await fetch('/api/dashboard')
      if (refreshed.ok) {
        const dashboard = await refreshed.json()
        setProjects(dashboard.projects)
        setReports(dashboard.reports)
        setMetrics(dashboard.metrics)
      }
      const result = payload.state === 'verified' ? 'Project verified after reaching its confirmation threshold.' : payload.state === 'audit_flagged' ? 'Report recorded and an audit flag was created.' : payload.demo ? 'Report accepted in demo mode. Add DATABASE_URL to persist it in Neon.' : 'Report queued for verification. The community will receive an SMS confirmation.'
      setNotice(result)
      window.setTimeout(() => setNotice(''), 4500)
    } catch {
      setNotice('Backend unavailable. Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Sprout size={19} /></span><span>Maji<span>Shwari</span></span></div>
      <div className="workspace"><span className="workspace-dot" /> Kenya Climate Desk <ChevronDown size={14} /></div>
      <nav><p className="nav-label">Workspace</p>
        {[['Overview', LayoutDashboard], ['Projects', FileCheck2], ['Community reports', MessageSquareText], ['Fund releases', CircleDollarSign], ['Vulnerability map', Map]].map(([label, Icon]) => <button key={label as string} className={activeNav === label ? 'nav-item active' : 'nav-item'} onClick={() => setActiveNav(label as string)}><Icon size={17} /> {label as string}{label === 'Community reports' && <span className="nav-count">3</span>}</button>)}
        <p className="nav-label nav-spacer">System</p><button className={activeNav === 'Verification rules' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveNav('Verification rules')}><ShieldCheck size={17} /> Verification rules</button><button className={activeNav === 'Activity log' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveNav('Activity log')}><Activity size={17} /> Activity log</button>
      </nav>
        <div className="sidebar-footer"><div className="user-avatar">{user.name.slice(0, 2).toUpperCase()}</div><div><strong>{user.name}</strong><small>{user.role}</small></div><button className="logout-button" onClick={handleLogout} aria-label="Sign out"><MoreHorizontal size={17} /></button></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><button className="mobile-menu" aria-label="Open menu"><Menu size={20} /></button><div className="crumb"><span>Kenya Climate Desk</span><span>/</span><strong>{activeNav}</strong></div><div className="top-actions"><div className="search"><Search size={16} /><input placeholder="Search projects, reports..." /></div><button className="icon-button" aria-label="Notifications"><Bell size={18} /><i /></button><div className="avatar-small">BW</div></div></header>
      <div className="content-wrap">
        <section className="page-heading"><div><p className="eyebrow">THURSDAY, 10 SEPTEMBER 2026 <span className="live-dot" /> Live data <span className={`data-status ${dataSource}`}>{dataSource === 'neon' ? 'Neon connected' : 'Demo mode'}</span></p><h1>Good morning, {user.name.split(' ')[0]}</h1><p className="subheading">{user.role === 'donor' ? 'Review trusted projects and direct capital where it matters.' : 'Here’s the accountability pulse across your climate projects.'}</p></div><div className="heading-actions">{user.role !== 'donor' && <button className="secondary-button" onClick={() => setActionKind('project')}>Create project</button>}<button className="primary-button" onClick={() => setShowReport(true)}><MessageSquareText size={17} /> Log community report</button></div></section>
        {notice && <div className="toast"><CheckCircle2 size={18} /> {notice}<button onClick={() => setNotice('')}><X size={15} /></button></div>}
        {activeNav === 'Overview' ? <>
        <section className="stat-grid">
          <div className="stat-card accent-card"><div className="stat-top"><span>Capital monitored</span><span className="stat-icon green-icon"><CircleDollarSign size={17} /></span></div><strong>{metrics.capitalMonitored}</strong><div className="stat-meta up"><ArrowUpRight size={14} /> 12.8% <span>vs last month</span></div></div>
          <div className="stat-card"><div className="stat-top"><span>Active projects</span><span className="stat-icon blue-icon"><Sprout size={17} /></span></div><strong>{metrics.activeProjects}</strong><div className="stat-meta"><span className="muted">{projects.filter((project) => project.status === 'Verified').length} verified · {projects.filter((project) => project.status !== 'Verified').length} in review</span></div></div>
          <div className="stat-card"><div className="stat-top"><span>Community confirmations</span><span className="stat-icon yellow-icon"><MessageSquareText size={17} /></span></div><strong>{metrics.confirmations.toLocaleString()}</strong><div className="stat-meta up"><ArrowUpRight size={14} /> 8.4% <span>this month</span></div></div>
          <div className="stat-card"><div className="stat-top"><span>Reports needing review</span><span className="stat-icon red-icon"><AlertTriangle size={17} /></span></div><strong>{String(metrics.reportsNeedingReview).padStart(2, '0')}</strong><div className="stat-meta warning-text"><span>Requires attention</span><ArrowUpRight size={14} /></div></div>
        </section>
        <section className="main-grid"><div className="panel project-panel"><div className="panel-heading"><div><h2>Project verification</h2><p>Community signal across active projects</p></div><button className="select-button">All counties <ChevronDown size={15} /></button></div><div className="table-head"><span>Project</span><span>Confirmations</span><span>Progress</span><span>Status</span><span>Funding</span></div>{projects.map((project) => <div className="project-row" key={project.id}><div className="project-name"><span className={`project-badge ${project.color}`}><Sprout size={15} /></span><div><strong>{project.name}</strong><small>{project.id} · {project.county}</small></div></div><div className="confirmation"><strong>{project.confirmations.split(' / ')[0]}</strong><span> / {project.confirmations.split(' / ')[1]} needed</span></div><div className="progress-wrap"><div className="progress-bar"><span style={{ width: `${project.progress}%` }} /></div><small>{project.progress}%</small></div><span className={`status ${project.status === 'Verified' ? 'verified' : 'review'}`}><span />{project.status}</span><strong className="funding">{project.amount}</strong></div>)}<button className="view-all">View all projects <ArrowUpRight size={15} /></button></div>
          <div className="panel activity-panel"><div className="panel-heading"><div><h2>Latest reports</h2><p>Incoming from community SMS</p></div><button className="filter-button" aria-label="Filter reports"><Filter size={16} /></button></div><div className="report-list">{reports.map((report) => <div className="report-item" key={report.message}><span className={`report-icon ${report.tone}`}>{report.tone === 'positive' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}</span><div><strong>{report.message}</strong><small>{report.source}</small></div><div className="report-time"><span className={report.tone}>{report.label}</span><small>{report.time}</small></div></div>)}</div><button className="view-all">Open report inbox <ArrowUpRight size={15} /></button></div></section>
        <section className="lower-grid"><div className="panel chart-panel"><div className="panel-heading"><div><h2>Fund utilization</h2><p>Disbursements against verified milestones · 2026</p></div><button className="select-button">Last 6 months <ChevronDown size={15} /></button></div><div className="chart"><div className="y-axis"><span>20M</span><span>15M</span><span>10M</span><span>5M</span><span>0</span></div><div className="chart-area"><div className="grid-lines"><i /><i /><i /><i /><i /></div><div className="bars">{[['Apr', 38, 21], ['May', 52, 34], ['Jun', 47, 42], ['Jul', 71, 49], ['Aug', 63, 55], ['Sep', 82, 68]].map(([month, planned, actual]) => <div className="bar-group" key={month as string}><div className="bars-stack"><span className="bar planned" style={{ height: `${planned}%` }} /><span className="bar actual" style={{ height: `${actual}%` }} /></div><small>{month}</small></div>)}</div></div></div><div className="legend"><span><i className="legend-planned" /> Planned</span><span><i className="legend-actual" /> Disbursed</span><strong>KES 52.4M <small>disbursed to date</small></strong></div></div>
          <div className="panel map-panel"><div className="panel-heading"><div><h2>Vulnerability watch</h2><p>County risk index · live analysis</p></div><button className="filter-button" aria-label="Open map" onClick={() => setActiveNav('Vulnerability map')}><ArrowUpRight size={16} /></button></div><div className="map-visual"><div className="map-river" /><span className="map-label label-one">Turkana <b>82</b></span><span className="map-label label-two">Kitui <b>64</b></span><span className="map-label label-three">Makueni <b>41</b></span><span className="map-label label-four">Tana River <b>73</b></span><div className="map-pin pin-one" /><div className="map-pin pin-two" /><div className="map-pin pin-three" /></div><div className="risk-footer"><span><i className="risk-high" /> High risk</span><span><i className="risk-mid" /> Watch</span><span><i className="risk-low" /> Stable</span><button className="text-button" onClick={() => setActiveNav('Vulnerability map')}>Open map <ArrowUpRight size={14} /></button></div></div></section>
        </> : <section className="workspace-tab">{activeNav === 'Projects' && <><div className="tab-heading"><div><p className="eyebrow">PORTFOLIO</p><h2>All climate projects</h2><p>Track verification, delivery progress, and funding across counties.</p></div><button className="primary-button" onClick={() => setShowReport(true)}><MessageSquareText size={16} /> Add report</button></div><div className="panel full-table"><div className="table-head"><span>Project</span><span>Confirmations</span><span>Progress</span><span>Status</span><span>Funding</span></div>{projects.map((project) => <div className="project-row" key={project.id}><div className="project-name"><span className={`project-badge ${project.color}`}><Sprout size={15} /></span><div><strong>{project.name}</strong><small>{project.id} · {project.county}</small></div></div><div className="confirmation"><strong>{project.confirmations.split(' / ')[0]}</strong><span> / {project.confirmations.split(' / ')[1]} needed</span></div><div className="progress-wrap"><div className="progress-bar"><span style={{ width: `${project.progress}%` }} /></div><small>{project.progress}%</small></div><span className={`status ${project.status === 'Verified' ? 'verified' : 'review'}`}><span />{project.status}</span><strong className="funding">{project.amount}</strong></div>)}</div></>}
          {activeNav === 'Community reports' && <><div className="tab-heading"><div><p className="eyebrow">COMMUNITY SIGNAL</p><h2>Report inbox</h2><p>Review incoming SMS evidence and audit flags.</p></div><button className="primary-button" onClick={() => setShowReport(true)}><MessageSquareText size={16} /> Log report</button></div><div className="panel report-inbox"><div className="inbox-summary"><strong>{reports.length} recent reports</strong><span>{metrics.reportsNeedingReview} require review</span></div>{reports.map((report) => <div className="report-item report-item-large" key={`${report.message}-${report.time}`}><span className={`report-icon ${report.tone}`}>{report.tone === 'positive' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}</span><div><strong>{report.message}</strong><small>{report.source}</small></div><div className="report-time"><span className={report.tone}>{report.label}</span><small>{report.time}</small></div></div>)}</div></>}
          {activeNav === 'Fund releases' && <><div className="tab-heading"><div><p className="eyebrow">CAPITAL CONTROL</p><h2>Fund releases</h2><p>Milestone-linked disbursements and approval records.</p></div><div className="heading-actions">{user.role === 'donor' ? <button className="primary-button" onClick={() => setActionKind('rod')}>Send ROD</button> : <button className="primary-button" onClick={() => setActionKind('request')}>Request funding</button>}<span className={`data-status ${dataSource}`}>{dataSource === 'neon' ? 'Neon connected' : 'Demo mode'}</span></div></div><div className="panel release-grid">{workspace.releases.map((release) => <div className="release-card" key={release.projectId}><div className="release-card-top"><span className="project-badge green"><CircleDollarSign size={15} /></span><span className={`status ${release.status === 'Approved' ? 'verified' : 'review'}`}><span />{release.status}</span></div><strong>{release.projectName}</strong><small>{release.projectId} · {release.milestone}</small><div className="release-amount">{release.amount}<span>{release.status === 'Approved' ? 'Ready for release' : 'Awaiting verification'}</span></div></div>)}</div></>}
          {activeNav === 'Vulnerability map' && <><div className="tab-heading"><div><p className="eyebrow">RISK INTELLIGENCE</p><h2>Vulnerability map</h2><p>County-level climate exposure and project coverage.</p></div><span className={`data-status ${dataSource}`}>{dataSource === 'neon' ? 'Neon connected' : 'Demo mode'}</span></div><div className="map-tab-grid"><div className="panel map-panel-large"><MapContainer className="leaflet-map" center={[-0.7, 37.8]} zoom={6} scrollWheelZoom><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><MapFocus county={selectedCounty} />{workspace.vulnerability.map(([county, score, label, tone]) => { const coordinates = riskCoordinates[county]; const color = tone === 'risk-high' ? '#d46d52' : tone === 'risk-mid' ? '#dfa14d' : '#5a9a70'; return <CircleMarker key={county} center={coordinates} radius={Number(score) / 8 + 3} pathOptions={{ color, fillColor: color, fillOpacity: .75, weight: county === selectedCounty ? 4 : 2 }} eventHandlers={{ click: () => setSelectedCounty(county) }}><Popup><strong>{county}</strong><br />Risk score: {score}<br />{label}</Popup></CircleMarker> })}</MapContainer><div className="map-hint">Click a county to focus the map</div></div><div className="risk-list">{workspace.vulnerability.map(([county, score, label, tone]) => <button className={selectedCounty === county ? 'risk-row selected' : 'risk-row'} key={county} onClick={() => setSelectedCounty(county)}><div><strong>{county}</strong><small>Climate vulnerability index</small></div><b>{score}</b><span><i className={tone} />{label}</span></button>)}</div></div></>}
          {activeNav === 'Verification rules' && <><div className="tab-heading"><div><p className="eyebrow">CONTROL PLANE</p><h2>Verification rules</h2><p>Rules applied before a project can move to verified.</p></div><span className={`data-status ${dataSource}`}>{dataSource === 'neon' ? 'Neon connected' : 'Demo mode'}</span></div><div className="rule-list">{workspace.rules.map(([title, detail], index) => <div className="panel rule-card" key={title}><span className="rule-number">0{index + 1}</span><div><strong>{title}</strong><p>{detail}</p></div><CheckCircle2 size={18} /></div>)}</div></>}
          {activeNav === 'Activity log' && <><div className="tab-heading"><div><p className="eyebrow">AUDIT TRAIL</p><h2>Activity log</h2><p>Recent system events across the verification workflow.</p></div><span className={`data-status ${dataSource}`}>{dataSource === 'neon' ? 'Neon connected' : 'Demo mode'}</span></div><div className="panel event-list">{workspace.activity.map(([event, detail, age]) => <div className="event-row" key={event}><span className="event-dot" /><div><strong>{event}</strong><small>{age} · {detail}</small></div><ArrowUpRight size={15} /></div>)}</div></>}
        </section>}
      </div>
    </main>
    {showReport && <div className="modal-backdrop" onClick={() => setShowReport(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">COMMUNITY INTAKE</p><h2>Log a report</h2></div><button className="close-button" onClick={() => setShowReport(false)}><X size={18} /></button></div><p className="modal-help">Use a project code and status, for example <strong>BHR-042 DONE</strong> or <strong>WTR-117 DELAYED</strong>.</p><label>SMS message<input value={reportMessage} onChange={(event) => setReportMessage(event.target.value)} placeholder="BHR-042 DONE" /></label><label>Source phone number<input value={reportPhone} onChange={(event) => setReportPhone(event.target.value)} placeholder="+254 7•• ••• •••" /></label><div className="modal-actions"><button className="secondary-button" onClick={() => setShowReport(false)}>Cancel</button><button className="primary-button" disabled={isSubmitting || !reportMessage || !reportPhone} onClick={handleReport}>{isSubmitting ? 'Submitting...' : <><CheckCircle2 size={16} /> Queue report</>}</button></div></div></div>}
    {actionKind && <div className="modal-backdrop" onClick={() => setActionKind(null)}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">{actionKind === 'project' ? 'PROJECT INTAKE' : actionKind === 'rod' ? 'DONOR COMMITMENT' : 'FUNDING REQUEST'}</p><h2>{actionKind === 'project' ? 'Create a project' : actionKind === 'rod' ? 'Send request to donate' : 'Request donor funding'}</h2></div><button className="close-button" onClick={() => setActionKind(null)}><X size={18} /></button></div>{actionKind === 'project' ? <><label>Project code<input value={actionProject} onChange={(event) => setActionProject(event.target.value)} placeholder="BHR-123" /></label><label>Project name<input value={actionName} onChange={(event) => setActionName(event.target.value)} placeholder="Community solar borehole" /></label><label>County<input value={actionCounty} onChange={(event) => setActionCounty(event.target.value)} placeholder="Makueni" /></label><label>Project plan<textarea value={actionPlan} onChange={(event) => setActionPlan(event.target.value)} placeholder="Describe milestones, outcomes, and delivery plan." /></label><label>Artifacts and contact<input value={actionArtifacts} onChange={(event) => setActionArtifacts(event.target.value)} placeholder="Artifact links or references" /><input value={actionContact} onChange={(event) => setActionContact(event.target.value)} placeholder="Contact phone or email" /></label></> : <><label>Project code<input value={actionProject} onChange={(event) => setActionProject(event.target.value)} placeholder="BHR-042" /></label><label>Message<textarea value={actionMessage} onChange={(event) => setActionMessage(event.target.value)} placeholder={actionKind === 'rod' ? 'Describe your funding commitment.' : 'Describe the funding need and milestone.'} /></label><label>Amount in KES<input type="number" min="0" value={actionAmount} onChange={(event) => setActionAmount(event.target.value)} placeholder="250000" /></label></>}<div className="modal-actions"><button className="secondary-button" onClick={() => setActionKind(null)}>Cancel</button><button className="primary-button" onClick={handleAction}>Submit securely</button></div></div></div>}
  </div>
}
export default App
