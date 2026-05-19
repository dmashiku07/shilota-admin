import { Component, OnInit, ElementRef,ViewChild,ViewContainerRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HomeService} from '../../../../service/home.service';
import { UntypedFormGroup,  UntypedFormBuilder,  Validators, FormArray, NgForm,FormsModule, ReactiveFormsModule} from '@angular/forms';
import {Location} from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import {FileValidator} from '../../../../provider/file-input.validator'
import { environment } from '../../../../../environments/environment';

@Component({
  standalone: false,
selector: 'app-update',
  templateUrl: './update.component.html',
  styleUrls: ['./update.component.css']
})
export class UpdateComponent implements OnInit {
  @ViewChild('image') image;
  page: any = {};
  Form: UntypedFormGroup;
  url:any;
  constructor(private route: ActivatedRoute,
    private router: Router,
    private service: HomeService,
    private fb: UntypedFormBuilder,
    public toastr: ToastrService, vcr: ViewContainerRef,
    private elem: ElementRef,private _location: Location) 
    { 
       this.createForm(); }

  createForm(){
    this.Form = this.fb.group({
      title: ['', Validators.compose([Validators.required,Validators.minLength(3), Validators.maxLength(30)])],
      content:['', Validators.required],
      image: [''],
 });

 }

 ngOnInit() {
  this.url=environment.apiUrl;
  this.route.params.subscribe(params => {
    this.service.editPage(params['id']).subscribe(res => {
      this.page = res || {};
      this.Form.patchValue({
        title: this.page.title || '',
        content: this.page.content || ''
      });
    });
  });
}




updatePageImage(Form) {
  this.route.params.subscribe(params => {
     let files = this.elem.nativeElement.querySelector('#image').files;
    
     if (files && files.length > 0) {
    if (!this.validateFile(files[0].name)) {
      this.toastr.error('Support File Format - png,jpeg,jpg ');  
     
    } else { 
        let formData = new FormData();
          let file = files[0];
          formData.append('image', file, file.name);
          formData.append('title',  Form.title);
          formData.append('content',  Form.content);
         this.service.updatePageImage(formData,params['id']).subscribe(
          data=>{ 
            if(data['success']) {
              sessionStorage.setItem("SuccessMessage", data['msg']);
            // this.getContent();
            window.scrollTo(0, 0);
             this.router.navigate(['admin/home/driver']);
            }
          
          if(data['error']) {
            this.toastr.error(data['msg']);  
             
            }
          })
         
        
  }
}
  else
  {
    this.service.updatePage(Form, params['id']).subscribe(data=>{ 
      if(data['success']) {
        sessionStorage.setItem("SuccessMessage", data['msg']);
     //  this.getContent();
     window.scrollTo(0, 0);
     this.router.navigate(['/admin/home/driver']);
      }
    
    if(data['error']) {
      this.toastr.error(data['msg'], 'Error!');  
       
      }
    });

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
