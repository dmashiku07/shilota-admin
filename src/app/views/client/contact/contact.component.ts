import { Component, OnInit, ViewContainerRef } from '@angular/core';
import { PageService } from '.././../../service/page.service';
import { UntypedFormGroup, UntypedFormBuilder, UntypedFormControl, Validators, FormArray, NgForm, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AuthenticationService } from '.././../../service/authentication.service';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { FaqService } from '.././../../service/faq.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
@Component({
  standalone: false,
selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css']
})
export class ContactComponent implements OnInit {
  pages: any;
  result:any;
  userForm: UntypedFormGroup;
  users: any;
  count: any;
  faqCount: any;
  isCollapsed = true;
  constructor(private pageservice: PageService,
    private authService: AuthenticationService,
    private fb: UntypedFormBuilder,
    private route: ActivatedRoute,
    private translate: TranslateService,
    public toastr: ToastrService, vcr: ViewContainerRef,
    private faq: FaqService,
    private router: Router, private http: HttpClient, ) {
    window.scrollTo(0, 0);
    this.createForm();
  }
  ngOnInit() {
    this.pageservice.getUserPage().subscribe(res => {
      this.pages = res;
    });
    this.authService.getUserinfo().subscribe(res => {
      this.users = res;
    });
    this.pageservice.getuserHelpCount().subscribe(res => {
      this.count = res;
    });
    this.faq.getCount().subscribe(res => {
      this.faqCount = res;
    });
  }
  sendMail(form) {
    if (this.userForm.valid) {
      this.authService.sendMail(form).subscribe(data => {
        this.result=data;
        if (this.result.success) {
          this.toastr.success(this.result.msg, this.translate.instant("Success!"));
          this.userForm.reset();
          window.scrollTo(0, 0);
        }
        if (this.result.error) {
          this.toastr.error(this.result.msg, this.translate.instant("Error!"));
          window.scrollTo(0, 0);
        }
      });
    }
    else {
      this.validateAllFormFields(this.userForm);
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
  createForm() {
    this.userForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', Validators.compose([Validators.required, Validators.email])],
      subject: ['', Validators.required],
      message: ['', Validators.required],
    });
  }

  hyphenateUrlParams(str: string) {
    let urlParams = str.split(' ').join('-');
    return urlParams.replace(/[^a-zA-Z0-9-]/g, '');
  }

charOnly(event): boolean {
   
    const charCode = event.which ? event.which : event.keyCode;

    if (
      charCode > 32 &&
      (charCode < 65 || charCode > 90) &&
      (charCode < 97 || charCode > 122 )
    ) {
      var hebrewAlphabetDigits =  /^[א-ת\s]+$/;
      var arabicAlphabetDigits = /[\u0600-\u06ff]|[\u0750-\u077f]|[\ufb50-\ufc3f]|[\ufe70-\ufefc]|[\u0200]|[\u00A0]/g;
      var key = String.fromCharCode(event.which);
      if (event.keyCode == 8 || event.keyCode == 37 || event.keyCode == 39 || arabicAlphabetDigits.test(key) || hebrewAlphabetDigits.test(key)) {
        return true;
      }
      
      return false;
    }
    return true;
  }
}


