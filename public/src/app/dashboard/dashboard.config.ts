import { LoginResponse } from '../services/auth.service';

export type DashboardRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export type DashboardPageId =
  | 'overview'
  | 'users'
  | 'roles'
  | 'leaves'
  | 'reports'
  | 'settings'
  | 'team'
  | 'approvals'
  | 'calendar'
  | 'profile'
  | 'requests'
  | 'history';

export type DashboardMenuItem = {
  path: DashboardPageId;
  label: string;
  icon: string;
};

export type DashboardMetric = {
  label: string;
  value: string;
  note: string;
};

export type DashboardWorkItem = {
  label: string;
  detail: string;
  status: string;
};

export type DashboardView = {
  eyebrow: string;
  title: string;
  description: string;
  metrics: DashboardMetric[];
  focusTitle: string;
  focusItems: string[];
  workTitle: string;
  workItems: DashboardWorkItem[];
};

const DASHBOARD_MENUS: Record<DashboardRole, DashboardMenuItem[]> = {
  ADMIN: [
    { path: 'overview', label: 'Overview', icon: 'fa-house' },
    { path: 'users', label: 'User Management', icon: 'fa-users-gear' },
    { path: 'leaves', label: 'Leave Operations', icon: 'fa-calendar-check' },
    { path: 'reports', label: 'Reports', icon: 'fa-chart-column' },
    { path: 'settings', label: 'Settings', icon: 'fa-sliders' }
  ],
  MANAGER: [
    { path: 'overview', label: 'Overview', icon: 'fa-house' },
    { path: 'team', label: 'Team Members', icon: 'fa-user-group' },
    { path: 'approvals', label: 'Approvals', icon: 'fa-circle-check' },
    { path: 'calendar', label: 'Team Calendar', icon: 'fa-calendar-days' },
    { path: 'history', label: 'My Leave History', icon: 'fa-clock-rotate-left' },
    { path: 'reports', label: 'Reports', icon: 'fa-chart-line' },
    { path: 'settings', label: 'Settings', icon: 'fa-sliders' }
  ],
  EMPLOYEE: [
    { path: 'overview', label: 'Overview', icon: 'fa-house' },
    { path: 'profile', label: 'My Profile', icon: 'fa-id-card' },
    { path: 'requests', label: 'Leave Requests', icon: 'fa-paper-plane'},
    { path: 'history', label: 'History', icon: 'fa-clock-rotate-left' },
    { path: 'calendar', label: 'Calendar', icon: 'fa-calendar' },
    { path: 'settings', label: 'Settings', icon: 'fa-sliders' }
  ]
};

export function normalizeDashboardRole(role?: string): DashboardRole {
  if (role === 'ADMIN' || role === 'MANAGER') {
    return role;
  }

  return 'EMPLOYEE';
}

export function getDashboardMenuItems(role?: string): DashboardMenuItem[] {
  return DASHBOARD_MENUS[normalizeDashboardRole(role)];
}

export function getDefaultDashboardPage(role?: string): DashboardPageId {
  return getDashboardMenuItems(role)[0]?.path ?? 'overview';
}

export function isDashboardPageAllowed(role: string | undefined, pageId: string): pageId is DashboardPageId {
  return getDashboardMenuItems(role).some((item) => item.path === pageId);
}

export function getDashboardView(user: LoginResponse, pageId: DashboardPageId): DashboardView {
  const role = normalizeDashboardRole(user.role);
  const resolvedPageId = isDashboardPageAllowed(role, pageId) ? pageId : getDefaultDashboardPage(role);

  if (role === 'ADMIN') {
    return getAdminView(user, resolvedPageId);
  }

  if (role === 'MANAGER') {
    return getManagerView(user, resolvedPageId);
  }

  return getEmployeeView(user, resolvedPageId);
}

function getAdminView(user: LoginResponse, pageId: DashboardPageId): DashboardView {
  const views: Record<DashboardPageId, DashboardView> = {
    overview: {
      eyebrow: 'Admin Workspace',
      title: 'System overview',
      description: 'Monitor platform activity, user access, and leave operations from one clean workspace.',
      metrics: [
        { label: 'Signed in as', value: user.username, note: 'Primary administrator session' },
        { label: 'Coverage', value: 'All departments', note: 'You can review users, roles, and leave flows' },
        { label: 'Account health', value: user.active ? 'Active' : 'Inactive', note: 'Security access is currently valid' }
      ],
      focusTitle: 'Admin priorities',
      focusItems: [
        'Review new user onboarding and keep role assignments aligned with department needs.',
        'Confirm leave process rules are visible and consistent before approvals move forward.',
        'Watch system access patterns and reset credentials quickly when policy changes happen.'
      ],
      workTitle: 'Today operational queue',
      workItems: [
        { label: 'User access review', detail: 'Validate active and inactive accounts before end-of-day sync.', status: 'Ready' },
        { label: 'Leave policy audit', detail: 'Check whether role permissions match approval responsibilities.', status: 'Pending' },
        { label: 'Platform settings', detail: 'Keep notification and workflow defaults aligned with HR policy.', status: 'Stable' }
      ]
    },
    users: {
      eyebrow: 'User Management',
      title: 'Manage employee accounts',
      description: 'Keep account data clean, access levels correct, and onboarding steps easy to track.',
      metrics: [
        { label: 'Workspace', value: 'User records', note: 'Profile, role, and activation updates' },
        { label: 'Admin owner', value: user.username, note: 'Changes are handled from your session' },
        { label: 'Main action', value: 'Create and update', note: 'Keep employee access accurate and current' }
      ],
      focusTitle: 'Account maintenance',
      focusItems: [
        'Add new users with the correct role and activation status from the beginning.',
        'Review profile information carefully so email and username records stay reliable.',
        'Archive or deactivate accounts quickly when employees move teams or exit the company.'
      ],
      workTitle: 'Account workflow',
      workItems: [
        { label: 'New employee setup', detail: 'Prepare account details and assign the correct permission level.', status: 'In queue' },
        { label: 'Role correction', detail: 'Update outdated responsibility mapping for active users.', status: 'Review' },
        { label: 'Inactive cleanup', detail: 'Remove stale access from accounts no longer in use.', status: 'Open' }
      ]
    },
    roles: {
      eyebrow: 'Roles And Access',
      title: 'Permission structure',
      description: 'Control who can approve, manage, and review activity across the dashboard.',
      metrics: [
        { label: 'Security scope', value: 'Role permissions', note: 'Admin, manager, and employee access layers' },
        { label: 'Current owner', value: user.username, note: 'Responsible for access governance' },
        { label: 'Priority', value: 'Least privilege', note: 'Only provide the access each role needs' }
      ],
      focusTitle: 'Access governance',
      focusItems: [
        'Keep approval actions limited to the right manager and administrator roles.',
        'Review elevated access after department changes to avoid permission drift.',
        'Use clear role boundaries so employees only see their own leave data and profile details.'
      ],
      workTitle: 'Permission tasks',
      workItems: [
        { label: 'Role map review', detail: 'Check that approval flows still match the reporting hierarchy.', status: 'Active' },
        { label: 'Access exception check', detail: 'Audit temporary permissions and close unneeded overrides.', status: 'Pending' },
        { label: 'Policy alignment', detail: 'Keep the dashboard navigation consistent with permission rules.', status: 'On track' }
      ]
    },
    leaves: {
      eyebrow: 'Leave Operations',
      title: 'Leave monitoring',
      description: 'Track request movement, approval timing, and policy consistency across the organization.',
      metrics: [
        { label: 'Module', value: 'Leave operations', note: 'Visibility across requests and approvals' },
        { label: 'View mode', value: 'Administrative', note: 'Company-wide process monitoring' },
        { label: 'Outcome', value: 'Workflow clarity', note: 'Make request movement easy to understand' }
      ],
      focusTitle: 'Process oversight',
      focusItems: [
        'Watch pending requests so bottlenecks are easy to spot before they impact schedules.',
        'Keep leave types and balances clear so managers can approve with confidence.',
        'Review unusual request spikes by department and confirm nothing is stuck in review.'
      ],
      workTitle: 'Operational checks',
      workItems: [
        { label: 'Pending approvals', detail: 'Review queues that may need escalation or reassignment.', status: 'Monitor' },
        { label: 'Leave rule audit', detail: 'Confirm each leave category matches the current HR process.', status: 'Scheduled' },
        { label: 'Calendar integrity', detail: 'Check that approved leave is reflected consistently across views.', status: 'Open' }
      ]
    },
    reports: {
      eyebrow: 'Reporting',
      title: 'Insights and trends',
      description: 'Use structured reporting to review usage patterns, approvals, and workforce availability.',
      metrics: [
        { label: 'Reporting view', value: 'Executive summary', note: 'Useful for operational and HR review' },
        { label: 'Lead admin', value: user.username, note: 'Current report workspace owner' },
        { label: 'Main goal', value: 'Actionable trends', note: 'Turn dashboard activity into decisions' }
      ],
      focusTitle: 'Reporting objectives',
      focusItems: [
        'Compare approval turnaround trends to identify overloaded teams or managers.',
        'Highlight inactive accounts and access anomalies before audits or compliance checks.',
        'Use leave request patterns to support staffing plans and business continuity.'
      ],
      workTitle: 'Reporting pipeline',
      workItems: [
        { label: 'Approval trend review', detail: 'Track which teams are processing requests more slowly.', status: 'Running' },
        { label: 'User activity summary', detail: 'Prepare a clean view of access and account health changes.', status: 'Draft' },
        { label: 'Department leave trend', detail: 'Surface planning signals for upcoming workload periods.', status: 'Open' }
      ]
    },
    settings: {
      eyebrow: 'System Settings',
      title: 'Platform controls',
      description: 'Maintain the structure behind notifications, access defaults, and workflow behavior.',
      metrics: [
        { label: 'Control area', value: 'Core settings', note: 'System-wide preferences and defaults' },
        { label: 'Session owner', value: user.username, note: 'Changes are tied to your admin account' },
        { label: 'Risk level', value: 'High impact', note: 'Update carefully because changes affect everyone' }
      ],
      focusTitle: 'Configuration discipline',
      focusItems: [
        'Review system defaults before changing them so approval or leave workflows stay predictable.',
        'Keep security-sensitive settings easy to audit and hard to change by mistake.',
        'Document configuration changes when they affect multiple departments or roles.'
      ],
      workTitle: 'Configuration queue',
      workItems: [
        { label: 'Notification defaults', detail: 'Confirm alerts go to the right people at the right step.', status: 'Check' },
        { label: 'Policy sync', detail: 'Align system behavior with the latest HR leave guidelines.', status: 'Pending' },
        { label: 'Environment review', detail: 'Inspect admin-facing settings for consistency and clarity.', status: 'Stable' }
      ]
    },
    team: buildUnavailableView('Team Members', 'This section belongs to the manager workspace.'),
    approvals: buildUnavailableView('Approvals', 'This section belongs to the manager workspace.'),
    calendar: buildUnavailableView('Calendar', 'The admin workspace uses leave operations instead of the shared calendar route.'),
    profile: buildUnavailableView('My Profile', 'This section belongs to the employee workspace.'),
    requests: buildUnavailableView('Leave Requests', 'This section belongs to the employee workspace.'),
    history: buildUnavailableView('History', 'This section belongs to the employee workspace.')
  };

  return views[pageId];
}

function getManagerView(user: LoginResponse, pageId: DashboardPageId): DashboardView {
  const views: Record<DashboardPageId, DashboardView> = {
    overview: {
      eyebrow: 'Manager Workspace',
      title: 'Team dashboard',
      description: 'Keep approvals moving, protect team coverage, and stay ahead of scheduling conflicts.',
      metrics: [
        { label: 'Manager', value: user.username, note: 'Responsible for team-level coordination' },
        { label: 'Scope', value: 'Team operations', note: 'Approvals, availability, and reporting' },
        { label: 'Account health', value: user.active ? 'Active' : 'Inactive', note: 'Your manager access is available' }
      ],
      focusTitle: 'Manager priorities',
      focusItems: [
        'Review incoming leave requests quickly so team planning does not stall.',
        'Balance workload and approved leave to maintain enough daily coverage.',
        'Keep an eye on patterns that show burnout, overlap, or recurring conflicts.'
      ],
      workTitle: 'Manager queue',
      workItems: [
        { label: 'Pending approvals', detail: 'Review requests that need a manager decision this week.', status: 'Ready' },
        { label: 'Coverage planning', detail: 'Confirm backup coverage for upcoming leave windows.', status: 'In progress' },
        { label: 'Team updates', detail: 'Share schedule impact with affected stakeholders early.', status: 'Open' }
      ]
    },
    team: {
      eyebrow: 'Team Members',
      title: 'Team visibility',
      description: 'Track your employees, their workload coverage, and the status of upcoming leave.',
      metrics: [
        { label: 'Section', value: 'People view', note: 'Monitor employee availability and ownership' },
        { label: 'Manager owner', value: user.username, note: 'Team coordination happens here' },
        { label: 'Main outcome', value: 'Reliable coverage', note: 'Use team visibility to avoid gaps' }
      ],
      focusTitle: 'People management',
      focusItems: [
        'Keep each team member leave plan visible so delivery timelines stay realistic.',
        'Watch for overlapping requests from key employees during the same project window.',
        'Use profile and attendance signals to support fair approval decisions.'
      ],
      workTitle: 'People tasks',
      workItems: [
        { label: 'Availability scan', detail: 'Check which team members have upcoming approved leave.', status: 'Review' },
        { label: 'Skill coverage', detail: 'Protect delivery by planning backup ownership early.', status: 'Open' },
        { label: 'Request follow-up', detail: 'Ask for context when a leave request affects major deadlines.', status: 'As needed' }
      ]
    },
    approvals: {
      eyebrow: 'Approvals',
      title: 'Approval center',
      description: 'Review leave requests with enough context to make quick and fair decisions.',
      metrics: [
        { label: 'Decision mode', value: 'Approval review', note: 'Focused on pending employee requests' },
        { label: 'Responsible manager', value: user.username, note: 'Current approval queue owner' },
        { label: 'Target', value: 'Fast turnaround', note: 'Reduce waiting time for employees' }
      ],
      focusTitle: 'Approval discipline',
      focusItems: [
        'Review the leave period, handover needs, and team coverage before confirming approval.',
        'Use a consistent decision process so employees understand how requests are handled.',
        'Escalate only the requests that need admin visibility or policy clarification.'
      ],
      workTitle: 'Approval steps',
      workItems: [
        { label: 'Pending review', detail: 'Evaluate requests waiting for first-level approval.', status: 'Priority' },
        { label: 'Coverage check', detail: 'Confirm business continuity before final approval.', status: 'Required' },
        { label: 'Decision notes', detail: 'Capture clear reasons when deferring or rejecting a request.', status: 'Important' }
      ]
    },
    calendar: {
      eyebrow: 'Team Calendar',
      title: 'Schedule planning',
      description: 'Use the team calendar to spread leave fairly and avoid avoidable conflicts.',
      metrics: [
        { label: 'Calendar view', value: 'Team leave plan', note: 'Upcoming availability in one place' },
        { label: 'Planning owner', value: user.username, note: 'Coverage decisions sit with you' },
        { label: 'Best use', value: 'Conflict prevention', note: 'Spot overlap before it becomes a problem' }
      ],
      focusTitle: 'Calendar planning',
      focusItems: [
        'Review upcoming leave side by side to spot collisions in advance.',
        'Adjust staffing plans before approval windows close or project deadlines tighten.',
        'Use the calendar as the shared reference point for managers and employees.'
      ],
      workTitle: 'Calendar actions',
      workItems: [
        { label: 'Overlap review', detail: 'Scan for team members requesting the same dates.', status: 'Monitor' },
        { label: 'Coverage balancing', detail: 'Spread planned leave to protect service continuity.', status: 'Open' },
        { label: 'Stakeholder update', detail: 'Communicate schedule risks when approvals impact deadlines.', status: 'As needed' }
      ]
    },
    reports: {
      eyebrow: 'Manager Reports',
      title: 'Team insights',
      description: 'Review leave patterns and approval speed to support better planning decisions.',
      metrics: [
        { label: 'Report focus', value: 'Team trends', note: 'Attendance and leave behavior over time' },
        { label: 'Current manager', value: user.username, note: 'Insights reflect your current workspace' },
        { label: 'Main benefit', value: 'Stronger planning', note: 'Use trends to make decisions earlier' }
      ],
      focusTitle: 'Insight goals',
      focusItems: [
        'Track which months produce the most leave requests so staffing plans stay realistic.',
        'Review delayed approvals to understand where manager attention is getting stretched.',
        'Use reporting trends to coach employees toward better leave planning habits.'
      ],
      workTitle: 'Reporting checklist',
      workItems: [
        { label: 'Monthly pattern review', detail: 'Compare peaks in leave requests against delivery cycles.', status: 'Scheduled' },
        { label: 'Approval speed', detail: 'Inspect whether requests are waiting too long for action.', status: 'Watch' },
        { label: 'Team utilization', detail: 'Use leave trends to plan future staffing and handoffs.', status: 'Open' }
      ]
    },
    users: buildUnavailableView('User Management', 'This section belongs to the admin workspace.'),
    roles: buildUnavailableView('Roles And Access', 'This section belongs to the admin workspace.'),
    leaves: buildUnavailableView('Leave Operations', 'This section belongs to the admin workspace.'),
    settings: buildUnavailableView('Settings', 'This section belongs to the admin workspace.'),
    profile: buildUnavailableView('My Profile', 'This section belongs to the employee workspace.'),
    requests: buildUnavailableView('Leave Requests', 'This section belongs to the employee workspace.'),
    history: {
      eyebrow: 'My Leave History',
      title: 'Your leave records',
      description: 'Review all your personal leave requests, their status, and approval history.',
      metrics: [
        { label: 'History view', value: 'Personal records', note: 'Your own leave submissions' },
        { label: 'Manager', value: user.username, note: 'Viewing your own leave history' },
        { label: 'Use case', value: 'Personal planning', note: 'Track your leave usage and patterns' }
      ],
      focusTitle: 'History review',
      focusItems: [
        'Review your approved and pending leave to plan upcoming time off.',
        'Check rejection reasons to improve future leave requests.',
        'Use your history to stay aware of remaining leave balance.'
      ],
      workTitle: 'History actions',
      workItems: [
        { label: 'Past approvals', detail: 'See which requests were approved and when.', status: 'Visible' },
        { label: 'Pending review', detail: 'Track requests still awaiting a decision.', status: 'Monitor' },
        { label: 'Future planning', detail: 'Use past patterns to plan upcoming leave.', status: 'Recommended' }
      ]
    }
  };

  return views[pageId];
}

function getEmployeeView(user: LoginResponse, pageId: DashboardPageId): DashboardView {
  const views: Record<DashboardPageId, DashboardView> = {
    overview: {
      eyebrow: 'Employee Workspace',
      title: 'Personal dashboard',
      description: 'Check your leave activity, stay aware of approvals, and manage your account from one place.',
      metrics: [
        { label: 'Employee', value: user.username, note: 'This session is tied to your account' },
        { label: 'Access level', value: user.role, note: 'Personal leave and profile workspace' },
        { label: 'Account health', value: user.active ? 'Active' : 'Inactive', note: 'Your sign-in access is available' }
      ],
      focusTitle: 'Personal priorities',
      focusItems: [
        'Track request progress so you always know whether leave is pending, approved, or needs changes.',
        'Keep profile details updated to avoid communication issues during approvals or notifications.',
        'Use the dashboard regularly to plan leave early and reduce last-minute conflicts.'
      ],
      workTitle: 'Personal queue',
      workItems: [
        { label: 'Upcoming requests', detail: 'Review any leave you are planning to submit soon.', status: 'Open' },
        { label: 'Approval tracking', detail: 'Check whether recent requests are still pending review.', status: 'Monitor' },
        { label: 'Profile check', detail: 'Confirm your account details remain accurate and current.', status: 'Ready' }
      ]
    },
    profile: {
      eyebrow: 'My Profile',
      title: 'Account details',
      description: 'Use your profile area to keep personal information and login details accurate.',
      metrics: [
        { label: 'Profile owner', value: user.username, note: 'This profile belongs to your signed-in account' },
        { label: 'Email record', value: user.email, note: 'Keep it current for alerts and recovery' },
        { label: 'Security action', value: 'Password update', note: 'Available any time from the sidebar' }
      ],
      focusTitle: 'Profile upkeep',
      focusItems: [
        'Review your email and account information so approval updates reach you without delay.',
        'Use strong password practices and update credentials whenever needed.',
        'Raise profile mismatches early so access or notification issues do not block requests.'
      ],
      workTitle: 'Profile actions',
      workItems: [
        { label: 'Personal details', detail: 'Confirm the account information shown in the system is correct.', status: 'Check' },
        { label: 'Password hygiene', detail: 'Rotate your password if you suspect old or weak credentials.', status: 'Available' },
        { label: 'Support follow-up', detail: 'Contact an admin if core account details need correction.', status: 'As needed' }
      ]
    },
    requests: {
      eyebrow: 'Leave Requests',
      title: 'Apply for leave',
      description: 'Prepare requests clearly so managers can review them quickly and confidently.',
      metrics: [
        { label: 'Section', value: 'Request management', note: 'Create and review leave applications' },
        { label: 'Requester', value: user.username, note: 'Your leave plans start from here' },
        { label: 'Best habit', value: 'Apply early', note: 'Early requests improve approval speed' }
      ],
      focusTitle: 'Request quality',
      focusItems: [
        'Enter your dates clearly and avoid incomplete submissions that slow approval.',
        'Share enough planning context when time away could affect team delivery.',
        'Review your request before submitting so changes do not need to be repeated later.'
      ],
      workTitle: 'Request steps',
      workItems: [
        { label: 'Prepare leave dates', detail: 'Choose the correct period before submitting the request.', status: 'Start' },
        { label: 'Add notes if needed', detail: 'Mention handover or team impact when it helps review.', status: 'Optional' },
        { label: 'Track approval', detail: 'Watch the request after submission until a decision is made.', status: 'Follow up' }
      ]
    },
    history: {
      eyebrow: 'Leave History',
      title: 'Previous requests',
      description: 'Review earlier leave activity to keep track of patterns, approvals, and timing.',
      metrics: [
        { label: 'History view', value: 'Past submissions', note: 'See earlier request decisions in one place' },
        { label: 'Employee owner', value: user.username, note: 'Only your request history belongs here' },
        { label: 'Use case', value: 'Better planning', note: 'Use past requests to schedule future leave better' }
      ],
      focusTitle: 'History review',
      focusItems: [
        'Look back at previous submissions to understand the lead time that works best.',
        'Use your leave history to plan around busy periods and recurring team commitments.',
        'Check decision timing if you want to improve how early you submit requests.'
      ],
      workTitle: 'History checks',
      workItems: [
        { label: 'Past approvals', detail: 'Review which requests were approved and how long decisions took.', status: 'Visible' },
        { label: 'Seasonal patterns', detail: 'Notice the times of year when you usually request leave.', status: 'Helpful' },
        { label: 'Future planning', detail: 'Use previous timing as a guide for your next request.', status: 'Recommended' }
      ]
    },
    calendar: {
      eyebrow: 'Calendar',
      title: 'Leave planning calendar',
      description: 'Check your own leave schedule and avoid clashing with key team timelines.',
      metrics: [
        { label: 'View', value: 'Personal calendar', note: 'Your planned and approved leave at a glance' },
        { label: 'Account owner', value: user.username, note: 'Calendar reflects your current session' },
        { label: 'Goal', value: 'Smarter planning', note: 'Choose dates with better visibility' }
      ],
      focusTitle: 'Calendar habits',
      focusItems: [
        'Use the calendar before submitting a request so you can choose dates more confidently.',
        'Review planned time off alongside important team deadlines or meetings.',
        'Check approved leave regularly so you stay aligned with your manager expectations.'
      ],
      workTitle: 'Calendar tasks',
      workItems: [
        { label: 'Upcoming dates', detail: 'Review your next planned leave period.', status: 'Check' },
        { label: 'Conflict awareness', detail: 'Avoid requesting time off during critical team windows.', status: 'Important' },
        { label: 'Plan ahead', detail: 'Use the calendar view to submit requests with enough notice.', status: 'Recommended' }
      ]
    },
    users: buildUnavailableView('User Management', 'This section belongs to the admin workspace.'),
    roles: buildUnavailableView('Roles And Access', 'This section belongs to the admin workspace.'),
    leaves: buildUnavailableView('Leave Operations', 'This section belongs to the admin workspace.'),
    reports: buildUnavailableView('Reports', 'This section belongs to the admin or manager workspace.'),
    settings: buildUnavailableView('Settings', 'This section belongs to the admin workspace.'),
    team: buildUnavailableView('Team Members', 'This section belongs to the manager workspace.'),
    approvals: buildUnavailableView('Approvals', 'This section belongs to the manager workspace.')
  };

  return views[pageId];
}

function buildUnavailableView(title: string, detail: string): DashboardView {
  return {
    eyebrow: 'Dashboard',
    title,
    description: detail,
    metrics: [
      { label: 'Section status', value: 'Unavailable', note: 'This route is not part of your assigned workspace' },
      { label: 'Recommended action', value: 'Use sidebar', note: 'Select one of the allowed menu items' },
      { label: 'Routing mode', value: 'Protected', note: 'Unauthorized sections redirect automatically' }
    ],
    focusTitle: 'What to do next',
    focusItems: [
      'Return to one of the visible sidebar sections for your role.',
      'Use the correct dashboard menu for your current access level.',
      'Contact an administrator if you believe your role setup is incorrect.'
    ],
    workTitle: 'Routing protection',
    workItems: [
      { label: 'Role validation', detail: 'The dashboard checks role access before letting the route stay active.', status: 'Enabled' },
      { label: 'Sidebar sync', detail: 'Only allowed routes are shown in the left navigation menu.', status: 'Enabled' },
      { label: 'Next step', detail: 'Choose a visible section from the sidebar to continue.', status: 'Open' }
    ]
  };
}
