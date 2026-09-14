import { useEffect, useMemo, useRef, useState } from 'react'
import Pusher from 'pusher-js'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock,
  FileCheck2,
  Filter,
  Gem,
  HandCoins,
  LayoutDashboard,
  Map,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Moon,
  Search,
  ShieldCheck,
  Sprout,
  Sun,
  X,
} from 'lucide-react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import './themes.css'

const demoProjects = [
  {
    id: 'BHR-042',
    name: 'Makueni Borehole 042',
    county: 'Makueni',
    status: 'Verified',
    confirmations: '18 / 12',
    progress: 92,
    amount: 'KES 4.8M',
    color: 'green',
    createdAt: '2026-04-02',
    estimatedCompletion: '2026-07-15',
    artifacts: ['site-survey.pdf', 'borehole-permit.pdf'],
    gallery: [] as string[],
  },
  {
    id: 'WTR-117',
    name: 'Tana River Water Pan',
    county: 'Tana River',
    status: 'In review',
    confirmations: '7 / 12',
    progress: 58,
    amount: 'KES 7.2M',
    color: 'amber',
    createdAt: '2026-05-18',
    estimatedCompletion: '2026-10-01',
    artifacts: ['pump-quote.pdf'],
    gallery: [] as string[],
  },
  {
    id: 'FRM-089',
    name: 'Kitui Agroforestry Hub',
    county: 'Kitui',
    status: 'Verified',
    confirmations: '24 / 12',
    progress: 76,
    amount: 'KES 3.1M',
    color: 'green',
    createdAt: '2026-03-11',
    estimatedCompletion: '2026-08-20',
    artifacts: [] as string[],
    gallery: [] as string[],
  },
]
const demoReports = [
  {
    message: 'BHR-042 DONE',
    source: 'SMS · +254 712 ••• 381',
    time: '8 min ago',
    tone: 'positive',
    label: 'Confirmed',
  },
  {
    message: 'WTR-117 DELAYED',
    source: 'SMS · +254 728 ••• 104',
    time: '21 min ago',
    tone: 'warning',
    label: 'Audit flag',
  },
  {
    message: 'FRM-089 DONE',
    source: 'SMS · +254 701 ••• 927',
    time: '34 min ago',
    tone: 'positive',
    label: 'Confirmed',
  },
]
const demoMetrics = {
  capitalMonitored: 'KES 84.6M',
  activeProjects: 24,
  confirmations: 1284,
  reportsNeedingReview: 3,
}
const demoWorkspace = {
  releases: [
    {
      projectId: 'BHR-042',
      projectName: 'Makueni Borehole 042',
      amount: 'KES 4.8M',
      status: 'Approved',
      milestone: 'milestone 1 of 3',
    },
    {
      projectId: 'WTR-117',
      projectName: 'Tana River Water Pan',
      amount: 'KES 7.2M',
      status: 'Pending approval',
      milestone: 'milestone 2 of 3',
    },
    {
      projectId: 'FRM-089',
      projectName: 'Kitui Agroforestry Hub',
      amount: 'KES 3.1M',
      status: 'Approved',
      milestone: 'milestone 3 of 3',
    },
  ],
  vulnerability: [
    ['Turkana', '82', 'High risk', 'risk-high'],
    ['Tana River', '73', 'Watch', 'risk-mid'],
    ['Kitui', '64', 'Watch', 'risk-mid'],
    ['Makueni', '41', 'Stable', 'risk-low'],
  ],
  rules: [
    ['Unique reporters', 'Count one confirmation per reporter, project, and status.'],
    ['Threshold', 'A project reaches verified after its configured confirmation count.'],
    ['Audit flags', 'DELAYED, INCOMPLETE, and PROBLEM reports create an audit flag.'],
    ['Evidence format', 'Messages must use PROJECT-CODE STATUS, such as BHR-042 DONE.'],
  ],
  activity: [
    ['Dashboard data synchronized', 'MajiShwari system', '1 hour ago'],
    ['WTR-117 marked for audit review', 'Verification engine', '2 hours ago'],
    ['BHR-042 reached verification threshold', 'Verification engine', '3 hours ago'],
    ['Daily reconciliation scheduled for 02:00 UTC', 'System scheduler', '4 hours ago'],
  ],
  fundingRequests: [
    {
      id: 'fr-demo-1',
      projectId: 'WTR-117',
      projectName: 'Tana River Water Pan',
      kind: 'request' as const,
      message: 'Milestone 2 needs additional pump equipment before the rains.',
      amountCents: 320_000_00,
      status: 'Open' as const,
    },
    {
      id: 'fr-demo-2',
      projectId: 'FRM-089',
      projectName: 'Kitui Agroforestry Hub',
      kind: 'request' as const,
      message: 'Seedling stock for the next planting window.',
      amountCents: 145_000_00,
      status: 'Open' as const,
    },
  ],
}
const riskCoordinates: Record<string, [number, number]> = {
  Turkana: [3.1, 35.6],
  'Tana River': [-1.5, 39.8],
  Kitui: [-1.4, 38.0],
  Makueni: [-2.2, 37.9],
}
type Role = 'community' | 'government' | 'donor'
type User = { sub?: string; name: string; email?: string; role: Role | 'pending' | 'verifying' }
type NotificationItem = {
  id: string
  title: string
  message: string
  read: boolean
  createdAt: string
}
type Theme = 'light' | 'dark' | 'light-sapphire' | 'dark-sapphire'

type FundingRequestSummary = {
  id: string
  projectId: string
  projectName: string
  kind: 'request' | 'rod'
  message: string
  amountCents: number
  status: 'Open' | 'Funded' | 'Pending approval'
}

type FollowUpDetail = { label: string; value: string }
type FollowUp = {
  title: string
  message: string
  details: FollowUpDetail[]
  onDone?: () => void
}

type TourStepConfig = { title: string; body: string; navTarget?: string; target?: string }

const tourStepsByRole: Record<Role, TourStepConfig[]> = {
  community: [
    {
      title: 'Create a project',
      body: 'Submit a plan, artifacts, and contact details for validation.',
      navTarget: 'Overview',
      target: 'create-project',
    },
    {
      title: 'Share progress',
      body: 'Send SMS-style reports so independent confirmations build trust.',
      navTarget: 'Overview',
      target: 'log-report',
    },
    {
      title: 'Request funding',
      body: 'Ask donors to fund a project with its plan and evidence.',
      navTarget: 'Fund releases',
      target: 'fund-action',
    },
  ],
  government: [
    {
      title: 'Oversee delivery',
      body: 'Review every project and lifecycle state across your county.',
      navTarget: 'Projects',
      target: 'nav-projects',
    },
    {
      title: 'Review alerts',
      body: 'Use Community reports to catch delays and fraud signals early.',
      navTarget: 'Community reports',
      target: 'nav-community-reports',
    },
    {
      title: 'Protect funding',
      body: 'Review milestone evidence before funding moves forward.',
      navTarget: 'Fund releases',
      target: 'nav-fund-releases',
    },
  ],
  donor: [
    {
      title: 'Discover projects',
      body: 'Browse verified community projects and their progress.',
      navTarget: 'Projects',
      target: 'nav-projects',
    },
    {
      title: 'Send a ROD',
      body: 'Send a request to donate to a project from Fund releases.',
      navTarget: 'Fund releases',
      target: 'fund-action',
    },
    {
      title: 'Track releases',
      body: 'Monitor utilization, reports, and audit activity.',
      navTarget: 'Activity log',
      target: 'nav-activity-log',
    },
  ],
}

type SearchResultItem = {
  id: string
  category: 'Project' | 'Report' | 'Fund release' | 'Vulnerability' | 'Rule' | 'Activity'
  title: string
  subtitle: string
  navTarget: string
  countyFocus?: string
}

const THEME_OPTIONS: Array<{ id: Theme; label: string; icon: typeof Sun }> = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'light-sapphire', label: 'Light sapphire', icon: Gem },
  { id: 'dark-sapphire', label: 'Dark sapphire', icon: Gem },
]

function buildSearchIndex(
  projects: typeof demoProjects,
  reports: typeof demoReports,
  workspace: typeof demoWorkspace,
): SearchResultItem[] {
  const items: SearchResultItem[] = []

  for (const project of projects) {
    items.push({
      id: `project-${project.id}`,
      category: 'Project',
      title: project.name,
      subtitle: `${project.id} · ${project.county} · ${project.status}`,
      navTarget: 'Projects',
    })
  }

  for (const report of reports) {
    items.push({
      id: `report-${report.message}-${report.time}`,
      category: 'Report',
      title: report.message,
      subtitle: `${report.source} · ${report.label}`,
      navTarget: 'Community reports',
    })
  }

  for (const release of workspace.releases) {
    items.push({
      id: `release-${release.projectId}`,
      category: 'Fund release',
      title: release.projectName,
      subtitle: `${release.projectId} · ${release.status} · ${release.amount}`,
      navTarget: 'Fund releases',
    })
  }

  for (const [county, score, label] of workspace.vulnerability) {
    items.push({
      id: `vulnerability-${county}`,
      category: 'Vulnerability',
      title: `${county} — ${label}`,
      subtitle: `Risk score ${score}`,
      navTarget: 'Vulnerability map',
      countyFocus: county,
    })
  }

  for (const [title, detail] of workspace.rules) {
    items.push({
      id: `rule-${title}`,
      category: 'Rule',
      title,
      subtitle: detail,
      navTarget: 'Verification rules',
    })
  }

  for (const [event, detail, age] of workspace.activity) {
    items.push({
      id: `activity-${event}`,
      category: 'Activity',
      title: event,
      subtitle: `${age} · ${detail}`,
      navTarget: 'Activity log',
    })
  }

  return items
}

function greetingForHour(hour: number) {
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function generateProjectCode(name: string, existingIds: string[]) {
  const letters =
    name
      .replace(/[^a-zA-Z\s]/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 3)
      .padEnd(3, 'X') || 'PRJ'

  let code = ''
  do {
    const number = String(Math.floor(Math.random() * 900) + 100)
    code = `${letters}-${number}`
  } while (existingIds.includes(code))
  return code
}

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
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('majishwari-theme')
      if (
        saved === 'light' ||
        saved === 'dark' ||
        saved === 'light-sapphire' ||
        saved === 'dark-sapphire'
      ) {
        return saved
      }
    } catch {
      // localStorage unavailable (private browsing, etc.) — fall back silently.
    }
    return 'light'
  })
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationDetail, setNotificationDetail] = useState<NotificationItem | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [actionKind, setActionKind] = useState<'project' | 'request' | 'rod' | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [availableRoles, setAvailableRoles] = useState<Role[]>([])
  const [selectedRole, setSelectedRole] = useState<Role | ''>('')
  const [showCreatePrompt, setShowCreatePrompt] = useState(false)
  const [tourStep, setTourStep] = useState<number | null>(null)
  const [loginName, setLoginName] = useState('')
  const [actionProject, setActionProject] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [actionAmount, setActionAmount] = useState('')
  const [actionName, setActionName] = useState('')
  const [actionCounty, setActionCounty] = useState('')
  const [actionPlan, setActionPlan] = useState('')
  const [actionArtifactFiles, setActionArtifactFiles] = useState<File[]>([])
  const [actionContact, setActionContact] = useState('')
  const [actionSubmitting, setActionSubmitting] = useState(false)
  const [loginSubmitting, setLoginSubmitting] = useState(false)
  const [roleSubmitting, setRoleSubmitting] = useState(false)
  const [resendBusy, setResendBusy] = useState(false)
  const [followUp, setFollowUp] = useState<FollowUp | null>(null)
  const [fundingRequestDetail, setFundingRequestDetail] = useState<FundingRequestSummary | null>(
    null,
  )
  const [notice, setNotice] = useState('')
  const [projects, setProjects] = useState(demoProjects)
  const [reports, setReports] = useState(demoReports)
  const [detailPanel, setDetailPanel] = useState<{
    projectId: string
    mode: 'manage' | 'join'
  } | null>(null)
  const [joinListOpen, setJoinListOpen] = useState(false)
  const [detailDraft, setDetailDraft] = useState<{
    name: string
    createdAt: string
    estimatedCompletion: string
    artifacts: string[]
    gallery: string[]
  } | null>(null)
  const [detailSaving, setDetailSaving] = useState(false)
  const [activityDetail, setActivityDetail] = useState<{
    event: string
    detail: string
    age: string
  } | null>(null)
  const [metrics, setMetrics] = useState(demoMetrics)
  const [dataSource, setDataSource] = useState<'demo' | 'neon'>('demo')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reportMessage, setReportMessage] = useState('')
  const [reportPhone, setReportPhone] = useState('')
  const [workspace, setWorkspace] = useState(demoWorkspace)
  const [selectedCounty, setSelectedCounty] = useState('Turkana')
  const [verificationCode, setVerificationCode] = useState('')
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [tourRect, setTourRect] = useState<{
    top: number
    left: number
    width: number
    height: number
  } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchRefreshing, setSearchRefreshing] = useState(false)
  const [searchHighlightRect, setSearchHighlightRect] = useState<{
    top: number
    left: number
    width: number
    height: number
  } | null>(null)
  const lastSearchFetchRef = useRef(0)
  const searchAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('majishwari-theme', theme)
    } catch {
      // localStorage unavailable — theme still applies for this session.
    }
  }, [theme])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload) => {
        setUser(payload.user)
        setAvailableRoles(payload.availableRoles ?? [])
      })
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true))
  }, [])

  useEffect(() => {
    if (!user || user.role === 'pending' || user.role === 'verifying') return
    fetch('/api/dashboard')
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error('Dashboard unavailable')),
      )
      .then((payload) => {
        setProjects(payload.projects)
        setReports(payload.reports)
        setMetrics(payload.metrics)
        setDataSource(payload.source)
      })
      .catch(() => setDataSource('demo'))
    fetch('/api/workspace')
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error('Workspace unavailable')),
      )
      .then((payload) => {
        setWorkspace(payload)
        setDataSource(payload.source)
      })
      .catch(() => setDataSource('demo'))
  }, [user])

  useEffect(() => {
    if (!user || !user.sub || user.role === 'pending' || user.role === 'verifying') return

    fetch('/api/notifications')
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload) => setNotifications(payload.notifications ?? []))
      .catch(() => {})

    const pusherKey = import.meta.env.VITE_PUSHER_KEY as string | undefined
    const pusherCluster = import.meta.env.VITE_PUSHER_CLUSTER as string | undefined
    if (!pusherKey || !pusherCluster) return

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
      authEndpoint: '/api/pusher/auth',
    })
    const channelName = `private-user-${user.sub.replace(/[^a-zA-Z0-9_=@,.;-]/g, '_')}`
    const channel = pusher.subscribe(channelName)
    channel.bind('notification', (notification: NotificationItem) => {
      setNotifications((current) => [notification, ...current])
    })

    return () => {
      pusher.unsubscribe(channelName)
      pusher.disconnect()
    }
  }, [user])

  // Debounce: wait for the user to pause typing before doing any matching or fetching.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(searchQuery.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  // Throttle: once the user is actively searching, refresh from the live API at most
  // once every few seconds, cancelling any refresh still in flight when a newer one
  // starts. Local (cached) results from state below already update instantly.
  useEffect(() => {
    if (!debouncedQuery || !user || user.role === 'pending' || user.role === 'verifying') return

    const minIntervalMs = 4000
    const elapsed = Date.now() - lastSearchFetchRef.current
    const delay = Math.max(0, minIntervalMs - elapsed)

    const timer = window.setTimeout(() => {
      lastSearchFetchRef.current = Date.now()
      searchAbortRef.current?.abort()
      const controller = new AbortController()
      searchAbortRef.current = controller
      setSearchRefreshing(true)

      Promise.all([
        fetch('/api/dashboard', { signal: controller.signal })
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null),
        fetch('/api/workspace', { signal: controller.signal })
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null),
      ])
        .then(([dashboard, workspacePayload]) => {
          if (dashboard) {
            setProjects(dashboard.projects)
            setReports(dashboard.reports)
            setMetrics(dashboard.metrics)
          }
          if (workspacePayload) setWorkspace(workspacePayload)
        })
        .finally(() => setSearchRefreshing(false))
    }, delay)

    return () => window.clearTimeout(timer)
  }, [debouncedQuery, user])

  useEffect(() => {
    return () => searchAbortRef.current?.abort()
  }, [])

  const searchResults = useMemo(() => {
    if (!debouncedQuery) return []
    const needle = debouncedQuery.toLowerCase()
    return buildSearchIndex(projects, reports, workspace)
      .filter((item) =>
        `${item.title} ${item.subtitle} ${item.category}`.toLowerCase().includes(needle),
      )
      .slice(0, 8)
  }, [debouncedQuery, projects, reports, workspace])

  useEffect(() => {
    if (actionKind !== 'project') return
    setActionProject(
      generateProjectCode(
        actionName,
        projects.map((project) => project.id),
      ),
    )
    // Regenerate only when the name changes meaningfully; project list changes
    // (e.g. from a background refresh) shouldn't keep rewriting the code.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionKind, actionName])

  useEffect(() => {
    if (!detailPanel || detailPanel.mode !== 'manage') {
      setDetailDraft(null)
      return
    }
    const project = projects.find((candidate) => candidate.id === detailPanel.projectId)
    if (!project) {
      setDetailDraft(null)
      return
    }
    setDetailDraft({
      name: project.name,
      createdAt: project.createdAt ?? '',
      estimatedCompletion: project.estimatedCompletion ?? '',
      artifacts: project.artifacts ?? [],
      gallery: project.gallery ?? [],
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailPanel])

  const closeDetailPanel = () => {
    setDetailPanel(null)
    setJoinListOpen(false)
  }

  const handleSaveDetail = async () => {
    if (!detailPanel || !detailDraft || detailSaving) return
    setDetailSaving(true)
    try {
      const response = await fetch(`/api/projects/${detailPanel.projectId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(detailDraft),
      })
      if (response.ok) {
        const payload = await response.json()
        setProjects((current) =>
          current.map((project) =>
            project.id === detailPanel.projectId ? { ...project, ...payload.project } : project,
          ),
        )
        setNotice('Project details saved.')
      } else {
        // No PATCH /api/projects/:id endpoint yet — update locally so editing
        // still works end-to-end, and say so plainly rather than pretending.
        setProjects((current) =>
          current.map((project) =>
            project.id === detailPanel.projectId ? { ...project, ...detailDraft } : project,
          ),
        )
        setNotice('Saved locally — add PATCH /api/projects/:id on the backend to persist this.')
      }
      window.setTimeout(() => setNotice(''), 5000)
    } finally {
      setDetailSaving(false)
    }
  }

  const resetActionForm = () => {
    setActionKind(null)
    setActionProject('')
    setActionName('')
    setActionCounty('')
    setActionPlan('')
    setActionArtifactFiles([])
    setActionContact('')
    setActionMessage('')
    setActionAmount('')
  }

  const handleSelectSearchResult = (result: SearchResultItem) => {
    setActiveNav(result.navTarget)
    if (result.countyFocus) setSelectedCounty(result.countyFocus)
    setSearchQuery('')
    setSearchOpen(false)

    window.setTimeout(() => {
      const element = document.querySelector(`[data-search-id="${result.id}"]`)
      if (!element) return
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const bounds = element.getBoundingClientRect()
      setSearchHighlightRect({
        top: bounds.top,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height,
      })
      window.setTimeout(() => setSearchHighlightRect(null), 2200)
    }, 80)
  }

  useEffect(() => {
    if (tourStep === null || !user || user.role === 'pending' || user.role === 'verifying') {
      setTourRect(null)
      return
    }
    const step = tourStepsByRole[user.role][tourStep]
    if (!step) {
      setTourRect(null)
      return
    }
    if (step.navTarget && step.navTarget !== activeNav) setActiveNav(step.navTarget)

    const measure = () => {
      const element = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null
      if (!element) {
        setTourRect(null)
        return
      }
      const bounds = element.getBoundingClientRect()
      setTourRect({
        top: bounds.top,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height,
      })
    }

    const timer = window.setTimeout(() => {
      document
        .querySelector(`[data-tour="${step.target}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      measure()
    }, 60)
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [tourStep, activeNav, user])

  const finishRoleOnboarding = async () => {
    if (!selectedRole || roleSubmitting) return
    setRoleSubmitting(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'role', role: selectedRole }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setNotice(payload.error ?? 'Could not send a verification code.')
        return
      }
      setUser((current) => (current ? { ...current, role: 'verifying' } : current))
      setNotice(
        payload.demoCode
          ? `Demo mode: your verification code is ${payload.demoCode}. Set RESEND_API_KEY and EMAIL_FROM to send real emails.`
          : `We sent a 6-digit code to ${payload.email}.`,
      )
    } finally {
      setRoleSubmitting(false)
    }
  }

  const handleVerifyCode = async () => {
    if (verifyBusy || verificationCode.length !== 6) return
    setVerifyBusy(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'verify', code: verificationCode }),
      })
      const payload = await response.json()
      if (!response.ok) return setNotice(payload.error ?? 'That code did not work.')
      setUser(payload.user)
      setVerificationCode('')
      setNotice('')
      setShowCreatePrompt(true)
    } finally {
      setVerifyBusy(false)
    }
  }

  const handleResendCode = async () => {
    if (resendBusy) return
    setResendBusy(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'resend' }),
      })
      const payload = await response.json()
      if (!response.ok) return setNotice(payload.error ?? 'Could not resend the code.')
      setNotice(
        payload.demoCode
          ? `Demo mode: your new code is ${payload.demoCode}.`
          : 'A new code is on its way.',
      )
    } finally {
      setResendBusy(false)
    }
  }

  const handleLogin = async () => {
    if (loginSubmitting || loginName.trim().length < 2) return
    setLoginSubmitting(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: loginName }),
      })
      const payload = await response.json()
      if (!response.ok) return setNotice(payload.error ?? 'Login failed.')
      setUser(payload.user)
      setShowCreatePrompt(true)
      setNotice(`Signed in as ${payload.user.role}.`)
    } catch {
      setUser({ name: loginName.trim(), role: 'community' })
      setDataSource('demo')
      setShowCreatePrompt(true)
    } finally {
      setLoginSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    setActiveNav('Overview')
  }

  const handleOpenNotification = (item: NotificationItem) => {
    setNotificationDetail(item)
    if (!item.read) {
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === item.id ? { ...notification, read: true } : notification,
        ),
      )
      fetch(`/api/notifications/${item.id}`, { method: 'PATCH' }).catch(() => {})
    }
  }

  const handleDismissNotification = (id: string) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id))
    fetch(`/api/notifications/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  const handleClearAllNotifications = () => {
    setNotifications([])
    setNotificationsOpen(false)
    fetch('/api/notifications', { method: 'DELETE' }).catch(() => {})
  }

  const activeDetailProject = detailPanel
    ? (projects.find((project) => project.id === detailPanel.projectId) ?? null)
    : null

  const isActionFormValid =
    actionKind === 'project'
      ? actionName.trim().length > 1 &&
        actionCounty.trim().length > 1 &&
        actionPlan.trim().length > 5 &&
        actionContact.trim().length > 3
      : actionKind !== null &&
        actionProject.trim().length > 1 &&
        actionMessage.trim().length > 5 &&
        Number(actionAmount) > 0

  const handleAction = async () => {
    if (actionSubmitting || !isActionFormValid) return
    setActionSubmitting(true)
    try {
      const endpoint = actionKind === 'project' ? '/api/projects' : '/api/funding-requests'
      const body =
        actionKind === 'project'
          ? {
              id: actionProject,
              name: actionName,
              county: actionCounty,
              plan: actionPlan,
              artifacts: actionArtifactFiles.map((file) => file.name).join(', '),
              contact: actionContact,
            }
          : {
              projectId: actionProject,
              message: actionMessage,
              amountCents: Math.round(Number(actionAmount) * 100),
              kind: actionKind === 'rod' ? 'rod' : 'request',
            }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json()
      if (!response.ok) {
        setNotice(payload.error ?? 'Action could not be completed.')
        return
      }
      const completedKind = actionKind
      const completedProject = actionProject
      const completedName = actionName
      const completedCounty = actionCounty
      const completedAmount = actionAmount
      const completedMessage = actionMessage
      resetActionForm()

      if (completedKind === 'project') {
        setFollowUp({
          title: 'Project created',
          message:
            'Your project was created as a Draft and is now queued for community and government validation.',
          details: [
            { label: 'Project code', value: completedProject },
            { label: 'Name', value: completedName },
            { label: 'County', value: completedCounty },
            { label: 'Status', value: 'Draft' },
            { label: 'Progress', value: '0% — awaiting first confirmations' },
          ],
          onDone: () => setTourStep(0),
        })
      } else {
        setFollowUp({
          title: completedKind === 'rod' ? 'Request to donate sent' : 'Funding request sent',
          message:
            completedKind === 'rod'
              ? 'Your commitment was sent to the project owner for confirmation.'
              : 'Your funding request was sent to donors for review.',
          details: [
            { label: 'Project code', value: completedProject },
            { label: 'Message', value: completedMessage },
            {
              label: 'Amount',
              value: completedAmount ? `KES ${Number(completedAmount).toLocaleString()}` : '—',
            },
            { label: 'Status', value: completedKind === 'rod' ? 'Pending confirmation' : 'Open' },
          ],
        })
      }
    } finally {
      setActionSubmitting(false)
    }
  }

  if (!authChecked)
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <span className="brand-mark">
            <Sprout size={19} />
          </span>
          <h1>Loading MajiShwari</h1>
          <p>Checking your secure session...</p>
        </div>
      </div>
    )
  if (!user)
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <span className="brand-mark">
            <Sprout size={19} />
          </span>
          <p className="eyebrow">KENYA CLIMATE DESK</p>
          <h1>Sign in to MajiShwari</h1>
          <p>Use your approved Google account. No separate MajiShwari password is stored.</p>
          <button
            className="google-button"
            onClick={() => {
              window.location.href = '/api/auth/google?start=1'
            }}
          >
            <span>G</span> Continue with Google
          </button>
          {import.meta.env.DEV && (
            <details className="dev-login">
              <summary>Local preview login</summary>
              <p>
                Local preview uses a fixed community role. Production roles come from Google
                allowlists.
              </p>
              <input
                className="auth-input"
                value={loginName}
                onChange={(event) => setLoginName(event.target.value)}
                placeholder="Your name"
              />
              <button
                className="secondary-button auth-button"
                disabled={loginSubmitting || loginName.trim().length < 2}
                onClick={handleLogin}
              >
                {loginSubmitting ? 'Signing in...' : 'Preview locally'}
              </button>
            </details>
          )}
        </div>
      </div>
    )
  if (user.role === 'pending')
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <span className="brand-mark">
            <Sprout size={19} />
          </span>
          <p className="eyebrow">WELCOME TO MAJISHWARI</p>
          <h1>Choose your workspace</h1>
          <p>Your Google account is verified. Choose an approved role to continue.</p>
          <div className="role-options">
            {availableRoles.map((role) => (
              <button
                className={selectedRole === role ? 'role-option selected' : 'role-option'}
                key={role}
                onClick={() => setSelectedRole(role)}
              >
                <strong>
                  {role === 'community'
                    ? 'Community member'
                    : role === 'government'
                      ? 'Government official'
                      : 'Donor'}
                </strong>
                <small>
                  {role === 'community'
                    ? 'Create and report on local projects.'
                    : role === 'government'
                      ? 'Oversee county delivery and funding.'
                      : 'Fund projects and send RODs.'}
                </small>
              </button>
            ))}
          </div>
          <button
            className="primary-button auth-button"
            disabled={!selectedRole || roleSubmitting}
            onClick={finishRoleOnboarding}
          >
            {roleSubmitting ? 'Sending code...' : 'Continue to dashboard'}
          </button>
        </div>
      </div>
    )
  if (user.role === 'verifying')
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <span className="brand-mark">
            <Sprout size={19} />
          </span>
          <p className="eyebrow">SECURITY CHECK</p>
          <h1>Verify your email</h1>
          <p>Enter the 6-digit code we sent to {user.email}.</p>
          {notice && <p className="auth-error">{notice}</p>}
          <input
            className="auth-input"
            value={verificationCode}
            onChange={(event) =>
              setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))
            }
            placeholder="123456"
            inputMode="numeric"
            maxLength={6}
          />
          <button
            className="primary-button auth-button"
            disabled={verifyBusy || verificationCode.length !== 6}
            onClick={handleVerifyCode}
          >
            {verifyBusy ? 'Verifying...' : 'Verify and continue'}
          </button>
          <button className="text-button" disabled={resendBusy} onClick={handleResendCode}>
            {resendBusy ? 'Sending...' : 'Resend code'}
          </button>
        </div>
      </div>
    )

  const handleReport = async () => {
    if (isSubmitting || !reportMessage.trim() || !reportPhone.trim()) return
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: reportMessage, phone: reportPhone }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setNotice(payload.error ?? 'Report could not be submitted.')
        return
      }
      setShowReport(false)
      const submittedMessage = reportMessage
      const submittedPhone = reportPhone
      setReportMessage('')
      setReportPhone('')

      const projectCode = submittedMessage.trim().split(/\s+/)[0]?.toUpperCase()
      let matchedProject: (typeof projects)[number] | undefined

      const refreshed = await fetch('/api/dashboard')
      if (refreshed.ok) {
        const dashboard = await refreshed.json()
        setProjects(dashboard.projects)
        setReports(dashboard.reports)
        setMetrics(dashboard.metrics)
        matchedProject = dashboard.projects.find(
          (project: { id: string }) => project.id === projectCode,
        )
      }

      const result =
        payload.state === 'verified'
          ? 'Project verified after reaching its confirmation threshold.'
          : payload.state === 'audit_flagged'
            ? 'Report recorded and an audit flag was created.'
            : payload.demo
              ? 'Report accepted in demo mode. Add DATABASE_URL to persist it in Neon.'
              : 'Report queued for verification. The community will receive an SMS confirmation.'

      setFollowUp({
        title:
          payload.state === 'verified'
            ? 'Project verified'
            : payload.state === 'audit_flagged'
              ? 'Audit flag created'
              : 'Report submitted',
        message: result,
        details: [
          { label: 'Message', value: submittedMessage },
          { label: 'Source phone', value: submittedPhone },
          ...(matchedProject
            ? [
                { label: 'Project', value: matchedProject.name },
                { label: 'Status', value: matchedProject.status },
                {
                  label: 'Confirmations',
                  value: matchedProject.confirmations,
                },
                { label: 'Progress', value: `${matchedProject.progress}%` },
              ]
            : []),
        ],
      })
    } catch {
      setNotice('Backend unavailable. Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Sprout size={19} />
          </span>
          <span>
            Maji<span>Shwari</span>
          </span>
        </div>
        <div className="workspace">
          <span className="workspace-dot" /> Kenya Climate Desk <ChevronDown size={14} />
        </div>
        <nav>
          <p className="nav-label">Workspace</p>
          {[
            ['Overview', LayoutDashboard],
            ['Projects', FileCheck2],
            ['Community reports', MessageSquareText],
            ['Fund releases', CircleDollarSign],
            ['Activities', Clock],
            ['Vulnerability map', Map],
          ].map(([label, Icon]) => (
            <button
              key={label as string}
              data-tour={`nav-${(label as string).toLowerCase().replace(/\s+/g, '-')}`}
              className={activeNav === label ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveNav(label as string)}
            >
              <Icon size={17} /> {label as string}
              {label === 'Community reports' && <span className="nav-count">3</span>}
            </button>
          ))}
          <p className="nav-label nav-spacer">System</p>
          <button
            data-tour="nav-verification-rules"
            className={activeNav === 'Verification rules' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveNav('Verification rules')}
          >
            <ShieldCheck size={17} /> Verification rules
          </button>
          <button
            data-tour="nav-activity-log"
            className={activeNav === 'Activity log' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveNav('Activity log')}
          >
            <Activity size={17} /> Activity log
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="user-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <strong>{user.name}</strong>
            <small>{user.role}</small>
          </div>
          <button className="logout-button" onClick={handleLogout} aria-label="Sign out">
            <MoreHorizontal size={17} />
          </button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="crumb">
            <span>Kenya Climate Desk</span>
            <span>/</span>
            <strong>{activeNav}</strong>
          </div>
          <div className="top-actions">
            <div className="search" style={{ position: 'relative' }}>
              <Search size={16} />
              <input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setSearchQuery('')
                    setSearchOpen(false)
                  }
                }}
                placeholder="Search projects, reports..."
              />
              {searchOpen && debouncedQuery && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    width: 340,
                    maxHeight: 360,
                    overflowY: 'auto',
                    background: '#fffaf3',
                    border: '1px solid rgba(15, 23, 20, 0.12)',
                    borderRadius: 12,
                    boxShadow: '0 12px 32px rgba(15, 23, 20, 0.18)',
                    zIndex: 80,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      fontSize: 12,
                      color: 'rgba(15, 23, 20, 0.55)',
                      borderBottom: '1px solid rgba(15, 23, 20, 0.08)',
                    }}
                  >
                    <span>
                      {searchResults.length} result{searchResults.length === 1 ? '' : 's'}
                    </span>
                    <span>{searchRefreshing ? 'Refreshing…' : 'Live'}</span>
                  </div>
                  {searchResults.length === 0 ? (
                    <div
                      style={{ padding: '18px 14px', fontSize: 13, color: 'rgba(15, 23, 20, 0.6)' }}
                    >
                      No matches for “{debouncedQuery}”.
                    </div>
                  ) : (
                    searchResults.map((result) => (
                      <button
                        key={result.id}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSelectSearchResult(result)}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 14px',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: '1px solid rgba(15, 23, 20, 0.06)',
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            textTransform: 'uppercase',
                            letterSpacing: 0.4,
                            color: '#5a9a70',
                          }}
                        >
                          {result.category}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{result.title}</div>
                        <div style={{ fontSize: 12, color: 'rgba(15, 23, 20, 0.6)' }}>
                          {result.subtitle}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <button
                className="icon-button"
                aria-label="Notifications"
                onClick={() => setNotificationsOpen((open) => !open)}
                onBlur={() => window.setTimeout(() => setNotificationsOpen(false), 150)}
              >
                <Bell size={18} />
                {notifications.some((notification) => !notification.read) && <i />}
              </button>
              {notificationsOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: 320,
                    maxHeight: 400,
                    overflowY: 'auto',
                    background: '#fffaf3',
                    border: '1px solid rgba(15, 23, 20, 0.12)',
                    borderRadius: 12,
                    boxShadow: '0 12px 32px rgba(15, 23, 20, 0.18)',
                    zIndex: 90,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderBottom: '1px solid rgba(15, 23, 20, 0.08)',
                    }}
                  >
                    <strong style={{ fontSize: 13 }}>Notifications</strong>
                    {notifications.length > 0 && (
                      <button
                        className="text-button"
                        style={{ padding: 0, fontSize: 12 }}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={handleClearAllNotifications}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div
                      style={{ padding: '18px 14px', fontSize: 13, color: 'rgba(15, 23, 20, 0.6)' }}
                    >
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="notification-row"
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          padding: '10px 14px',
                          borderBottom: '1px solid rgba(15, 23, 20, 0.06)',
                          background: notification.read
                            ? 'transparent'
                            : 'rgba(90, 154, 112, 0.06)',
                        }}
                      >
                        <button
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleOpenNotification(notification)}
                          style={{
                            flex: 1,
                            textAlign: 'left',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {!notification.read && (
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: '#5a9a70',
                                  flexShrink: 0,
                                }}
                              />
                            )}
                            <strong style={{ fontSize: 13 }}>{notification.title}</strong>
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: 'rgba(15, 23, 20, 0.6)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {notification.message}
                          </div>
                        </button>
                        <button
                          className="notification-dismiss"
                          aria-label="Dismiss notification"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleDismissNotification(notification.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 2,
                          }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <button
                className="icon-button"
                aria-label="Change theme"
                onClick={() => setThemeMenuOpen((open) => !open)}
                onBlur={() => window.setTimeout(() => setThemeMenuOpen(false), 120)}
              >
                {(() => {
                  const ActiveIcon =
                    THEME_OPTIONS.find((option) => option.id === theme)?.icon ?? Sun
                  return <ActiveIcon size={18} />
                })()}
              </button>
              {themeMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: 200,
                    background: '#fffaf3',
                    border: '1px solid rgba(15, 23, 20, 0.12)',
                    borderRadius: 12,
                    boxShadow: '0 12px 32px rgba(15, 23, 20, 0.18)',
                    zIndex: 90,
                    overflow: 'hidden',
                  }}
                >
                  {THEME_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setTheme(option.id)
                        setThemeMenuOpen(false)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        padding: '10px 14px',
                        background:
                          theme === option.id ? 'rgba(90, 154, 112, 0.12)' : 'transparent',
                        border: 'none',
                        borderBottom: '1px solid rgba(15, 23, 20, 0.06)',
                        cursor: 'pointer',
                        fontSize: 13,
                        textAlign: 'left',
                        color:
                          option.id === 'light-sapphire' || option.id === 'dark-sapphire'
                            ? '#2f5fd6'
                            : undefined,
                      }}
                    >
                      <option.icon size={16} />
                      {option.label}
                      {theme === option.id && (
                        <CheckCircle2 size={14} style={{ marginLeft: 'auto' }} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="content-wrap">
          <section className="page-heading">
            <div>
              <p className="eyebrow">
                THURSDAY, 10 SEPTEMBER 2026 <span className="live-dot" /> Live data{' '}
                <span className={`data-status ${dataSource}`}>
                  {dataSource === 'neon' ? 'Neon connected' : 'Demo mode'}
                </span>
              </p>
              <h1>
                {greetingForHour(new Date().getHours())}, {user.name.split(' ')[0]}
              </h1>
              <p className="subheading">
                {user.role === 'donor'
                  ? 'Review trusted projects and direct capital where it matters.'
                  : 'Here’s the accountability pulse across your climate projects.'}
              </p>
            </div>
            <div className="heading-actions">
              {user.role !== 'donor' && (
                <button
                  data-tour="create-project"
                  className="secondary-button"
                  onClick={() => setActionKind('project')}
                >
                  Create project
                </button>
              )}
              {user.role === 'donor' && (
                <button
                  data-tour="create-project"
                  className="secondary-button"
                  onClick={() => setJoinListOpen(true)}
                >
                  <HandCoins size={16} /> Join a project
                </button>
              )}
              <button
                data-tour="log-report"
                className="primary-button"
                onClick={() => setShowReport(true)}
              >
                <MessageSquareText size={17} /> Log community report
              </button>
            </div>
          </section>
          {notice && (
            <div className="toast">
              <CheckCircle2 size={18} /> {notice}
              <button onClick={() => setNotice('')}>
                <X size={15} />
              </button>
            </div>
          )}
          {activeNav === 'Overview' ? (
            <>
              <section className="stat-grid">
                <div className="stat-card accent-card">
                  <div className="stat-top">
                    <span>Capital monitored</span>
                    <span className="stat-icon green-icon">
                      <CircleDollarSign size={17} />
                    </span>
                  </div>
                  <strong>{metrics.capitalMonitored}</strong>
                  <div className="stat-meta up">
                    <ArrowUpRight size={14} /> 12.8% <span>vs last month</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <span>Active projects</span>
                    <span className="stat-icon blue-icon">
                      <Sprout size={17} />
                    </span>
                  </div>
                  <strong>{metrics.activeProjects}</strong>
                  <div className="stat-meta">
                    <span className="muted">
                      {projects.filter((project) => project.status === 'Verified').length} verified
                      · {projects.filter((project) => project.status !== 'Verified').length} in
                      review
                    </span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <span>Community confirmations</span>
                    <span className="stat-icon yellow-icon">
                      <MessageSquareText size={17} />
                    </span>
                  </div>
                  <strong>{metrics.confirmations.toLocaleString()}</strong>
                  <div className="stat-meta up">
                    <ArrowUpRight size={14} /> 8.4% <span>this month</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <span>Reports needing review</span>
                    <span className="stat-icon red-icon">
                      <AlertTriangle size={17} />
                    </span>
                  </div>
                  <strong>{String(metrics.reportsNeedingReview).padStart(2, '0')}</strong>
                  <div className="stat-meta warning-text">
                    <span>Requires attention</span>
                    <ArrowUpRight size={14} />
                  </div>
                </div>
              </section>
              <section className="main-grid">
                <div className="panel project-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Project verification</h2>
                      <p>Community signal across active projects</p>
                    </div>
                    <button className="select-button">
                      All counties <ChevronDown size={15} />
                    </button>
                  </div>
                  <div className="table-head">
                    <span>Project</span>
                    <span>Confirmations</span>
                    <span>Progress</span>
                    <span>Status</span>
                    <span>Funding</span>
                  </div>
                  {projects.map((project) => (
                    <div
                      className="project-row"
                      key={project.id}
                      style={user.role !== 'donor' ? { cursor: 'pointer' } : undefined}
                      onClick={() =>
                        user.role !== 'donor' &&
                        setDetailPanel({ projectId: project.id, mode: 'manage' })
                      }
                    >
                      <div className="project-name">
                        <span className={`project-badge ${project.color}`}>
                          <Sprout size={15} />
                        </span>
                        <div>
                          <strong>{project.name}</strong>
                          <small>
                            {project.id} · {project.county}
                          </small>
                        </div>
                      </div>
                      <div className="confirmation">
                        <strong>{project.confirmations.split(' / ')[0]}</strong>
                        <span> / {project.confirmations.split(' / ')[1]} needed</span>
                      </div>
                      <div className="progress-wrap">
                        <div className="progress-bar">
                          <span style={{ width: `${project.progress}%` }} />
                        </div>
                        <small>{project.progress}%</small>
                      </div>
                      <span
                        className={`status ${project.status === 'Verified' ? 'verified' : 'review'}`}
                      >
                        <span />
                        {project.status}
                      </span>
                      <strong className="funding">{project.amount}</strong>
                    </div>
                  ))}
                  <button className="view-all">
                    View all projects <ArrowUpRight size={15} />
                  </button>
                </div>
                <div className="panel activity-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Latest reports</h2>
                      <p>Incoming from community SMS</p>
                    </div>
                    <button className="filter-button" aria-label="Filter reports">
                      <Filter size={16} />
                    </button>
                  </div>
                  <div className="report-list">
                    {reports.map((report) => (
                      <div className="report-item" key={report.message}>
                        <span className={`report-icon ${report.tone}`}>
                          {report.tone === 'positive' ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <AlertTriangle size={16} />
                          )}
                        </span>
                        <div>
                          <strong>{report.message}</strong>
                          <small>{report.source}</small>
                        </div>
                        <div className="report-time">
                          <span className={report.tone}>{report.label}</span>
                          <small>{report.time}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="view-all">
                    Open report inbox <ArrowUpRight size={15} />
                  </button>
                </div>
              </section>
              <section className="lower-grid">
                <div className="panel chart-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Fund utilization</h2>
                      <p>Disbursements against verified milestones · 2026</p>
                    </div>
                    <button className="select-button">
                      Last 6 months <ChevronDown size={15} />
                    </button>
                  </div>
                  <div className="chart">
                    <div className="y-axis">
                      <span>20M</span>
                      <span>15M</span>
                      <span>10M</span>
                      <span>5M</span>
                      <span>0</span>
                    </div>
                    <div className="chart-area">
                      <div className="grid-lines">
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                      </div>
                      <div className="bars">
                        {[
                          ['Apr', 38, 21],
                          ['May', 52, 34],
                          ['Jun', 47, 42],
                          ['Jul', 71, 49],
                          ['Aug', 63, 55],
                          ['Sep', 82, 68],
                        ].map(([month, planned, actual]) => (
                          <div className="bar-group" key={month as string}>
                            <div className="bars-stack">
                              <span className="bar planned" style={{ height: `${planned}%` }} />
                              <span className="bar actual" style={{ height: `${actual}%` }} />
                            </div>
                            <small>{month}</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="legend">
                    <span>
                      <i className="legend-planned" /> Planned
                    </span>
                    <span>
                      <i className="legend-actual" /> Disbursed
                    </span>
                    <strong>
                      KES 52.4M <small>disbursed to date</small>
                    </strong>
                  </div>
                </div>
                <div className="panel map-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Vulnerability watch</h2>
                      <p>County risk index · live analysis</p>
                    </div>
                    <button
                      className="filter-button"
                      aria-label="Open map"
                      onClick={() => setActiveNav('Vulnerability map')}
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <div className="map-visual">
                    <div className="map-river" />
                    <span className="map-label label-one">
                      Turkana <b>82</b>
                    </span>
                    <span className="map-label label-two">
                      Kitui <b>64</b>
                    </span>
                    <span className="map-label label-three">
                      Makueni <b>41</b>
                    </span>
                    <span className="map-label label-four">
                      Tana River <b>73</b>
                    </span>
                    <div className="map-pin pin-one" />
                    <div className="map-pin pin-two" />
                    <div className="map-pin pin-three" />
                  </div>
                  <div className="risk-footer">
                    <span>
                      <i className="risk-high" /> High risk
                    </span>
                    <span>
                      <i className="risk-mid" /> Watch
                    </span>
                    <span>
                      <i className="risk-low" /> Stable
                    </span>
                    <button
                      className="text-button"
                      onClick={() => setActiveNav('Vulnerability map')}
                    >
                      Open map <ArrowUpRight size={14} />
                    </button>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <section className="workspace-tab">
              {activeNav === 'Projects' && (
                <>
                  <div className="tab-heading">
                    <div>
                      <p className="eyebrow">PORTFOLIO</p>
                      <h2>All climate projects</h2>
                      <p>Track verification, delivery progress, and funding across counties.</p>
                    </div>
                    <button className="primary-button" onClick={() => setShowReport(true)}>
                      <MessageSquareText size={16} /> Add report
                    </button>
                  </div>
                  <div className="panel full-table">
                    <div className="table-head">
                      <span>Project</span>
                      <span>Confirmations</span>
                      <span>Progress</span>
                      <span>Status</span>
                      <span>Funding</span>
                    </div>
                    {projects.map((project) => (
                      <div
                        className="project-row"
                        data-search-id={`project-${project.id}`}
                        key={project.id}
                        style={user.role !== 'donor' ? { cursor: 'pointer' } : undefined}
                        onClick={() =>
                          user.role !== 'donor' &&
                          setDetailPanel({ projectId: project.id, mode: 'manage' })
                        }
                      >
                        <div className="project-name">
                          <span className={`project-badge ${project.color}`}>
                            <Sprout size={15} />
                          </span>
                          <div>
                            <strong>{project.name}</strong>
                            <small>
                              {project.id} · {project.county}
                            </small>
                          </div>
                        </div>
                        <div className="confirmation">
                          <strong>{project.confirmations.split(' / ')[0]}</strong>
                          <span> / {project.confirmations.split(' / ')[1]} needed</span>
                        </div>
                        <div className="progress-wrap">
                          <div className="progress-bar">
                            <span style={{ width: `${project.progress}%` }} />
                          </div>
                          <small>{project.progress}%</small>
                        </div>
                        <span
                          className={`status ${project.status === 'Verified' ? 'verified' : 'review'}`}
                        >
                          <span />
                          {project.status}
                        </span>
                        <strong className="funding">{project.amount}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {activeNav === 'Community reports' && (
                <>
                  <div className="tab-heading">
                    <div>
                      <p className="eyebrow">COMMUNITY SIGNAL</p>
                      <h2>Report inbox</h2>
                      <p>Review incoming SMS evidence and audit flags.</p>
                    </div>
                    <button className="primary-button" onClick={() => setShowReport(true)}>
                      <MessageSquareText size={16} /> Log report
                    </button>
                  </div>
                  <div className="panel report-inbox">
                    <div className="inbox-summary">
                      <strong>{reports.length} recent reports</strong>
                      <span>{metrics.reportsNeedingReview} require review</span>
                    </div>
                    {reports.map((report) => (
                      <div
                        className="report-item report-item-large"
                        data-search-id={`report-${report.message}-${report.time}`}
                        key={`${report.message}-${report.time}`}
                      >
                        <span className={`report-icon ${report.tone}`}>
                          {report.tone === 'positive' ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <AlertTriangle size={16} />
                          )}
                        </span>
                        <div>
                          <strong>{report.message}</strong>
                          <small>{report.source}</small>
                        </div>
                        <div className="report-time">
                          <span className={report.tone}>{report.label}</span>
                          <small>{report.time}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {activeNav === 'Fund releases' && (
                <>
                  <div className="tab-heading">
                    <div>
                      <p className="eyebrow">CAPITAL CONTROL</p>
                      <h2>Fund releases</h2>
                      <p>Milestone-linked disbursements and approval records.</p>
                    </div>
                    <div className="heading-actions">
                      {user.role === 'donor' ? (
                        <button
                          data-tour="fund-action"
                          className="primary-button"
                          onClick={() => setActionKind('rod')}
                        >
                          Send ROD
                        </button>
                      ) : (
                        <button
                          data-tour="fund-action"
                          className="primary-button"
                          onClick={() => setActionKind('request')}
                        >
                          Request funding
                        </button>
                      )}
                      <span className={`data-status ${dataSource}`}>
                        {dataSource === 'neon' ? 'Neon connected' : 'Demo mode'}
                      </span>
                    </div>
                  </div>
                  <div className="panel release-grid">
                    {workspace.releases.map((release) => (
                      <div
                        className="release-card"
                        data-search-id={`release-${release.projectId}`}
                        key={release.projectId}
                      >
                        <div className="release-card-top">
                          <span className="project-badge green">
                            <CircleDollarSign size={15} />
                          </span>
                          <span
                            className={`status ${release.status === 'Approved' ? 'verified' : 'review'}`}
                          >
                            <span />
                            {release.status}
                          </span>
                        </div>
                        <strong>{release.projectName}</strong>
                        <small>
                          {release.projectId} · {release.milestone}
                        </small>
                        <div className="release-amount">
                          {release.amount}
                          <span>
                            {release.status === 'Approved'
                              ? 'Ready for release'
                              : 'Awaiting verification'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {user.role === 'donor' && (workspace.fundingRequests ?? []).length > 0 && (
                    <div className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Funding requests from project owners</h2>
                          <p>Open requests you can review and choose to fund.</p>
                        </div>
                      </div>
                      <div className="release-grid">
                        {(workspace.fundingRequests ?? [])
                          .filter((request) => request.status === 'Open')
                          .map((request) => (
                            <button
                              key={request.id}
                              className="release-card"
                              style={{ textAlign: 'left', cursor: 'pointer' }}
                              onClick={() => setFundingRequestDetail(request)}
                            >
                              <div className="release-card-top">
                                <span className="project-badge amber">
                                  <HandCoins size={15} />
                                </span>
                                <span className="status review">
                                  <span />
                                  {request.status}
                                </span>
                              </div>
                              <strong>{request.projectName}</strong>
                              <small>{request.projectId}</small>
                              <div className="release-amount">
                                {`KES ${(request.amountCents / 100).toLocaleString()}`}
                                <span>Tap to view details</span>
                              </div>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {activeNav === 'Activities' && (
                <>
                  <div className="tab-heading">
                    <div>
                      <p className="eyebrow">ONGOING WORK</p>
                      <h2>Activities</h2>
                      <p>
                        Everything still in motion — projects, funding, and reports needing
                        attention.
                      </p>
                    </div>
                  </div>
                  <div className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Projects in review</h2>
                        <p>Not yet verified.</p>
                      </div>
                    </div>
                    {projects.filter((project) => project.status !== 'Verified').length === 0 ? (
                      <p style={{ padding: 16 }}>Nothing pending — every project is verified.</p>
                    ) : (
                      projects
                        .filter((project) => project.status !== 'Verified')
                        .map((project) => (
                          <button
                            key={project.id}
                            className="project-row"
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                            onClick={() =>
                              setDetailPanel({ projectId: project.id, mode: 'manage' })
                            }
                          >
                            <div className="project-name">
                              <span className={`project-badge ${project.color}`}>
                                <Sprout size={15} />
                              </span>
                              <div>
                                <strong>{project.name}</strong>
                                <small>
                                  {project.id} · {project.county}
                                </small>
                              </div>
                            </div>
                            <div className="confirmation">
                              <strong>{project.confirmations.split(' / ')[0]}</strong>
                              <span> / {project.confirmations.split(' / ')[1]} needed</span>
                            </div>
                            <div className="progress-wrap">
                              <div className="progress-bar">
                                <span style={{ width: `${project.progress}%` }} />
                              </div>
                              <small>{project.progress}%</small>
                            </div>
                            <span className="status review">
                              <span />
                              {project.status}
                            </span>
                            <strong className="funding">{project.amount}</strong>
                          </button>
                        ))
                    )}
                  </div>
                  <div className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Fund releases pending approval</h2>
                      </div>
                    </div>
                    {workspace.releases.filter((release) => release.status === 'Pending approval')
                      .length === 0 ? (
                      <p style={{ padding: 16 }}>No releases waiting on approval.</p>
                    ) : (
                      <div className="release-grid">
                        {workspace.releases
                          .filter((release) => release.status === 'Pending approval')
                          .map((release) => (
                            <button
                              key={release.projectId}
                              className="release-card"
                              style={{ textAlign: 'left', cursor: 'pointer' }}
                              onClick={() => setActiveNav('Fund releases')}
                            >
                              <div className="release-card-top">
                                <span className="project-badge amber">
                                  <CircleDollarSign size={15} />
                                </span>
                                <span className="status review">
                                  <span />
                                  {release.status}
                                </span>
                              </div>
                              <strong>{release.projectName}</strong>
                              <small>
                                {release.projectId} · {release.milestone}
                              </small>
                              <div className="release-amount">
                                {release.amount}
                                <span>Awaiting verification</span>
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Reports needing review</h2>
                      </div>
                    </div>
                    {reports.filter((report) => report.label === 'Audit flag').length === 0 ? (
                      <p style={{ padding: 16 }}>No reports currently flagged.</p>
                    ) : (
                      reports
                        .filter((report) => report.label === 'Audit flag')
                        .map((report) => (
                          <button
                            key={`${report.message}-${report.time}`}
                            className="report-item"
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                            onClick={() => setActiveNav('Community reports')}
                          >
                            <span className={`report-icon ${report.tone}`}>
                              <AlertTriangle size={16} />
                            </span>
                            <div>
                              <strong>{report.message}</strong>
                              <small>{report.source}</small>
                            </div>
                            <div className="report-time">
                              <span className={report.tone}>{report.label}</span>
                              <small>{report.time}</small>
                            </div>
                          </button>
                        ))
                    )}
                  </div>
                  {(workspace.fundingRequests ?? []).filter((request) => request.status === 'Open')
                    .length > 0 && (
                    <div className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Open funding requests</h2>
                        </div>
                      </div>
                      <div className="release-grid">
                        {(workspace.fundingRequests ?? [])
                          .filter((request) => request.status === 'Open')
                          .map((request) => (
                            <button
                              key={request.id}
                              className="release-card"
                              style={{ textAlign: 'left', cursor: 'pointer' }}
                              onClick={() => {
                                setActiveNav('Fund releases')
                                setFundingRequestDetail(request)
                              }}
                            >
                              <div className="release-card-top">
                                <span className="project-badge amber">
                                  <HandCoins size={15} />
                                </span>
                                <span className="status review">
                                  <span />
                                  {request.status}
                                </span>
                              </div>
                              <strong>{request.projectName}</strong>
                              <small>{request.projectId}</small>
                              <div className="release-amount">
                                {`KES ${(request.amountCents / 100).toLocaleString()}`}
                                <span>Tap to view</span>
                              </div>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {activeNav === 'Vulnerability map' && (
                <>
                  <div className="tab-heading">
                    <div>
                      <p className="eyebrow">RISK INTELLIGENCE</p>
                      <h2>Vulnerability map</h2>
                      <p>County-level climate exposure and project coverage.</p>
                    </div>
                    <span className={`data-status ${dataSource}`}>
                      {dataSource === 'neon' ? 'Neon connected' : 'Demo mode'}
                    </span>
                  </div>
                  <div className="map-tab-grid">
                    <div className="panel map-panel-large">
                      <MapContainer
                        className="leaflet-map"
                        center={[-0.7, 37.8]}
                        zoom={6}
                        scrollWheelZoom
                      >
                        <TileLayer
                          attribution="&copy; OpenStreetMap contributors"
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapFocus county={selectedCounty} />
                        {workspace.vulnerability.map(([county, score, label, tone]) => {
                          const coordinates = riskCoordinates[county]
                          const color =
                            tone === 'risk-high'
                              ? '#d46d52'
                              : tone === 'risk-mid'
                                ? '#dfa14d'
                                : '#5a9a70'
                          return (
                            <CircleMarker
                              key={county}
                              center={coordinates}
                              radius={Number(score) / 8 + 3}
                              pathOptions={{
                                color,
                                fillColor: color,
                                fillOpacity: 0.75,
                                weight: county === selectedCounty ? 4 : 2,
                              }}
                              eventHandlers={{ click: () => setSelectedCounty(county) }}
                            >
                              <Popup>
                                <strong>{county}</strong>
                                <br />
                                Risk score: {score}
                                <br />
                                {label}
                              </Popup>
                            </CircleMarker>
                          )
                        })}
                      </MapContainer>
                      <div className="map-hint">Click a county to focus the map</div>
                    </div>
                    <div className="risk-list">
                      {workspace.vulnerability.map(([county, score, label, tone]) => (
                        <button
                          className={selectedCounty === county ? 'risk-row selected' : 'risk-row'}
                          data-search-id={`vulnerability-${county}`}
                          key={county}
                          onClick={() => setSelectedCounty(county)}
                        >
                          <div>
                            <strong>{county}</strong>
                            <small>Climate vulnerability index</small>
                          </div>
                          <b>{score}</b>
                          <span>
                            <i className={tone} />
                            {label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {activeNav === 'Verification rules' && (
                <>
                  <div className="tab-heading">
                    <div>
                      <p className="eyebrow">CONTROL PLANE</p>
                      <h2>Verification rules</h2>
                      <p>Rules applied before a project can move to verified.</p>
                    </div>
                    <span className={`data-status ${dataSource}`}>
                      {dataSource === 'neon' ? 'Neon connected' : 'Demo mode'}
                    </span>
                  </div>
                  <div className="rule-list">
                    {workspace.rules.map(([title, detail], index) => (
                      <div className="panel rule-card" data-search-id={`rule-${title}`} key={title}>
                        <span className="rule-number">0{index + 1}</span>
                        <div>
                          <strong>{title}</strong>
                          <p>{detail}</p>
                        </div>
                        <CheckCircle2 size={18} />
                      </div>
                    ))}
                  </div>
                </>
              )}
              {activeNav === 'Activity log' && (
                <>
                  <div className="tab-heading">
                    <div>
                      <p className="eyebrow">AUDIT TRAIL</p>
                      <h2>Activity log</h2>
                      <p>Recent system events across the verification workflow.</p>
                    </div>
                    <span className={`data-status ${dataSource}`}>
                      {dataSource === 'neon' ? 'Neon connected' : 'Demo mode'}
                    </span>
                  </div>
                  <div className="panel event-list">
                    {workspace.activity.map(([event, detail, age]) => (
                      <div className="event-row" data-search-id={`activity-${event}`} key={event}>
                        <span className="event-dot" />
                        <div>
                          <strong>{event}</strong>
                          <small>
                            {age} · {detail}
                          </small>
                        </div>
                        <button
                          className="close-button"
                          aria-label="View activity details"
                          onClick={() => setActivityDetail({ event, detail, age })}
                        >
                          <ArrowUpRight size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </main>
      {showCreatePrompt && (
        <div className="modal-backdrop">
          <div className="onboarding-card">
            <span className="brand-mark">
              <Sprout size={19} />
            </span>
            <p className="eyebrow">FIRST STEPS</p>
            <h2>Start with a project?</h2>
            <p>Would you like to create a project now, or explore your dashboard first?</p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  setShowCreatePrompt(false)
                  setTourStep(0)
                }}
              >
                Open dashboard
              </button>
              {user.role !== 'donor' && (
                <button
                  className="primary-button"
                  onClick={() => {
                    setShowCreatePrompt(false)
                    setActionKind('project')
                  }}
                >
                  Create project
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {tourStep !== null &&
        (user.role === 'community' || user.role === 'government' || user.role === 'donor') && (
          <div
            className="tour-backdrop"
            style={tourRect ? { background: 'transparent' } : undefined}
          >
            {tourRect && (
              <div
                aria-hidden
                style={{
                  position: 'fixed',
                  top: tourRect.top - 10,
                  left: tourRect.left - 10,
                  width: tourRect.width + 20,
                  height: tourRect.height + 20,
                  borderRadius: 14,
                  border: '2px solid #5a9a70',
                  boxShadow: '0 0 0 9999px rgba(15, 23, 20, 0.6)',
                  pointerEvents: 'none',
                  zIndex: 70,
                  transition:
                    'top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease',
                }}
              />
            )}
            <div className="tour-card" style={{ position: 'relative', zIndex: 71 }}>
              <span className="tour-step">{tourStep + 1} / 3</span>
              <p className="eyebrow">{user.role.toUpperCase()} TOUR</p>
              <h2>{tourStepsByRole[user.role][tourStep]?.title}</h2>
              <p>{tourStepsByRole[user.role][tourStep]?.body}</p>
              <div className="tour-actions">
                <button className="text-button" onClick={() => setTourStep(null)}>
                  Skip tour
                </button>
                <button
                  className="primary-button"
                  onClick={() => (tourStep === 2 ? setTourStep(null) : setTourStep(tourStep + 1))}
                >
                  {tourStep === 2 ? 'Finish' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        )}
      {showReport && (
        <div className="modal-backdrop" onClick={() => setShowReport(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">COMMUNITY INTAKE</p>
                <h2>Log a report</h2>
              </div>
              <button className="close-button" onClick={() => setShowReport(false)}>
                <X size={18} />
              </button>
            </div>
            <p className="modal-help">
              Use a project code and status, for example <strong>BHR-042 DONE</strong> or{' '}
              <strong>WTR-117 DELAYED</strong>.
            </p>
            <label>
              SMS message
              <input
                value={reportMessage}
                onChange={(event) => setReportMessage(event.target.value)}
                placeholder="BHR-042 DONE"
              />
            </label>
            <label>
              Source phone number
              <input
                value={reportPhone}
                onChange={(event) => setReportPhone(event.target.value)}
                placeholder="+254 7•• ••• •••"
              />
            </label>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setShowReport(false)}>
                Cancel
              </button>
              <button
                className="primary-button"
                disabled={isSubmitting || !reportMessage || !reportPhone}
                onClick={handleReport}
              >
                {isSubmitting ? (
                  'Submitting...'
                ) : (
                  <>
                    <CheckCircle2 size={16} /> Queue report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {actionKind && (
        <div className="modal-backdrop" onClick={resetActionForm}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">
                  {actionKind === 'project'
                    ? 'PROJECT INTAKE'
                    : actionKind === 'rod'
                      ? 'DONOR COMMITMENT'
                      : 'FUNDING REQUEST'}
                </p>
                <h2>
                  {actionKind === 'project'
                    ? 'Create a project'
                    : actionKind === 'rod'
                      ? 'Send request to donate'
                      : 'Request donor funding'}
                </h2>
              </div>
              <button className="close-button" onClick={resetActionForm}>
                <X size={18} />
              </button>
            </div>
            {actionKind === 'project' ? (
              <>
                <label>
                  Project code (auto-generated)
                  <input value={actionProject} disabled readOnly />
                </label>
                <label>
                  Project name
                  <input
                    value={actionName}
                    onChange={(event) => setActionName(event.target.value)}
                    placeholder="Community solar borehole"
                  />
                </label>
                <label>
                  County
                  <input
                    value={actionCounty}
                    onChange={(event) => setActionCounty(event.target.value)}
                    placeholder="Makueni"
                  />
                </label>
                <label>
                  Project plan
                  <textarea
                    value={actionPlan}
                    onChange={(event) => setActionPlan(event.target.value)}
                    placeholder="Describe milestones, outcomes, and delivery plan."
                  />
                </label>
                <label>
                  Artifacts
                  <input
                    type="file"
                    multiple
                    onChange={(event) =>
                      setActionArtifactFiles(
                        event.target.files ? Array.from(event.target.files) : [],
                      )
                    }
                  />
                  {actionArtifactFiles.length > 0 && (
                    <small>{actionArtifactFiles.map((file) => file.name).join(', ')}</small>
                  )}
                </label>
                <label>
                  Contact
                  <input
                    value={actionContact}
                    onChange={(event) => setActionContact(event.target.value)}
                    placeholder="Contact phone or email"
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  Project code
                  <input
                    value={actionProject}
                    onChange={(event) => setActionProject(event.target.value)}
                    placeholder="BHR-042"
                  />
                </label>
                <label>
                  Message
                  <textarea
                    value={actionMessage}
                    onChange={(event) => setActionMessage(event.target.value)}
                    placeholder={
                      actionKind === 'rod'
                        ? 'Describe your funding commitment.'
                        : 'Describe the funding need and milestone.'
                    }
                  />
                </label>
                <label>
                  Amount in KES
                  <input
                    type="number"
                    min="0"
                    value={actionAmount}
                    onChange={(event) => setActionAmount(event.target.value)}
                    placeholder="250000"
                  />
                </label>
              </>
            )}
            <div className="modal-actions">
              <button className="secondary-button" onClick={resetActionForm}>
                Cancel
              </button>
              <button
                className="primary-button"
                disabled={actionSubmitting || !isActionFormValid}
                onClick={handleAction}
              >
                {actionSubmitting ? 'Submitting...' : 'Submit securely'}
              </button>
            </div>
          </div>
        </div>
      )}
      {(joinListOpen || detailPanel) && (
        <div
          className="modal-backdrop"
          onClick={closeDetailPanel}
          style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'stretch' }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(440px, 100%)',
              height: '100%',
              background: '#fffaf3',
              boxShadow: '-12px 0 32px rgba(15, 23, 20, 0.18)',
              padding: 24,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
            >
              <div>
                {joinListOpen && detailPanel?.mode === 'join' && (
                  <button
                    className="text-button"
                    style={{ padding: 0, marginBottom: 8 }}
                    onClick={() => setDetailPanel(null)}
                  >
                    ← Back to projects
                  </button>
                )}
                <p className="eyebrow">{detailPanel ? 'PROJECT DETAIL' : 'BROWSE PROJECTS'}</p>
                <h2>
                  {detailPanel
                    ? (activeDetailProject?.name ?? 'Project')
                    : 'Choose a project to join'}
                </h2>
              </div>
              <button className="close-button" onClick={closeDetailPanel}>
                <X size={18} />
              </button>
            </div>

            {joinListOpen && !detailPanel && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {projects.map((project) => (
                  <button
                    key={project.id}
                    className="release-card"
                    style={{ textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => setDetailPanel({ projectId: project.id, mode: 'join' })}
                  >
                    <strong>{project.name}</strong>
                    <small>
                      {project.id} · {project.county}
                    </small>
                    <div className="release-amount">
                      {project.amount}
                      <span>{project.status}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {detailPanel && activeDetailProject && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[{ label: 'ID', value: activeDetailProject.id }].map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'rgba(90, 154, 112, 0.08)',
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: 'rgba(15, 23, 20, 0.6)' }}>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}

                {detailPanel.mode === 'manage' && detailDraft ? (
                  <>
                    <label>
                      Name
                      <input
                        value={detailDraft.name}
                        onChange={(event) =>
                          setDetailDraft((current) =>
                            current ? { ...current, name: event.target.value } : current,
                          )
                        }
                      />
                    </label>
                    <label>
                      Creation date
                      <input
                        type="date"
                        value={detailDraft.createdAt}
                        onChange={(event) =>
                          setDetailDraft((current) =>
                            current ? { ...current, createdAt: event.target.value } : current,
                          )
                        }
                      />
                    </label>
                    <label>
                      Estimated completion
                      <input
                        type="date"
                        value={detailDraft.estimatedCompletion}
                        onChange={(event) =>
                          setDetailDraft((current) =>
                            current
                              ? { ...current, estimatedCompletion: event.target.value }
                              : current,
                          )
                        }
                      />
                    </label>
                    <label>
                      Artifacts
                      {detailDraft.artifacts.map((name, index) => (
                        <div
                          key={`${name}-${index}`}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <small>{name}</small>
                          <button
                            className="close-button"
                            onClick={() =>
                              setDetailDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      artifacts: current.artifacts.filter((_, i) => i !== index),
                                    }
                                  : current,
                              )
                            }
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                      <input
                        type="file"
                        multiple
                        onChange={(event) => {
                          const names = event.target.files
                            ? Array.from(event.target.files).map((f) => f.name)
                            : []
                          setDetailDraft((current) =>
                            current
                              ? { ...current, artifacts: [...current.artifacts, ...names] }
                              : current,
                          )
                          event.target.value = ''
                        }}
                      />
                    </label>
                    <label>
                      Gallery
                      {detailDraft.gallery.map((name, index) => (
                        <div
                          key={`${name}-${index}`}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <small>{name}</small>
                          <button
                            className="close-button"
                            onClick={() =>
                              setDetailDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      gallery: current.gallery.filter((_, i) => i !== index),
                                    }
                                  : current,
                              )
                            }
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(event) => {
                          const names = event.target.files
                            ? Array.from(event.target.files).map((f) => f.name)
                            : []
                          setDetailDraft((current) =>
                            current
                              ? { ...current, gallery: [...current.gallery, ...names] }
                              : current,
                          )
                          event.target.value = ''
                        }}
                      />
                    </label>
                    <button
                      className="primary-button"
                      disabled={detailSaving}
                      onClick={handleSaveDetail}
                    >
                      {detailSaving ? 'Saving...' : 'Save changes'}
                    </button>
                  </>
                ) : (
                  <>
                    {[
                      { label: 'County', value: activeDetailProject.county },
                      { label: 'Status', value: activeDetailProject.status },
                      { label: 'Created', value: activeDetailProject.createdAt || 'Not set' },
                      {
                        label: 'Estimated completion',
                        value: activeDetailProject.estimatedCompletion || 'Not set',
                      },
                      {
                        label: 'Artifacts',
                        value: (activeDetailProject.artifacts ?? []).join(', ') || 'None yet',
                      },
                    ].map((row) => (
                      <div
                        key={row.label}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: 'rgba(90, 154, 112, 0.08)',
                          borderRadius: 8,
                          fontSize: 13,
                          gap: 12,
                        }}
                      >
                        <span style={{ color: 'rgba(15, 23, 20, 0.6)' }}>{row.label}</span>
                        <strong style={{ textAlign: 'right' }}>{row.value}</strong>
                      </div>
                    ))}
                    <button
                      className="primary-button"
                      onClick={() => {
                        const project = activeDetailProject
                        closeDetailPanel()
                        setActionKind('rod')
                        setActionProject(project.id)
                      }}
                    >
                      <HandCoins size={16} /> Join &amp; fund
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {fundingRequestDetail && (
        <div className="modal-backdrop" onClick={() => setFundingRequestDetail(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">FUNDING REQUEST</p>
                <h2>{fundingRequestDetail.projectName}</h2>
              </div>
              <button className="close-button" onClick={() => setFundingRequestDetail(null)}>
                <X size={18} />
              </button>
            </div>
            <p>{fundingRequestDetail.message}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
              {[
                { label: 'Project code', value: fundingRequestDetail.projectId },
                {
                  label: 'Amount requested',
                  value: `KES ${(fundingRequestDetail.amountCents / 100).toLocaleString()}`,
                },
                { label: 'Status', value: fundingRequestDetail.status },
              ].map((detail) => (
                <div
                  key={detail.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '8px 12px',
                    background: 'rgba(90, 154, 112, 0.08)',
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: 'rgba(15, 23, 20, 0.6)' }}>{detail.label}</span>
                  <strong>{detail.value}</strong>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setFundingRequestDetail(null)}>
                Close
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  const request = fundingRequestDetail
                  setFundingRequestDetail(null)
                  setActionKind('rod')
                  setActionProject(request.projectId)
                  setActionMessage(`Funding "${request.projectName}": ${request.message}`)
                  setActionAmount(String(request.amountCents / 100))
                }}
              >
                <HandCoins size={16} /> Join &amp; fund
              </button>
            </div>
          </div>
        </div>
      )}
      {notificationDetail && (
        <div className="modal-backdrop" onClick={() => setNotificationDetail(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">NOTIFICATION</p>
                <h2>{notificationDetail.title}</h2>
              </div>
              <button className="close-button" onClick={() => setNotificationDetail(null)}>
                <X size={18} />
              </button>
            </div>
            <p>{notificationDetail.message}</p>
            <small style={{ color: 'rgba(15, 23, 20, 0.55)' }}>
              {new Date(notificationDetail.createdAt).toLocaleString()}
            </small>
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  handleDismissNotification(notificationDetail.id)
                  setNotificationDetail(null)
                }}
              >
                Dismiss
              </button>
              <button className="primary-button" onClick={() => setNotificationDetail(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {activityDetail &&
        (() => {
          const relatedProject = projects.find((project) =>
            activityDetail.event.includes(project.id),
          )
          return (
            <div className="modal-backdrop" onClick={() => setActivityDetail(null)}>
              <div className="modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-heading">
                  <div>
                    <p className="eyebrow">ACTIVITY DETAIL</p>
                    <h2>{activityDetail.event}</h2>
                  </div>
                  <button className="close-button" onClick={() => setActivityDetail(null)}>
                    <X size={18} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
                  {[
                    { label: 'Detail', value: activityDetail.detail },
                    { label: 'When', value: activityDetail.age },
                    ...(relatedProject
                      ? [
                          { label: 'Related project', value: relatedProject.name },
                          { label: 'Status', value: relatedProject.status },
                        ]
                      : []),
                  ].map((row) => (
                    <div
                      key={row.label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '8px 12px',
                        background: 'rgba(90, 154, 112, 0.08)',
                        borderRadius: 8,
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: 'rgba(15, 23, 20, 0.6)' }}>{row.label}</span>
                      <strong style={{ textAlign: 'right' }}>{row.value}</strong>
                    </div>
                  ))}
                </div>
                <div className="modal-actions">
                  <button className="secondary-button" onClick={() => setActivityDetail(null)}>
                    Close
                  </button>
                  {relatedProject && user.role !== 'donor' && (
                    <button
                      className="primary-button"
                      onClick={() => {
                        setActivityDetail(null)
                        setDetailPanel({ projectId: relatedProject.id, mode: 'manage' })
                      }}
                    >
                      View project
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })()}
      {followUp && (
        <div className="modal-backdrop" onClick={() => setFollowUp(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">ACTION COMPLETE</p>
                <h2>{followUp.title}</h2>
              </div>
              <button className="close-button" onClick={() => setFollowUp(null)}>
                <X size={18} />
              </button>
            </div>
            <p>{followUp.message}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
              {followUp.details.map((detail) => (
                <div
                  key={detail.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '8px 12px',
                    background: 'rgba(90, 154, 112, 0.08)',
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: 'rgba(15, 23, 20, 0.6)' }}>{detail.label}</span>
                  <strong style={{ textAlign: 'right' }}>{detail.value}</strong>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button
                className="primary-button"
                onClick={() => {
                  const onDone = followUp.onDone
                  setFollowUp(null)
                  onDone?.()
                }}
              >
                <CheckCircle2 size={16} /> Done
              </button>
            </div>
          </div>
        </div>
      )}
      {searchHighlightRect && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            top: searchHighlightRect.top - 6,
            left: searchHighlightRect.left - 6,
            width: searchHighlightRect.width + 12,
            height: searchHighlightRect.height + 12,
            borderRadius: 12,
            border: '2px solid #5a9a70',
            boxShadow: '0 0 0 4px rgba(90, 154, 112, 0.25)',
            pointerEvents: 'none',
            zIndex: 75,
            transition: 'opacity 0.4s ease',
          }}
        />
      )}
    </div>
  )
}
export default App