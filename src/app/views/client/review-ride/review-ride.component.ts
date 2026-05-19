import { Component, OnInit } from "@angular/core";
import { StarRatingShimComponent } from "app/shared/rating/rating-shim.module";
import { ActivatedRoute, Router } from "@angular/router";
import { WebappService } from "../../../service/webapp.service";
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  UntypedFormControl,
  Validators
} from "@angular/forms";
import { ToastrService } from "ngx-toastr";
@Component({
  standalone: false,
selector: "app-review-ride",
  templateUrl: "./review-ride.component.html",
  styleUrls: ["./review-ride.component.scss"]
})
export class ReviewRideComponent implements OnInit {
  profileid: any;
  profilelog: any;
  reviewdetail: any;
  onride_id: any;
  Form: UntypedFormGroup;
  ridedate: any;
  review_msg: any;
  rating: number;
  rideStatus: any;
  constructor(
    private apiservice: WebappService,
    private router: Router,
    private route: ActivatedRoute,
    private fb: UntypedFormBuilder,
    public toastr: ToastrService
  ) {}

  ngOnInit() {
    this.createForm();
    this.profilelog = JSON.parse(localStorage.getItem("user"));
    this.profileid = this.profilelog.id;
    this.route.params.subscribe(params => {
      this.onride_id = atob(params["id"]);
    });
    const ridedate = {
      user_id: this.profileid,
      onride_id: this.onride_id
    };
    this.route.params.subscribe(params => {
      this.reviewdetail = this.apiservice
        .ridecompleted(ridedate)
        .subscribe(res => {
          this.reviewdetail = res;
          this.rideStatus = this.reviewdetail.ridestatus;
          if (this.reviewdetail.isreview) {
            this.review_msg = this.reviewdetail.review_message;
            this.rating = this.reviewdetail.rating;
          } else {
            this.router.navigate(["/page-not-found"]);
          }
        });
    });
  }

  createForm() {
    this.Form = this.fb.group({
      review_message: ["", Validators.required]
    });
  }

  add(Form) {
    if (this.Form.valid) {
      Form.rating = this.rating;
      Form.user_id = this.profileid;
      Form.onride_id = this.onride_id;
      this.apiservice.reviewaride(Form).subscribe(data => {
        if (data["status"] === "true") {
          if (this.rideStatus === "completed") {
            this.router.navigate(["completed-rides", btoa(this.onride_id)]);
          } else {
            this.router.navigate(["your-rides"]);
          }
        } else {
          this.router.navigate(["your-rides"]);
        }
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

  onRate($event: {
    oldValue: number;
    newValue: number;
    starRating: StarRatingShimComponent;
  }) {
    this.rating = $event.newValue;
  }

}
