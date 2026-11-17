import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { OperationsReportingService } from '../../../../service/operations-reporting.service';

@Component({
  standalone: false,
  selector: 'app-latra',
  templateUrl: './latra.component.html'
})
export class LatraComponent implements OnInit {
  rows: any[] = [];
  summary: any = { total: 0, confirmed: 0, groups: [] };
  statusOptions: string[] = ['failed', 'processing', 'skipped', 'synced'];
  loading = false;
  detailLoading = false;
  retrying = false;
  savingCorrection = false;
  errorMessage = '';
  selected: any = null;
  editableOverrides: any = {};
  filter: any = { from: '', to: '', status: '', type: '', confirmation: '' };
  pagination: any = { page: 1, pageSize: 25, totalItems: 0, totalPages: 1 };

  constructor(private reporting: OperationsReportingService, private cdr: ChangeDetectorRef) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    const params: any = { ...this.filter, page: this.pagination.page, pageSize: this.pagination.pageSize };
    Object.keys(params).forEach(key => { if (!params[key]) delete params[key]; });
    this.errorMessage = '';
    this.reporting.getLatraSubmissions(params).subscribe((res: any) => {
      this.rows = res.items || [];
      this.pagination = res.pagination || this.pagination;
      this.loading = false;
      this.cdr.detectChanges();
    }, (error) => { this.rows = []; this.loading = false; this.errorMessage = error?.error?.msg || 'Unable to load LATRA records. Please sign in again and retry.'; this.cdr.detectChanges(); });
    this.reporting.getLatraSummary().subscribe((res: any) => {
      this.summary = res || this.summary;
      const statuses = (this.summary.groups || []).map(group => group.status).filter(Boolean);
      this.statusOptions = Array.from(new Set([...this.statusOptions, ...statuses])).sort();
      this.cdr.detectChanges();
    });
  }

  applyFilters() { this.pagination.page = 1; this.load(); }
  onPageChange(page: number) { this.pagination.page = page; this.load(); }

  showOnly(confirmation: string) {
    this.filter.confirmation = confirmation;
    this.applyFilters();
  }

  viewRecord(row: any) {
    this.detailLoading = true;
    this.selected = null;
    this.reporting.getLatraSubmission(row.id).subscribe((res: any) => {
      this.selected = res.item || null;
      this.setEditableOverrides();
      this.detailLoading = false;
      this.cdr.detectChanges();
      setTimeout(() => {
        document.getElementById('latra-submission-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }, (error) => { this.detailLoading = false; this.errorMessage = error?.error?.msg || 'Unable to load this record.'; this.cdr.detectChanges(); });
  }

  retrySelected() {
    if (!this.selected || this.retrying) return;
    if (!window.confirm('Resubmit this LATRA record to CeTS using the values shown below? This sends an external request and records the result.')) return;
    this.retrying = true;
    this.errorMessage = '';
    this.reporting.retryLatraSubmission(this.selected.id, this.editableOverrides).subscribe((res: any) => {
      this.selected = res.item || this.selected;
      this.setEditableOverrides();
      this.retrying = false;
      this.load();
      this.cdr.detectChanges();
    }, (error) => {
      this.retrying = false;
      this.errorMessage = error?.error?.msg || 'The retry failed. The submission audit record retains the upstream error.';
      this.load();
      this.cdr.detectChanges();
    });
  }

  saveCorrection(resubmit: boolean = false) {
    if (!this.selected || this.savingCorrection) return;
    this.savingCorrection = true;
    this.errorMessage = '';
    this.reporting.saveLatraCorrection(this.selected.id, this.editableOverrides).subscribe((res: any) => {
      this.selected = res.item || this.selected;
      this.setEditableOverrides();
      this.savingCorrection = false;
      this.load();
      this.cdr.detectChanges();
      if (resubmit) this.retrySelected();
    }, (error) => {
      this.savingCorrection = false;
      this.errorMessage = error?.error?.msg || 'Unable to save the LATRA correction.';
      this.cdr.detectChanges();
    });
  }

  setEditableOverrides() {
    const saved = this.selected?.payloadOverrides || {};
    const payload = this.selected?.requestPayload || {};
    this.editableOverrides = { ...saved };
    (this.selected?.correctionFields || []).forEach((field: string) => {
      if (typeof this.editableOverrides[field] === 'undefined' && typeof payload[field] !== 'undefined') {
        this.editableOverrides[field] = payload[field];
      }
    });
  }

  fieldLabel(field: string) {
    return String(field || '').replace(/([A-Z])/g, ' $1').replace(/^./, value => value.toUpperCase());
  }

  submittedValue(field: string) {
    const value = this.selected?.requestPayload?.[field];
    return value === null || typeof value === 'undefined' || value === '' ? 'Not submitted' : value;
  }

  fieldNeedsAttention(field: string) {
    return (this.selected?.missingFields || []).includes(field);
  }

  exportSelectedCsv() {
    if (!this.selected) return;
    const detail = this.selected;
    const header = ['Report date', 'Sent at', 'Type', 'Status', 'Attempts', 'Confirmation reference', 'Upstream status', 'Error', 'Request payload', 'Response payload'];
    const values = [detail.reportDate, detail.sentAt, detail.submissionType, detail.status, detail.attempts, detail.confirmationReference, detail.upstreamStatus, detail.errorMessage, JSON.stringify(detail.requestPayload || {}), JSON.stringify(detail.responsePayload || {})];
    const csv = [header, values].map(row => row.map(value => '"' + String(value || '').replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'latra-submission-' + detail.id + '.csv'; link.click(); URL.revokeObjectURL(link.href);
  }

  exportCsv() {
    const header = ['Report date', 'Sent at', 'Type', 'Status', 'Attempts', 'Confirmation reference', 'Upstream status', 'Error'];
    const lines = this.rows.map(row => [row.reportDate, row.sentAt, row.submissionType, row.status, row.attempts, row.confirmationReference, row.upstreamStatus, row.errorMessage]
      .map(value => '"' + String(value || '').replace(/"/g, '""') + '"').join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'latra-submissions.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
