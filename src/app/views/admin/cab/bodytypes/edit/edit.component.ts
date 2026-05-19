import { Component, OnInit, ViewContainerRef, ChangeDetectorRef, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BodytypeService } from '../../../../../service/bodytype.service';
import { UntypedFormGroup,  UntypedFormBuilder,UntypedFormControl,  Validators, FormArray, NgForm,FormsModule, ReactiveFormsModule} from '@angular/forms';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';

@Component({
  standalone: false,
selector: 'app-edit',
  templateUrl: './edit.component.html',
  styleUrls: ['./edit.component.css']
})
export class EditComponent implements OnInit {
  bodytype: any = {};
  Form:UntypedFormGroup;
  bodytypes:any;
  isLoading = false;
  constructor(private route: ActivatedRoute,
    private router: Router,
    private service: BodytypeService,
    private fb: UntypedFormBuilder,
    public toastr: ToastrService,
    vcr: ViewContainerRef,
    private cdr: ChangeDetectorRef,
    private zone: NgZone)

    { this.createForm();
        }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.service.edit(params['id']).subscribe(res => {
        this.bodytype = res || {};
        this.Form.patchValue({
          name: this.bodytype.name || ''
        });
      });
    });
  }

  createForm() {
    this.Form = this.fb.group({
      name: ['', Validators.compose([Validators.required,Validators.minLength(3), Validators.maxLength(30)])],
     
   });
  }
  getPage() {
    this.service.getContent().subscribe(res => {
      this.bodytypes = res;
      if(this.bodytypes.length==0){
        this.router.navigate(['admin/bodytype/add']);
       }
    });
  }
  update(page) {
    if (this.Form.valid) {
      this.isLoading = true;
      this.cdr.detectChanges();

    this.route.params.subscribe(params => {
    this.zone.run(() => {
      this.service.update(page, params['id']).subscribe(
        data => {
          this.isLoading = false;
          this.cdr.detectChanges();
          if(data['success']) {
           this.toastr.success(data['msg']);
           sessionStorage.setItem("SuccessMessage", data['msg']);
           this.getPage();
            this.router.navigate(['admin/bodytype/view']);
            window.scrollTo(0, 0);

           }
          if(data['error']) {
            this.toastr.error(data['msg']);
            window.scrollTo(0, 0);

          }
        },
        error => {
          this.isLoading = false;
          this.cdr.detectChanges();
          this.toastr.error('An error occurred', 'Error!');
        }
      );
    });

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
