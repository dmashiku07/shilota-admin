import { ChangeDetectorRef, Component, OnInit, ElementRef,ViewChild,ViewContainerRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HomeService} from '../../../../service/home.service';
import { UntypedFormGroup,  UntypedFormBuilder,  Validators, FormArray, NgForm,FormsModule, ReactiveFormsModule} from '@angular/forms';
import {Location} from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import {FileValidator} from '../../../../provider/file-input.validator'
import { environment } from '../../../../../environments/environment';

@Component({
  standalone: false,
selector: 'app-edit',
  templateUrl: './edit.component.html',
  styleUrls: ['./edit.component.css']
})
export class EditComponent implements OnInit {
  @ViewChild('image') image;
  page: any = {};
  Form: UntypedFormGroup;
  pages:any;
  url:any;
  isLoading = false;
  constructor(private route: ActivatedRoute,
    private router: Router,
    private service: HomeService,
    private fb: UntypedFormBuilder,
    public toastr: ToastrService, vcr: ViewContainerRef,
    private elem: ElementRef,private _location: Location,
    private cdr: ChangeDetectorRef) 
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


getContent() {
  this.service.getContent().subscribe(res => {
    this.pages = res;
    if(this.pages.length==0){
      this.router.navigate(['admin/home/add']);
     }
  });
}


updatePageImage(Form) {
  this.isLoading = true;
  this.cdr.detectChanges();
  this.route.params.subscribe(params => {
     let files = this.elem.nativeElement.querySelector('#image').files;

  if (files && files[0]) {
    if (!this.validateFile(files[0].name)) {
      this.toastr.error('Support File Format - png,jpeg,jpg ');
      this.isLoading = false;
      this.cdr.detectChanges();

    } else {
        let formData = new FormData();
          let file = files[0];
          formData.append('image', file, file.name);
          formData.append('title',  Form.title);
          formData.append('content',  Form.content);
         this.service.updatePageImage(formData,params['id']).subscribe(
          data => {
            this.isLoading = false;
            this.cdr.detectChanges();
            if(data['success']) {
              this.toastr.success(data['msg']);
              sessionStorage.setItem("SuccessMessage", data['msg']);
              this.getContent();
              window.scrollTo(0, 0);
             this.router.navigate(['admin/home/view']);
               }
              if(data['error']) {
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


  }

}
  else
  {
    this.service.updatePage(Form, params['id']).subscribe(
      data => {
        this.isLoading = false;
        this.cdr.detectChanges();
        if(data['success']) {
          this.toastr.success(data['msg']);
          sessionStorage.setItem("SuccessMessage", data['msg']);
          this.getContent();
          window.scrollTo(0, 0);
         this.router.navigate(['admin/home/view']);
           }
          if(data['error']) {
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
