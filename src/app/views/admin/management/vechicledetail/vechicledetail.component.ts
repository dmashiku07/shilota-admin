import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { finalize } from 'rxjs/operators';

import { VehicleService } from '../../../../service/vehicle.service';
import { environment } from '../../../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-vechicledetail',
  templateUrl: './vechicledetail.component.html',
  styleUrls: ['./vechicledetail.component.css']
})
export class VechicledetailComponent implements OnInit {
  vehicle: any;
  details: any = {
    user_id: {},
    amenities: []
  };
  options: any[] = [];
  currenttime = 0;
  inspectiontime = 0;
  Form: UntypedFormGroup;
  url = environment.apiUrl;
  loading = true;
  isLoading = false;

  constructor(
    private service: VehicleService,
    private fb: UntypedFormBuilder,
    private router: Router,
    public toastr: ToastrService,
    private route: ActivatedRoute,
    private location: Location,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.createForm();

      this.service.getCategory().subscribe(res => {
        this.options = Array.isArray(res) ? res : [];
        this.cdr.detectChanges();
    });

    this.route.params.subscribe(params => {
      this.loading = true;
      this.vehicle = this.service.edit(params['id']).subscribe(
        res => {
          const details: any = res || {};
          const user = details.user_id || {};
          const amenities = Array.isArray(details.amenities) ? details.amenities : [];
          this.details = {
            ...details,
            user_id: user,
            amenities
          };

          const inspectionDate = user.inspectionon ? new Date(user.inspectionon) : null;
          this.currenttime = Math.floor(Date.now() / 1000);
          this.inspectiontime = inspectionDate ? Math.floor(inspectionDate.getTime() / 1000) : 0;

          this.Form.patchValue({
            category: this.details.category || '',
            status: this.details.status ?? '',
            user_id: user._id || '',
            datepicker: user.inspectionon || ''
          });

          this.loading = false;
          this.cdr.detectChanges();
        },
        () => {
          this.details = { user_id: {}, amenities: [] };
          this.loading = false;
          this.cdr.detectChanges();
        }
      );
    });
  }

  createForm() {
    this.Form = this.fb.group({
      category: ['', Validators.required],
      status: ['', Validators.required],
      user_id: [''],
      datepicker: ['']
    });
  }

  update(form: any) {
    if (this.Form.valid) {
      this.isLoading = true;
      this.cdr.detectChanges();
      const vehicleId = this.route.snapshot.paramMap.get('id');

      this.service.update(form, vehicleId).pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      ).subscribe(
          data => {
            if (data['success']) {
              this.toastr.success(data['msg'] || 'Vehicle status updated successfully', 'Saved');
              window.scrollTo(0, 0);
            } else {
              this.toastr.error(data['msg'] || 'The vehicle status could not be updated', 'Save failed');
              window.scrollTo(0, 0);
            }
          },
          error => {
            const message = error?.error?.msg || 'The vehicle status could not be updated. Please try again.';
            this.toastr.error(message, 'Save failed');
            window.scrollTo(0, 0);
          }
        );
    } else {
      this.validateAllFormFields(this.Form);
      this.toastr.error('Please complete the required fields before saving.', 'Save failed');
    }
  }

  validateAllFormFields(formGroup: UntypedFormGroup) {
    Object.keys(formGroup.controls).forEach(field => {
      const control = formGroup.get(field);
      if (control instanceof UntypedFormControl) {
        control.markAsTouched({ onlySelf: true });
      } else if (control instanceof UntypedFormGroup) {
        this.validateAllFormFields(control);
      }
    });
  }

  goBack() {
    this.location.back();
  }
}
