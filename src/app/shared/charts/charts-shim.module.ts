import { Directive, EventEmitter, Input, NgModule, Output } from "@angular/core";

@Directive({
  selector: "canvas[baseChart]",
  standalone: false
})
export class BaseChartShimDirective {
  @Input() data: unknown;
  @Input() labels: unknown;
  @Input() options: unknown;
  @Input() chartType: unknown;
  @Input() colors: unknown;

  @Output() chartHover = new EventEmitter<unknown>();
  @Output() chartClick = new EventEmitter<unknown>();
}

@NgModule({
  declarations: [BaseChartShimDirective],
  exports: [BaseChartShimDirective]
})
export class ChartsShimModule {}

