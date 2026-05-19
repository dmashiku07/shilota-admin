import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FaqRoutingModule } from './faq-routing.module';
import { ViewComponent } from './view/view.component';
import { ShowComponent } from './show/show.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';


@NgModule({
  imports: [
    CommonModule,
    FaqRoutingModule,
     TranslateModule,
    NgbModule,

  ],
  declarations: [ViewComponent, ShowComponent]
})
export class FaqModule { }
