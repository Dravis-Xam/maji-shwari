export type WorkspacePayload = {
  source: 'neon' | 'demo'
  releases: Array<{
    projectId: string
    projectName: string
    amount: string
    status: 'Approved' | 'Pending approval'
    milestone: string
  }>
  vulnerability: Array<{ county: string; score: number; label: 'High risk' | 'Watch' | 'Stable' }>
  rules: Array<{ title: string; detail: string }>
  activity: Array<{ event: string; detail: string; age: string }>
}

export const demoWorkspace: WorkspacePayload = {
  source: 'demo',
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
    { county: 'Turkana', score: 82, label: 'High risk' },
    { county: 'Tana River', score: 73, label: 'Watch' },
    { county: 'Kitui', score: 64, label: 'Watch' },
    { county: 'Makueni', score: 41, label: 'Stable' },
  ],
  rules: [
    {
      title: 'Unique reporters',
      detail: 'Count one confirmation per reporter, project, and status.',
    },
    {
      title: 'Threshold',
      detail: 'A project reaches verified after its configured confirmation count.',
    },
    {
      title: 'Audit flags',
      detail: 'DELAYED, INCOMPLETE, and PROBLEM reports create an audit flag.',
    },
    {
      title: 'Evidence format',
      detail: 'Messages must use PROJECT-CODE STATUS, such as BHR-042 DONE.',
    },
  ],
  activity: [
    { event: 'Dashboard data synchronized', detail: 'MajiShwari system', age: '1 hour ago' },
    { event: 'WTR-117 marked for audit review', detail: 'Verification engine', age: '2 hours ago' },
    {
      event: 'BHR-042 reached verification threshold',
      detail: 'Verification engine',
      age: '3 hours ago',
    },
    {
      event: 'Daily reconciliation scheduled for 02:00 UTC',
      detail: 'System scheduler',
      age: '4 hours ago',
    },
  ],
}