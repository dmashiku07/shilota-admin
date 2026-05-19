import { ChangeDetectorRef, Component, OnInit,ViewContainerRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommissionsService } from '../../../../service/commissions.service';
import { UntypedFormGroup,  UntypedFormBuilder,UntypedFormControl, Validators, FormArray, NgForm,FormsModule, ReactiveFormsModule} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
@Component({
  standalone: false,
selector: 'app-edit',
  templateUrl: './edit.component.html',
  styleUrls: ['./edit.component.css']
})
export class EditComponent implements OnInit {
  tax: any = {};
  Form: UntypedFormGroup;
  isLoading = false;
  constructor(private route: ActivatedRoute,
    private router: Router,
    private service: CommissionsService, private fb: UntypedFormBuilder,
    public toastr: ToastrService, vcr: ViewContainerRef,
    private cdr: ChangeDetectorRef) 
    {    
      this.createForm(); }

  ngOnInit() {
      this.route.params.subscribe(params => {
      this.service.edit(params['id']).subscribe(res => {
        this.tax = res || {};
        this.Form.patchValue({
          price_from: this.tax.price_from || '',
          price_to: this.tax.price_to || '',
          percentage: this.tax.percentage || ''
        });
      });
    });
  }
 
  createForm() {
    this.Form = this.fb.group({
      price_from: ['', Validators.required],
      price_to:['', Validators.required],
      percentage:['',Validators.required],
   });
  }

  update(page) {
    if (this.Form.valid) {
      this.isLoading = true;
      this.cdr.detectChanges();

    this.route.params.subscribe(params => {
    this.service.update(page, params['id']).subscribe(
      data => {
        this.isLoading = false;
        this.cdr.detectChanges();
        if(data['success']) {
         this.toastr.success(data['msg']);
         sessionStorage.setItem("SuccessMessage", data['msg']);
        // this.getPage();
          this.router.navigate(['admin/commissions/view']);
         }
        if(data['error']) {
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
}
