import { Component, OnInit, ElementRef } from "@angular/core";
import { environment } from ".././../../../environments/environment";
import { ToastrService } from "ngx-toastr";
import { Router } from "@angular/router";
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  UntypedFormControl,
  Validators
} from "@angular/forms";
import { WebappService } from "../../../service/webapp.service";
import { FileValidator } from "../../../provider/file-input.validator";

@Component({
  standalone: false,
selector: "app-profile",
  templateUrl: "./profile.component.html",
  styleUrls: ["./profile.component.scss"]
})
export class ProfileComponent implements OnInit {
  profilelog: any;
  profileid: any;
  profileinfo: any = {
    full_name: "",
    email: "",
    country_code: "",
    phone_number: ""
  };
  requestData: any;
  profileForm: UntypedFormGroup;
  profilePhoto: any;
  uploadForm: UntypedFormGroup;
  authtoken: any;
  ad_unit_id:any;
  admin_enable_ads:any;
  constructor(
    private apiservice: WebappService,
    private router: Router,
    public toastr: ToastrService,
    private translate: TranslateService,
    private fb: UntypedFormBuilder,
    private elem: ElementRef
  ) {
    this.profileForm = this.fb.group({
      username: [],
      firstname: ["", Validators.required]
    });

    this.uploadForm = new UntypedFormGroup({
      logo: new UntypedFormControl("", [FileValidator.validate])
    });
  }

  ngOnInit() {
    const storedUser = localStorage.getItem("user");
    this.profilelog = storedUser ? JSON.parse(storedUser) : null;
    if (!this.profilelog?.id) {
      this.router.navigate(["/signin"]);
      return;
    }
    this.profileid = this.profilelog.id;
    this.ad_unit_id = this.profilelog.ad_unit_id;
    this.admin_enable_ads=this.profilelog.admin_enable_ads;

    this.apiservice.profiledetails(this.profileid).subscribe(data => {
      if (data["status"] === "true") {
        this.profileinfo = data;
        this.profileForm.patchValue({
          firstname: this.profileinfo.full_name || "",
          username: this.profileinfo.email || ""
        });
        if (this.profileinfo.user_image) {
          this.profilePhoto = this.profileinfo.user_image;
        } else {
          this.profilePhoto = environment.apiUrl + "/gallery/users/user.png";
        }
      } else {
        this.toastr.error(this.translate.instant(data["message"]));
        window.scrollTo(0, 0);
      }
    });
  }

  onProfileSubmit(login) {
    if (this.profileForm.valid) {
      this.profilelog = JSON.parse(localStorage.getItem("user"));
      this.profileid = this.profilelog.id;
      const requestData = {
        user_id: this.profileid,
        full_name: login.firstname
      };
      this.apiservice.profileupdate(requestData).subscribe(data => {
        if (data["status"] === "true") {
          this.toastr.success(this.translate.instant(data["message"]));
          window.scrollTo(0, 0);
        } else {
          this.toastr.error(this.translate.instant(data["message"]));
          window.scrollTo(0, 0);
        }
      });
    } else {
      this.validateAllFormFields(this.profileForm);
    }
  }

  onPicUpload(event) {
    const files = this.elem.nativeElement.querySelector("#my-file").files;
    if (!this.validateFile(files[0].name)) {
      this.toastr.error("Support File Format - png,jpeg,jpg ", "Error!");
    } else {
      const formData = new FormData();
      const file = files[0];
      this.profilelog = JSON.parse(localStorage.getItem("user"));
      this.profileid = this.profilelog.id;
      formData.append("userImage", file, file.name);
      formData.append("user_id", this.profileid);
      this.apiservice.updateProfilePic(formData).subscribe(data => {
        if (data["status"] === "true") {
          this.profilePhoto = data["user_image"];
          this.toastr.success(this.translate.instant(data["message"]));
          window.scrollTo(0, 0);
        } else {
          this.toastr.error(this.translate.instant(data["message"]));
        }
      });
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
    let ext = name.substring(name.lastIndexOf(".") + 1);
    if (ext.toLowerCase() === "png") {
      return true;
    } else if (ext.toLowerCase() === "jpeg") {
      return true;
    } else if (ext.toLowerCase() === "jpg") {
      return true;
    } else {
      return false;
    }
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


