import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { SubscriptionPlanService } from '../../../../service/subscription-plan.service';

@Component({
  standalone: false,
  selector: 'app-subscription-plan-view',
  templateUrl: './subscription-plan-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubscriptionPlanViewComponent implements OnInit {
  loading = false;
  plans: any[] = [];
  customerType = 'DRIVER';

  constructor(
    private route: ActivatedRoute,
    private service: SubscriptionPlanService,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.route.queryParamMap.subscribe((params) => {
      this.customerType = (params.get('customer_type') || 'DRIVER').toUpperCase();
      this.load();
    });
  }

  get isPassenger() {
    return this.customerType === 'PASSENGER';
  }

  get pageTitle() {
    return this.isPassenger ? 'Passenger Subscription Plans' : 'Driver Subscription Plans';
  }

  get addLink() {
    return ['/admin/subscription-plans/add'];
  }

  get queryParams() {
    return { customer_type: this.customerType };
  }

  get emptyStateLabel() {
    return this.isPassenger ? 'No passenger subscription plans found' : 'No driver subscription plans found';
  }

  get loadingLabel() {
    return this.isPassenger ? 'Loading passenger subscription plans...' : 'Loading driver subscription plans...';
  }

  load() {
    this.loading = true;
    this.service.list(this.customerType).subscribe((res: any) => {
      this.loading = false;
      this.plans = res && res.status === 'true' && Array.isArray(res.data) ? res.data : [];
      this.cdr.markForCheck();
    }, () => {
      this.loading = false;
      this.toastr.error(this.isPassenger ? 'Unable to load passenger subscription plans' : 'Unable to load driver subscription plans');
      this.cdr.markForCheck();
    });
  }

  activate(plan: any) {
    this.service.activate(plan._id).subscribe((res: any) => {
      if (res && res.status === 'true') {
        plan.is_active = true;
        this.toastr.success(res.message || 'Plan activated');
        this.cdr.markForCheck();
      } else {
        this.toastr.error(res && res.message ? res.message : 'Unable to activate plan');
      }
    }, () => this.toastr.error('Unable to activate plan'));
  }

  deactivate(plan: any) {
    if (!window.confirm('Deactivate this plan? Drivers will no longer see it in the active plan list.')) {
      return;
    }
    this.service.deactivate(plan._id).subscribe((res: any) => {
      if (res && res.status === 'true') {
        plan.is_active = false;
        this.toastr.success(res.message || 'Plan deactivated');
        this.cdr.markForCheck();
      } else {
        this.toastr.error(res && res.message ? res.message : 'Unable to deactivate plan');
      }
    }, () => this.toastr.error('Unable to deactivate plan'));
  }

  moveUp(index: number) {
    if (index <= 0) {
      return;
    }
    this.swapAndPersist(index, index - 1);
  }

  moveDown(index: number) {
    if (index >= this.plans.length - 1) {
      return;
    }
    this.swapAndPersist(index, index + 1);
  }

  bundleRidesLabel(plan: any) {
    return plan.is_unlimited ? 'Unlimited' : (plan.daily_ride_limit || '-') + ' rides';
  }

  featureSummary(plan: any) {
    const features = Array.isArray(plan?.features) ? plan.features : [];
    if (!features.length) {
      return 'No premium features configured';
    }
    return features.map((feature: any) => {
      const value = feature?.feature_value;
      return typeof value === 'boolean'
        ? feature.feature_code
        : feature.feature_code + ': ' + value;
    }).join(', ');
  }

  validityLabel(plan: any) {
    return plan.validity_label || '';
  }

  private swapAndPersist(sourceIndex: number, targetIndex: number) {
    const reordered = [...this.plans];
    const temp = reordered[sourceIndex];
    reordered[sourceIndex] = reordered[targetIndex];
    reordered[targetIndex] = temp;
    const orderedIds = reordered.map(plan => plan._id);

    this.service.reorder(this.customerType, orderedIds).subscribe((res: any) => {
      if (res && res.status === 'true' && Array.isArray(res.data)) {
        this.plans = res.data;
        this.toastr.success('Plan order updated');
      } else {
        this.toastr.error('Unable to update plan order');
      }
      this.cdr.markForCheck();
    }, () => this.toastr.error('Unable to update plan order'));
  }
}
