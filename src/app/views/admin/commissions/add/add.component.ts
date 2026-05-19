import { Component, OnInit,ViewContainerRef } from '@angular/core';
import { UntypedFormGroup,  UntypedFormBuilder, UntypedFormControl, Validators, FormArray, NgForm,FormsModule, ReactiveFormsModule} from '@angular/forms';
import { CommissionsService } from '../../../../service/commissions.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
@Component({
  standalone: false,
selector: 'app-add',
  templateUrl: './add.component.html',
  styleUrls: ['./add.component.css']
})
export class AddComponent implements OnInit {
  Form:UntypedFormGroup;
  constructor(private service:CommissionsService,
    private http: HttpClient,
    private fb:UntypedFormBuilder,
    private router: Router,
    public toastr: ToastrService, vcr: ViewContainerRef,
   ) {   }

  ngOnInit() {
    this.createForm();
  }

  createForm(){
    this.Form = this.fb.group({
      price_from: ['', Validators.required],
      price_to:['', Validators.required],
      percentage:['',Validators.required],
 });
  
}


add(Form){
  if (this.Form.valid) {
    this.service.add(Form).subscribe(data=>{ 
      if(data['success']) {
      sessionStorage.setItem("SuccessMessage", data['msg']);  
       this.router.navigate(['admin/commissions/view']);
       
    }
     if(data['error']) {
    this.toastr.error(data['msg']); 
    
    }
  }
   
  );
  }
  else
  {
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
