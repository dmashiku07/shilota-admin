import { Component, OnInit, ViewEncapsulation } from '@angular/core';
@Component({
  standalone: false,
selector: 'app-fronthomelayout',
  templateUrl: './fronthomelayout.component.html',
  styleUrls: ['./fronthomelayout.component.css',
    '../../../assets/frontend/css/common.css',
    '../../../assets/frontend/css/style.css',
  ],
  encapsulation: ViewEncapsulation.None 
})
export class FronthomelayoutComponent implements OnInit {

  constructor() { }

  ngOnInit() {
    document.getElementsByTagName('body')[0].classList.remove('overflow_div');
  }

}
