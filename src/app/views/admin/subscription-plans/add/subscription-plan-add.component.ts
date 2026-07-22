import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { SubscriptionPlanService } from '../../../../service/subscription-plan.service';

@Component({
  standalone: false,
  selector: 'app-subscription-plan-add',
  templateUrl: './subscription-plan-add.component.html'
})
export class SubscriptionPlanAddComponent {
  saving = false;
  serverErrors: any = {};
  featureCatalog: any[] = [];
  form;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private service: SubscriptionPlanService,
    private router: Router,
    private toastr: ToastrService
  ) {
    const customerType = (this.route.snapshot.queryParamMap.get('customer_type') || 'DRIVER').toUpperCase();
    this.form = this.fb.group({
      customer_type: [customerType, Validators.required],
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

    this.service.getFeatureCatalog().subscribe((res: any) => {
      this.featureCatalog = res && res.status === 'true' && Array.isArray(res.data) ? res.data : [];
    });
  }

  get isPassenger() {
    return this.form.get('customer_type')?.value === 'PASSENGER';
  }

  get pageTitle() {
    return this.isPassenger ? 'Create Passenger Subscription Plan' : 'Create Driver Subscription Plan';
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

    const payload = this.serializePayload();
    this.saving = true;
    this.service.create(payload).subscribe((res: any) => {
      this.saving = false;
      if (res && res.status === 'true') {
        this.toastr.success(res.message || 'Plan created');
        this.router.navigate(['admin/subscription-plans/view'], {
          queryParams: this.cancelQueryParams
        });
      } else {
        this.serverErrors = res && res.errors ? res.errors : {};
        this.toastr.error(res && res.message ? res.message : 'Unable to create subscription plan');
      }
    }, () => {
      this.saving = false;
      this.toastr.error('Unable to create subscription plan');
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
