import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { SubscriptionPlanService } from '../../../../service/subscription-plan.service';
import { SubscriptionService } from '../../../../service/subscription.service';
import { DriverService } from '../../../../service/driver.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  standalone: false,
  selector: 'app-driver-subscription-view',
  templateUrl: './driver-subscription-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DriverSubscriptionViewComponent implements OnInit {
  isPassenger = false;
  loading = false;
  plans: any[] = [];
  subscriptions: any[] = [];
  pagination: any = null;
  showGrantForm = false;
  granting = false;
  searchingDrivers = false;
  driverSearch = '';
  driverResults: any[] = [];
  grant: any = {
    driver_id: '',
    plan_id: '',
    starts_at: '',
    expires_at: '',
    reason: '',
    acknowledge: false
  };
  filters: any = {
    driver: '',
    passenger: '',
    plan_id: '',
    status: '',
    payment_status: '',
    expiry_date: '',
    reached_limit: ''
  };

  constructor(
    private subscriptionService: SubscriptionService,
    private subscriptionPlanService: SubscriptionPlanService,
    private driverService: DriverService,
    private route: ActivatedRoute,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.route.queryParamMap.subscribe((params) => {
      this.isPassenger = String(params.get('customer_type') || 'DRIVER').toUpperCase() === 'PASSENGER';
      this.resetFilterValues();
      this.loadPlans();
      this.loadSubscriptions();
    });
  }

  loadPlans() {
    this.subscriptionPlanService.list(this.isPassenger ? 'PASSENGER' : 'DRIVER').subscribe((res: any) => {
      this.plans = res && res.status === 'true' && Array.isArray(res.data) ? res.data : [];
      this.cdr.markForCheck();
    });
  }

  loadSubscriptions(page: number = 1) {
    this.loading = true;
    const params: any = {
      page,
      customer_type: this.isPassenger ? 'PASSENGER' : 'DRIVER'
    };
    Object.keys(this.filters).forEach((key) => {
      if (this.filters[key]) {
        params[key] = this.filters[key];
      }
    });

    this.subscriptionService.getPage(params).subscribe((res: any) => {
      this.loading = false;
      this.subscriptions = res && Array.isArray(res.items) ? res.items : [];
      this.pagination = res && res.pagination ? res.pagination : null;
      this.cdr.markForCheck();
    }, () => {
      this.loading = false;
      this.toastr.error(`Unable to load ${this.isPassenger ? 'passenger' : 'driver'} subscriptions`);
      this.cdr.markForCheck();
    });
  }

  resetFilters() {
    this.resetFilterValues();
    this.loadSubscriptions();
  }

  private resetFilterValues() {
    this.filters = {
      driver: '',
      passenger: '',
      plan_id: '',
      status: '',
      payment_status: '',
      expiry_date: '',
      reached_limit: ''
    };
  }

  openGrantForm() {
    const today = new Date();
    this.grant = {
      driver_id: '',
      plan_id: '',
      starts_at: this.toDateInput(today),
      expires_at: '',
      reason: '',
      acknowledge: false
    };
    this.driverSearch = '';
    this.driverResults = [];
    this.showGrantForm = true;
    this.cdr.markForCheck();
  }

  closeGrantForm() {
    if (!this.granting) {
      this.showGrantForm = false;
      this.cdr.markForCheck();
    }
  }

  searchDrivers() {
    const search = this.driverSearch.trim();
    if (search.length < 2) {
      this.toastr.warning('Enter at least 2 characters to search for a driver');
      return;
    }
    this.searchingDrivers = true;
    this.driverService.getPage({ search, page: 1, pageSize: 10 }).subscribe((res: any) => {
      this.searchingDrivers = false;
      this.driverResults = res && Array.isArray(res.items) ? res.items : [];
      if (this.driverResults.length === 0) {
        this.toastr.info('No drivers matched your search');
      }
      this.cdr.markForCheck();
    }, () => {
      this.searchingDrivers = false;
      this.toastr.error('Unable to search drivers');
      this.cdr.markForCheck();
    });
  }

  submitGrant() {
    if (!this.grant.driver_id || !this.grant.plan_id || !this.grant.starts_at || this.grant.reason.trim().length < 5) {
      this.toastr.error('Select a driver and plan, then provide the start date and a clear reason');
      return;
    }
    if (!this.grant.acknowledge) {
      this.toastr.error('Confirm that this grant does not represent a payment');
      return;
    }
    this.granting = true;
    const payload = {
      driver_id: this.grant.driver_id,
      plan_id: this.grant.plan_id,
      starts_at: new Date(this.grant.starts_at + 'T00:00:00').toISOString(),
      expires_at: this.grant.expires_at ? new Date(this.grant.expires_at + 'T23:59:59').toISOString() : null,
      reason: this.grant.reason.trim()
    };
    this.subscriptionService.grant(payload).subscribe((res: any) => {
      this.granting = false;
      if (res && res.status === 'true') {
        this.toastr.success(res.message || 'Subscription granted');
        this.showGrantForm = false;
        this.loadSubscriptions();
      } else {
        this.toastr.error(res && res.message ? res.message : 'Unable to grant subscription');
      }
      this.cdr.markForCheck();
    }, (error: any) => {
      this.granting = false;
      this.toastr.error(error && error.error && error.error.message ? error.error.message : 'Unable to grant subscription');
      this.cdr.markForCheck();
    });
  }

  revoke(subscription: any) {
    const reason = window.prompt('Reason for revoking this UAT grant:');
    if (!reason) {
      return;
    }
    if (reason.trim().length < 5) {
      this.toastr.error('Provide a revoke reason of at least 5 characters');
      return;
    }
    this.subscriptionService.revoke(subscription._id, reason.trim()).subscribe((res: any) => {
      if (res && res.status === 'true') {
        this.toastr.success(res.message || 'Grant revoked');
        this.loadSubscriptions();
      } else {
        this.toastr.error(res && res.message ? res.message : 'Unable to revoke grant');
      }
    }, (error: any) => {
      this.toastr.error(error && error.error && error.error.message ? error.error.message : 'Unable to revoke grant');
    });
  }

  private toDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
