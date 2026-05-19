import { NgModule, Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "ng-adsense",
  standalone: false,
  template: ""
})
export class AdsenseShimComponent {
  @Input() adClient: string | null = null;
  @Input() adSlot: string | number | null = null;
  @Input() display: string | null = null;
  @Input() width: number | string | null = null;
  @Input() height: number | string | null = null;
}

@NgModule({
  imports: [CommonModule],
  declarations: [AdsenseShimComponent],
  exports: [AdsenseShimComponent]
})
export class AdsenseShimModule {}
