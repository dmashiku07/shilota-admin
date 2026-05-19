import { Component, OnInit, ElementRef, ViewChild, ViewContainerRef, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BannerService} from '../../../../service/banner.service';
import { UntypedFormGroup,  UntypedFormBuilder,  Validators, FormArray, NgForm,FormsModule, ReactiveFormsModule} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../../environments/environment';

@Component({
  standalone: false,
selector: 'app-edit',
  templateUrl: './edit.component.html',
  styleUrls: ['./edit.component.css']
})
export class EditComponent implements OnInit {
  /* @ViewChild('image') image; */
  page: any = {};
  Form: UntypedFormGroup;
  banners:any;
  url:any;
  isLoading = false;
  constructor(private route: ActivatedRoute,
    private router: Router,
    private service: BannerService,
    private fb: UntypedFormBuilder,
    private elem: ElementRef,
    public toastr: ToastrService,
    vcr: ViewContainerRef,
    private cdr: ChangeDetectorRef) 
    {  this.createForm();
      
     }

    createForm(){
      this.Form = this.fb.group({
        title: ['', Validators.compose([Validators.required,Validators.minLength(3), Validators.maxLength(60)])],
        image: ['']
   });
  
   }
  ngOnInit() {
    this.url=environment.apiUrl;
    this.route.params.subscribe(params => {
      this.service.editPage(params['id']).subscribe(res => {
        this.page = res || {};
        this.Form.patchValue({
          title: this.page.title || ''
        });
      });
    });
  }


  updateBanner(Form) {
    this.isLoading = true;
    this.cdr.detectChanges();
    this.route.params.subscribe(params => {
       let files = this.elem.nativeElement.querySelector('#image').files;
        if (files && files.length > 0) {

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
                 if(data["success"]) {
                   this.toastr.success(data["msg"]);
                   sessionStorage.setItem("SuccessMessage", data["msg"]);
                  this.getContent();
                  this.router.navigate(['admin/banner/view']);
                 }

                 if(data["error"]) {
                   this.toastr.error(data["msg"], 'Error!');

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
              this.router.navigate(['admin/banner/view']);
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

     }
   });
  }


  getContent() {
    this.service.getContent().subscribe(res => {
      this.banners = res;
      if(this.banners.length==0){
        this.router.navigate(['admin/banner/add']);
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
