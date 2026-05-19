import { ChangeDetectorRef, Component, OnInit, ViewContainerRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FaqService } from '../../../../service/faq.service';
import { UntypedFormGroup, UntypedFormBuilder, UntypedFormControl, Validators, FormArray, NgForm, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
;
@Component({
  standalone: false,
selector: 'app-edit',
  templateUrl: './edit.component.html',
  styleUrls: ['./edit.component.css']
})
export class EditComponent implements OnInit {
  faq: any = {};
  Form: UntypedFormGroup;
  isLoading = false;
  constructor(private route: ActivatedRoute,
    private router: Router,
    private service: FaqService, private fb: UntypedFormBuilder,
    public toastr: ToastrService, vcr: ViewContainerRef,
    private cdr: ChangeDetectorRef
  ) {
    this.createForm();
  }

  createForm() {
    this.Form = this.fb.group({
      title: ['', Validators.compose([Validators.required, Validators.minLength(3), Validators.maxLength(30)])],
      content: ['', Validators.required]
    });
  }

  update(faq) {
    if (this.Form.valid) {
      this.isLoading = true;
      this.cdr.detectChanges();
      this.route.params.subscribe(params => {
        this.service.update(faq, params['id']).subscribe(
          data => {
            this.isLoading = false;
            this.cdr.detectChanges();
            if (data['success']) {
              this.toastr.success(data['msg'] || 'Faq Updated Successfully');
              sessionStorage.setItem("SuccessMessage", "Faq Updated Successfully");
              this.getPage();
              window.scrollTo(0, 0);
              this.router.navigate(['/admin/faq/view']);
            }

            if (data['error']) {
              window.scrollTo(0, 0);
              this.toastr.error(data['msg']);

            }
          },
          error => {
            this.isLoading = false;
            this.cdr.detectChanges();
            this.toastr.error('An error occurred', 'Error!');
          }
        );


      });
    } else {
      this.validateAllFormFields(this.Form);
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
  ngOnInit() {
    this.route.params.subscribe(params => {
      this.service.editadminfaq(params['id']).subscribe(res => {
        this.faq = res || {};
        this.Form.patchValue({
          title: this.faq.title || '',
          content: this.faq.content || ''
        });
      });
    });
  }

  getPage() {
    this.service.getContent().subscribe(res => {
      this.faq = res;
      if (this.faq.length == 0) {
        this.router.navigate(['admin/faq/add']);
      }
    });
  }
}
