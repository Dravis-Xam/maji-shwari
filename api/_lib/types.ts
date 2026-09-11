export type ReportStatus = 'DONE' | 'DELAYED' | 'INCOMPLETE' | 'PROBLEM'

export type Project = {
  id: string
  name: string
  county: string
  status: 'Verified' | 'In review'
  confirmations: string
  progress: number
  amount: string
  color: 'green' | 'amber'
}

export type Report = {
  message: string
  source: string
  time: string
  tone: 'positive' | 'warning'
  label: 'Confirmed' | 'Audit flag'
}

export type DashboardPayload = {
  source: 'neon' | 'demo'
  projects: Project[]
  reports: Report[]
  metrics: {
    capitalMonitored: string
    activeProjects: number
    confirmations: number
    reportsNeedingReview: number
  }
}
