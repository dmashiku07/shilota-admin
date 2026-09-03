import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { finalize, take, timeout } from 'rxjs/operators';
import { SubscriptionPlanService } from '../../../../service/subscription-plan.service';

@Component({
  standalone: false,
  selector: 'app-subscription-plan-edit',
  templateUrl: './subscription-plan-edit.component.html'
})
export class SubscriptionPlanEditComponent implements OnInit {
  loading = true;
  planLoaded = false;
  loadError = '';
  saving = false;
  serverErrors: any = {};
  featureCatalog: any[] = [];
  form;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private service: SubscriptionPlanService,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      customer_type: ['DRIVER', Validators.required],
      name: ['', Validators.required],
      description: [''],
      price: [0, [Validators.required, Validators.min(0)]],
      currency: ['TZS', Validators.required],
      duration_unit: ['DAY', Validators.required],
      duration_value: [1, [Validators.required, Validators.min(1)]],
      daily_ride_limit: [3],
      is_unlimited: [false],
      is_active: [true],
      display_order: [0, [Validators.required, Validators.min(0)]],
      features: [[]]
    });
  }

  ngOnInit() {
    this.loadFeatureCatalog();
    this.loadPlan();
  }

  loadPlan() {
    const id = String(this.route.snapshot.params['id'] || '').trim();
    this.loading = true;
    this.planLoaded = false;
    this.loadError = '';

    if (!id) {
      this.loading = false;
      this.loadError = 'No subscription plan was selected.';
      this.cdr.detectChanges();
      return;
    }

    this.service.get(id).pipe(
      take(1),
      timeout(15000),
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      })
    ).subscribe((res: any) => {
      if (res && (res.status === 'true' || res.status === true) && res.data) {
        this.form.patchValue(res.data);
        this.planLoaded = true;
        return;
      }

      this.loadError = res && res.message ? res.message : 'Unable to load subscription plan.';
      this.cdr.detectChanges();
    }, () => {
      this.loadError = 'Unable to load the subscription plan. Check the connection and try again.';
      this.cdr.detectChanges();
    });
  }

  private loadFeatureCatalog() {
    this.service.getFeatureCatalog().pipe(take(1), timeout(15000)).subscribe((res: any) => {
      this.featureCatalog = res && res.status === 'true' && Array.isArray(res.data) ? res.data : [];
      this.cdr.detectChanges();
    }, () => {
      this.featureCatalog = [];
      this.cdr.detectChanges();
    });
  }

  get isPassenger() {
    return this.form.get('customer_type')?.value === 'PASSENGER';
  }

  get pageTitle() {
    return this.isPassenger ? 'Edit Passenger Subscription Plan' : 'Edit Driver Subscription Plan';
  }

  get cancelQueryParams() {
    return { customer_type: this.form.get('customer_type')?.value || 'DRIVER' };
  }

  toggleFeature(featureCode: string, enabled: boolean) {
    const features = this.serializeFeatures();
    const existingIndex = features.findIndex((item: any) => item.feature_code === featureCode);
    if (!enabled) {
      if (existingIndex >= 0) {
        features.splice(existingIndex, 1);
      }
    } else if (existingIndex < 0) {
      features.push({ feature_code: featureCode, feature_value: true });
    } else if (typeof features[existingIndex].feature_value !== 'number') {
      features[existingIndex].feature_value = true;
    }
    this.form.patchValue({ features });
  }

  featureEnabled(featureCode: string) {
    return this.serializeFeatures().some((item: any) => item.feature_code === featureCode);
  }

  setFeatureValue(featureCode: string, value: any) {
    const features = this.serializeFeatures();
    const existingIndex = features.findIndex((item: any) => item.feature_code === featureCode);
    if (existingIndex >= 0) {
      features[existingIndex].feature_value = value === '' ? '' : Number(value);
    } else {
      features.push({ feature_code: featureCode, feature_value: value === '' ? '' : Number(value) });
    }
    this.form.patchValue({ features });
  }

  getFeatureValue(featureCode: string) {
    const feature = this.serializeFeatures().find((item: any) => item.feature_code === featureCode);
    return feature ? feature.feature_value : '';
  }

  save() {
    this.serverErrors = {};
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.service.update(this.route.snapshot.params['id'], this.serializePayload()).subscribe((res: any) => {
      this.saving = false;
      this.cdr.detectChanges();
      if (res && res.status === 'true') {
        this.toastr.success(res.message || 'Plan updated');
        this.router.navigate(['admin/subscription-plans/view'], { queryParams: this.cancelQueryParams });
      } else {
        this.serverErrors = res && res.errors ? res.errors : {};
        this.toastr.error(res && res.message ? res.message : 'Unable to update subscription plan');
      }
    }, () => {
      this.saving = false;
      this.cdr.detectChanges();
      this.toastr.error('Unable to update subscription plan');
    });
  }

  private serializePayload() {
    const value = this.form.getRawValue();
    return {
      ...value,
      daily_ride_limit: value.customer_type === 'PASSENGER' || value.is_unlimited ? null : value.daily_ride_limit,
      features: value.customer_type === 'PASSENGER' ? this.serializeFeatures() : []
    };
  }

  private serializeFeatures() {
    const rawFeatures = this.form.get('features')?.value;
    return Array.isArray(rawFeatures) ? [...rawFeatures] : [];
  }
}
