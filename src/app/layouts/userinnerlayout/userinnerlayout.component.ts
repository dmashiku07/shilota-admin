import { Component, OnInit, ViewEncapsulation } from "@angular/core";
@Component({
  standalone: false,
selector: "app-userinnerlayout",
  templateUrl: "./userinnerlayout.component.html",
  styleUrls: [
    "./userinnerlayout.component.scss",
    "../../../assets/frontend/css/common.css",
    "../../../assets/frontend/css/style.css"
  ],
  encapsulation: ViewEncapsulation.None
})
export class UserinnerlayoutComponent implements OnInit {
  constructor() {}
  ngOnInit() {}
}
