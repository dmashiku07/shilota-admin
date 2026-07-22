import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { SubscriptionPlanService } from '../../../../service/subscription-plan.service';
import { SubscriptionService } from '../../../../service/subscription.service';

@Component({
  standalone: false,
  selector: 'app-driver-subscription-view',
  templateUrl: './driver-subscription-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DriverSubscriptionViewComponent implements OnInit {
  loading = false;
  plans: any[] = [];
  subscriptions: any[] = [];
  pagination: any = null;
  filters: any = {
    driver: '',
    plan_id: '',
    status: '',
    payment_status: '',
    expiry_date: '',
    reached_limit: ''
  };

  constructor(
    private subscriptionService: SubscriptionService,
    private subscriptionPlanService: SubscriptionPlanService,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadPlans();
    this.loadSubscriptions();
  }

  loadPlans() {
    this.subscriptionPlanService.list('DRIVER').subscribe((res: any) => {
      this.plans = res && res.status === 'true' && Array.isArray(res.data) ? res.data : [];
      this.cdr.markForCheck();
    });
  }

  loadSubscriptions(page: number = 1) {
    this.loading = true;
    const params: any = { page };
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
      this.toastr.error('Unable to load driver subscriptions');
      this.cdr.markForCheck();
    });
  }

  resetFilters() {
    this.filters = {
      driver: '',
      plan_id: '',
      status: '',
      payment_status: '',
      expiry_date: '',
      reached_limit: ''
    };
    this.loadSubscriptions();
  }
}
