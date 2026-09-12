import type { DashboardPayload } from './types'

export const demoDashboard: DashboardPayload = {
  source: 'demo',
  metrics: {
    capitalMonitored: 'KES 84.6M',
    activeProjects: 24,
    confirmations: 1284,
    reportsNeedingReview: 3,
  },
  projects: [
    {
      id: 'BHR-042',
      name: 'Makueni Borehole 042',
      county: 'Makueni',
      status: 'Verified',
      confirmations: '18 / 12',
      progress: 92,
      amount: 'KES 4.8M',
      color: 'green',
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
    },
  ],
  reports: [
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
  ],
}