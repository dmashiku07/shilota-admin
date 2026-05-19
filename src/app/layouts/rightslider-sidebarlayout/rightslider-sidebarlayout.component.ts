import { Component, OnInit, ViewEncapsulation } from '@angular/core';

@Component({
  standalone: false,
selector: 'app-rightslider-sidebarlayout',
  templateUrl: './rightslider-sidebarlayout.component.html',
  styleUrls: ['./rightslider-sidebarlayout.component.scss',
    '../../../assets/frontend/css/common.css',
    '../../../assets/frontend/css/style.css'],
  encapsulation: ViewEncapsulation.None
})
export class RightsliderSidebarlayoutComponent implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}


