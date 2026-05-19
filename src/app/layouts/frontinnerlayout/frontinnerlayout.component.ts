import { Component, OnInit, ViewEncapsulation } from '@angular/core';

@Component({
  standalone: false,
selector: 'app-frontinnerlayout',
  templateUrl: './frontinnerlayout.component.html',
  styleUrls: ['./frontinnerlayout.component.css',
    '../../../assets/frontend/css/common.css',
    '../../../assets/frontend/css/style.css',
  ],
  encapsulation: ViewEncapsulation.None
})
export class FrontinnerlayoutComponent implements OnInit {

  constructor() { }

  ngOnInit() {
    
  }

}


