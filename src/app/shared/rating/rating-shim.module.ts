import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, NgModule, Output } from "@angular/core";

@Component({
  selector: "star-rating",
  standalone: false,
  template: `
    <div class="star-rating-shim">
      <button
        type="button"
        *ngFor="let s of stars"
        [disabled]="readonly"
        (click)="setRating(s)"
        style="border:0;background:transparent;cursor:pointer;padding:0 2px;"
      >
        <span [style.color]="s <= value ? checkedcolor : uncheckedcolor" [style.fontSize]="size">★</span>
      </button>
    </div>
  `
})
export class StarRatingShimComponent {
  @Input() value = 0;
  @Input() checkedcolor = "#f5a623";
  @Input() uncheckedcolor = "#cdcdcd";
  @Input() size = "24px";
  @Input() readonly = false;
  @Output() rate = new EventEmitter<{ oldValue: number; newValue: number; starRating: StarRatingShimComponent }>();

  stars = [1, 2, 3, 4, 5];

  setRating(newValue: number): void {
    if (this.readonly) {
      return;
    }
    const oldValue = this.value;
    this.value = newValue;
    this.rate.emit({ oldValue, newValue, starRating: this });
  }
}

@NgModule({
  imports: [CommonModule],
  declarations: [StarRatingShimComponent],
  exports: [StarRatingShimComponent]
})
export class RatingShimModule {}

