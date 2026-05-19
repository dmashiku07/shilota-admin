import { Component, OnInit, ElementRef, ViewContainerRef } from '@angular/core';
import { UntypedFormGroup,  UntypedFormBuilder, UntypedFormControl, Validators, FormArray, NgForm,FormsModule, ReactiveFormsModule} from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BannerService} from '../../../../service/banner.service';
import { Observable } from 'rxjs';
import { FileValidator} from '../../../../provider/file-input.validator'
import { ToastrService } from 'ngx-toastr';

@Component({
  standalone: false,
selector: 'app-add',
  templateUrl: './add.component.html',
  styleUrls: ['./add.component.css']
})
export class AddComponent implements OnInit {
  Form:UntypedFormGroup;
  image:File;
  banners:any;
   constructor(private fileUploader: BannerService,
    private fb:UntypedFormBuilder,
    private elem: ElementRef,
    private router: Router,
    public toastr: ToastrService, vcr: ViewContainerRef
 
  ) {        }

  ngOnInit() {
    this.createForm();
  }

  createForm(){
    this.Form = this.fb.group({
      title: ['', Validators.compose([Validators.required,Validators.minLength(3), Validators.maxLength(60)])],
      type: ['', Validators.required ],
      image: ['',FileValidator.validate],
 });
  
}

getContent() {
  this.fileUploader.getContent().subscribe(res => {
    this.banners = res;
    if(this.banners.length==0){
      this.router.navigate(['admin/banner/add']);
     }
  });
}

addBanner(form)
{ 

  if (this.Form.valid) {
 let files = this.elem.nativeElement.querySelector('#image').files;

 if (!this.validateFile(files[0].name)) {
  this.toastr.error('Support File Format - png,jpeg,jpg ');  
 
} else { 
    let formData = new FormData();
    let file = files[0];
      formData.append('image', file, file.name);
       formData.append('title',  form.title);
       formData.append('type',  form.type);
      this.fileUploader.addBanner(formData).subscribe(
         data=>{ 
          if(data["success"]) {
            sessionStorage.setItem("SuccessMessage",data["msg"]);  
           this.getContent();
           this.router.navigate(['admin/banner/view']);
           window.scrollTo(0, 0);
          }
        
        if(data["error"]) {
          window.scrollTo(0, 0);
          this.toastr.error(data["msg"]);  
           
          }
        }
      );
   
    }
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

validateFile(name: String) {
  var ext = name.substring(name.lastIndexOf('.') + 1);
  if (ext.toLowerCase() == 'png') {
      return true;
  }
  else if (ext.toLowerCase() == 'jpeg'){
    return true;
  } else if (ext.toLowerCase() == 'jpg'){
    return true;
  } else {
      return false;
  }
}



}
