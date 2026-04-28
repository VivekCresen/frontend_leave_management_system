import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { AdminLeaveTableRow } from './dashboard-leave-table.component';
import { LeaveAuditCacheService } from '../../services/leave-audit-cache.service';

type LeaveAuditTrailEntry = {
  event: string;
  actor: string;
  timestamp: string;
  note: string;
  taskId?: string;
};

type WorkflowTone = 'success' | 'danger' | 'warning' | 'neutral';

type WorkflowEntryView = {
  title: string;
  actorLabel: string;
  actorName: string;
  statusLabel: string;
  tone: WorkflowTone;
  icon: string;
  summary: string;
  reason: string;
  timestamp: string;
};

type ReviewStageView = {
  title: string;
  caption: string;
  reviewer: string;
  reviewerLabel: string;
  status: string;
  tone: WorkflowTone;
  detail: string;
  reason: string;
};

@Component({
  selector: 'app-leave-progress-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leave-progress-modal.component.html',
  styleUrls: ['./leave-progress-modal.component.css']
})
export class LeaveProgressModalComponent implements OnInit {
  @Input({ required: true }) leave!: AdminLeaveTableRow;
  @Output() closed = new EventEmitter<void>();

  constructor(private readonly auditCache: LeaveAuditCacheService) {}

  ngOnInit(): void {
    if (this.leave?.id && this.leave.trail) {
      this.auditCache.addLeaveToCache(this.leave.id);
    }
  }

  get workflowEntries(): WorkflowEntryView[] {
    const rawTrail = this.getTrailSource();
    
    const visibleTrail = rawTrail.filter((entry) => 
      !['PROCESS_STARTED', 'APPROVER_RESOLVED'].includes(entry.event.trim().toUpperCase())
    );

    const entries = visibleTrail.map((entry) => this.toWorkflowEntry(entry));

    if (this.leave.status === 'PENDING') {
       entries.push(this.toWorkflowEntry({
           event: 'PENDING_MANAGER',
           actor: this.findAssignedApprover(rawTrail, 'manager'),
           timestamp: '',
           note: ''
       }));
    } else if (this.leave.status === 'MANAGER_APPROVED') {
       entries.push(this.toWorkflowEntry({
           event: 'PENDING_ADMIN',
           actor: this.findAssignedApprover(rawTrail, 'admin'),
           timestamp: '',
           note: ''
       }));
    }

    return entries;
  }

  get currentStatusLabel(): string {
    return this.formatStatusLabel(this.leave.status);
  }

  get currentStatusTone(): WorkflowTone {
    return this.getStatusToneFromValue(this.leave.status);
  }

  formatTimestamp(value: string | null | undefined): string {
    if (!value) {
      return 'Pending';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  closeModal(): void {
    this.closed.emit();
  }

  private getTrailSource(): LeaveAuditTrailEntry[] {
    const parsed = this.parsedTrail;
    return parsed.length ? parsed : this.fallbackTrail;
  }

  private get parsedTrail(): LeaveAuditTrailEntry[] {
    if (!this.leave.trail?.trim()) {
      return [];
    }

    try {
      const parsed = JSON.parse(this.leave.trail);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((entry) => this.normalizeTrailEntry(entry))
        .filter((entry): entry is LeaveAuditTrailEntry => entry !== null)
        .sort((left, right) => this.getTimeValue(left.timestamp) - this.getTimeValue(right.timestamp));
    } catch {
      return [];
    }
  }

  private get fallbackTrail(): LeaveAuditTrailEntry[] {
    const items: LeaveAuditTrailEntry[] = [
      {
        event: 'SUBMITTED',
        actor: this.leave.fullName || 'Employee',
        timestamp: this.leave.createdAt || '',
        note: `Leave request submitted by ${this.leave.fullName || 'Employee'}`
      }
    ];

    if (this.leave.managerApprovedBy) {
      items.push({
        event: 'MANAGER_APPROVED',
        actor: this.leave.managerApprovedBy,
        timestamp: this.leave.managerApprovedAt || '',
        note: `Approved by manager ${this.leave.managerApprovedBy}. Pending admin final approval.`
      });
    }

    if (this.leave.managerRejectedBy) {
      items.push({
        event: 'REJECTED',
        actor: this.leave.managerRejectedBy,
        timestamp: this.leave.managerRejectedAt || '',
        note: `Rejected by ${this.leave.managerRejectedBy}.${this.leave.rejectionReason ? ` Reason: ${this.leave.rejectionReason}` : ''}`
      });
    }

    if (this.leave.adminApprovedBy) {
      items.push({
        event: 'APPROVED',
        actor: this.leave.adminApprovedBy,
        timestamp: this.leave.adminApprovedAt || '',
        note: `Final approval by admin ${this.leave.adminApprovedBy}`
      });
    }

    if (this.leave.adminRejectedBy) {
      items.push({
        event: 'REJECTED',
        actor: this.leave.adminRejectedBy,
        timestamp: this.leave.adminRejectedAt || '',
        note: `Rejected by ${this.leave.adminRejectedBy}.${this.leave.rejectionReason ? ` Reason: ${this.leave.rejectionReason}` : ''}`
      });
    }

    return items;
  }

  private toWorkflowEntry(entry: LeaveAuditTrailEntry): WorkflowEntryView {
    const statusLabel = this.getEntryStatus(entry);
    const actorName = this.getReviewerName(entry);
    const reason = this.extractReason(entry);

    return {
      title: this.getEntryTitle(entry),
      actorLabel: this.getActorLabel(entry),
      actorName,
      statusLabel,
      tone: this.getStatusTone(entry),
      icon: this.getEntryIcon(entry),
      summary: this.humanizeNote(entry, actorName, statusLabel, reason),
      reason,
      timestamp: entry.timestamp
    };
  }

  private getEntryTitle(entry: LeaveAuditTrailEntry): string {
    const event = this.getNormalizedEvent(entry);
    const note = entry.note.toLowerCase();

    if (event === 'SUBMITTED') {
      return 'Leave Requested';
    }

    if (event === 'PROCESS_STARTED') {
      return 'Workflow Started';
    }

    if (event === 'APPROVER_RESOLVED') {
      return 'Approver Assigned';
    }

    if (event === 'MANAGER_APPROVED' || note.includes('manager ')) {
      return 'Manager Review';
    }

    if (event === 'APPROVED') {
      return 'Final Approval';
    }

    if (event === 'REJECTED') {
      return note.includes('manager') ? 'Manager Rejection' : 'Final Rejection';
    }

    if (event === 'PENDING_MANAGER') {
      return 'Pending Manager Review';
    }

    if (event === 'PENDING_ADMIN') {
      return 'Pending Admin Approval';
    }

    return this.titleCase(event.replace(/_/g, ' '));
  }

  private getActorLabel(entry: LeaveAuditTrailEntry): string {
    const event = this.getNormalizedEvent(entry);

    if (event === 'SUBMITTED') {
      return 'Requested by';
    }

    if (event === 'APPROVER_RESOLVED') {
      return 'Assigned to';
    }

    if (event === 'MANAGER_APPROVED') {
      return 'Reviewed by';
    }

    if (event === 'APPROVED') {
      return 'Approved by';
    }

    if (event === 'REJECTED') {
      return 'Rejected by';
    }

    return 'Updated by';
  }

  private getReviewerName(entry: LeaveAuditTrailEntry): string {
    const event = this.getNormalizedEvent(entry);
    const fromNote = this.extractActorFromNote(entry.note);

    if (event === 'SUBMITTED') {
      return this.formatDisplayName(fromNote || entry.actor) || this.leave.fullName || 'Employee';
    }

    return this.formatDisplayName(fromNote || entry.actor) || entry.actor || 'System';
  }

  private getEntryStatus(entry: LeaveAuditTrailEntry): string {
    const event = this.getNormalizedEvent(entry);
    const note = entry.note.toLowerCase();

    if (event === 'PENDING_MANAGER' || event === 'PENDING_ADMIN') {
      return 'Pending';
    }

    if (event === 'SUBMITTED') {
      return 'Submitted';
    }

    if (event === 'PROCESS_STARTED') {
      return 'Started';
    }

    if (event === 'APPROVER_RESOLVED') {
      return 'Assigned';
    }

    if (event === 'MANAGER_APPROVED') {
      return 'Approved by Manager';
    }

    if (event === 'APPROVED') {
      return 'Approved';
    }

    if (event === 'REJECTED' || note.includes('reject')) {
      return 'Rejected';
    }

    if (note.includes('pending')) {
      return 'Pending';
    }

    return this.formatStatusLabel(event);
  }

  private getStatusTone(entry: LeaveAuditTrailEntry): WorkflowTone {
    return this.getStatusToneFromValue(this.getEntryStatus(entry));
  }

  private getStatusToneFromValue(value: string | null | undefined): WorkflowTone {
    const normalized = (value || '').trim().toLowerCase();

    if (normalized.includes('reject')) {
      return 'danger';
    }

    if (normalized.includes('approved')) {
      return 'success';
    }

    if (normalized.includes('pending') || normalized.includes('assigned') || normalized.includes('manager approved')) {
      return 'warning';
    }

    return 'neutral';
  }

  private getEntryIcon(entry: LeaveAuditTrailEntry): string {
    const tone = this.getStatusTone(entry);

    if (tone === 'success') {
      return 'fa-circle-check';
    }

    if (tone === 'danger') {
      return 'fa-circle-xmark';
    }

    if (tone === 'warning') {
      return 'fa-clock';
    }

    const event = this.getNormalizedEvent(entry);
    if (event === 'SUBMITTED') {
      return 'fa-paper-plane';
    }

    if (event === 'PROCESS_STARTED') {
      return 'fa-diagram-project';
    }

    return 'fa-circle-info';
  }

  private humanizeNote(entry: LeaveAuditTrailEntry, actorName: string, statusLabel: string, reason: string): string {
    let note = entry.note?.trim();
    if (!note) {
      return this.getDefaultSummary(entry.event.trim().toUpperCase(), actorName, statusLabel, reason);
    }

    const reasonIndex = note.toLowerCase().lastIndexOf('reason:');
    if (reasonIndex > -1) {
      let preReason = note.substring(0, reasonIndex).trim();
      if (preReason.endsWith('.')) {
        preReason = preReason.substring(0, preReason.length - 1).trim();
      }
      note = preReason;
    }

    const lowerNote = note.toLowerCase();
    const event = this.getNormalizedEvent(entry);

    if (lowerNote.includes('flowable approval process started')) {
      return 'started the approval workflow. The request is now moving through the review steps.';
    }

    if (lowerNote.includes('assigned to approver:')) {
      return `has been assigned to review this leave request.`;
    }

    if (lowerNote.startsWith('leave request submitted by')) {
      return `submitted this leave request for review.`;
    }

    if (lowerNote.startsWith('approved by manager')) {
      return `approved the leave request and it is now waiting for final admin approval.`;
    }

    if (lowerNote.startsWith('manager ') && lowerNote.includes(' approved ')) {
      const match = note.match(/approved (.*)$/i);
      return match ? `approved ${match[1]}` : `approved the request.`;
    }

    if (lowerNote.startsWith('final approval by admin')) {
      return `gave the final approval for this leave request.`;
    }

    if (lowerNote.startsWith('admin final decision:')) {
      const match = note.match(/Admin final decision: (.*)$/i);
      return match ? `made the final decision: ${match[1]}` : `completed the final decision.`;
    }

    if (lowerNote.startsWith('rejected by')) {
      return `rejected this leave request.`;
    }

    if (lowerNote.startsWith('all dates rejected')) {
      return `rejected all requested dates.`;
    }

    return this.toSentenceCase(note);
  }

  private getNormalizedEvent(entry: LeaveAuditTrailEntry): string {
    const event = entry.event.trim().toUpperCase();
    const note = entry.note.toLowerCase();
    const taskId = (entry.taskId || '').trim().toLowerCase();

    if (
      event === 'APPROVED' &&
      (taskId === 'service_set_manager_approved' || note.includes('pending admin final approval'))
    ) {
      return 'MANAGER_APPROVED';
    }

    return event;
  }

  private getDefaultSummary(event: string, actorName: string, statusLabel: string, reason: string): string {
    if (event === 'PENDING_MANAGER') {
      return `is pending to review the leave request.`;
    }

    if (event === 'PENDING_ADMIN') {
      return `is pending to give final approval.`;
    }

    switch (event) {
      case 'SUBMITTED':
        return `submitted this leave request for review.`;
      case 'PROCESS_STARTED':
        return 'started the approval workflow.';
      case 'APPROVER_RESOLVED':
        return `has been assigned to review this request.`;
      case 'MANAGER_APPROVED':
        return `approved the leave request and passed it to the admin stage.`;
      case 'APPROVED':
        return `gave the final approval for this leave request.`;
      case 'REJECTED':
        return `rejected this leave request.`;
      default:
        return `updated the status to ${statusLabel.toLowerCase()}.`;
    }
  }

  private extractReason(entry: LeaveAuditTrailEntry): string {
    const note = entry.note?.trim();
    if (!note) {
      return this.getStatusTone(entry) === 'danger' ? this.leave.rejectionReason || '' : '';
    }

    const reasonMatch = note.match(/reason:\s*(.+)$/i);
    if (reasonMatch?.[1]) {
      return reasonMatch[1].trim();
    }

    return this.getStatusTone(entry) === 'danger' ? this.leave.rejectionReason || '' : '';
  }

  private extractAssignedApprover(note: string): string {
    const match = note.match(/assigned to approver:\s*(.+)$/i);
    return match?.[1]?.trim() || '';
  }

  private findAssignedApprover(trail: LeaveAuditTrailEntry[], stage: 'manager' | 'admin'): string {
    const assignments = trail.filter((entry) => entry.event.trim().toUpperCase() === 'APPROVER_RESOLVED');
    if (!assignments.length) {
      return stage === 'manager' ? 'Manager' : 'Admin';
    }

    const unformattedNames = assignments
      .map((entry) => this.extractAssignedApprover(entry.note) || entry.actor);
    const names = unformattedNames
      .map((name) => this.formatDisplayName(name))
      .filter(Boolean);

    if (!names.length) {
      return stage === 'manager' ? 'Manager' : 'Admin';
    }

    return stage === 'manager' ? names[0] : names[names.length - 1];
  }

  private extractActorFromNote(note: string): string {
    const patterns = [
      /leave request submitted by\s+(.+)$/i,
      /approved by manager\s+(.+?)(?:\.|$)/i,
      /final approval by admin\s+(.+)$/i,
      /rejected by\s+(.+?)(?:\.|$)/i,
      /manager\s+(.+?)\s+approved/i
    ];

    for (const pattern of patterns) {
      const match = note.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    return '';
  }

  private normalizeTrailEntry(entry: unknown): LeaveAuditTrailEntry | null {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const source = entry as Record<string, unknown>;
    return {
      event: this.stringValue(source['event']) || 'UNKNOWN',
      actor: this.stringValue(source['actor']) || 'System',
      timestamp: this.stringValue(source['timestamp']) || '',
      note: this.stringValue(source['note']) || ''
    };
  }

  private stringValue(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private getTimeValue(value: string): number {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
  }

  private formatStatusLabel(value: string | null | undefined): string {
    const normalized = (value || '').trim().toUpperCase();

    if (!normalized) {
      return 'Unknown';
    }

    if (normalized === 'MANAGER_APPROVED') {
      return 'Pending Admin Approval';
    }

    return this.titleCase(normalized.replace(/_/g, ' '));
  }

  private formatDisplayName(value: string | null | undefined): string {
    const normalized = value?.trim();

    if (!normalized) {
      return '';
    }

    const resolvedName = this.leave.userDirectory?.[normalized.toLowerCase()];
    if (resolvedName?.trim()) {
      return resolvedName.trim();
    }

    const cleaned = normalized
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const titleCased = cleaned
      .split(' ')
      .filter((part) => !/^\d+$/.test(part)) 
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');

    return titleCased || normalized;
  }

  private displayNameOrFallback(value: string | null | undefined): string {
    return this.formatDisplayName(value) || '';
  }

  private titleCase(value: string | null | undefined): string {
    if (!value) {
      return 'Unknown';
    }

    return value
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private toSentenceCase(value: string): string {
    if (!value) {
      return '';
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
