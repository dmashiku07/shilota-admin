import { CommonModule } from "@angular/common";
import { Component, forwardRef, Input, NgModule } from "@angular/core";
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from "@angular/forms";

@Component({
  selector: "ckeditor",
  standalone: false,
  template: `
    <textarea
      class="form-control"
      [readOnly]="readonly"
      [value]="value"
      (input)="onInput($any($event.target).value)"
      (blur)="onTouched()"
    ></textarea>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CkeditorShimComponent),
      multi: true
    }
  ]
})
export class CkeditorShimComponent implements ControlValueAccessor {
  @Input() readonly = false;
  @Input() debounce = "0";

  value = "";
  private onChange: (value: string) => void = () => {};
  private onTouch: () => void = () => {};

  writeValue(value: string | null): void {
    this.value = value ?? "";
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouch = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.readonly = isDisabled;
  }

  onInput(value: string): void {
    this.value = value;
    this.onChange(value);
  }

  onTouched(): void {
    this.onTouch();
  }
}

@NgModule({
  imports: [CommonModule, FormsModule],
  declarations: [CkeditorShimComponent],
  exports: [CkeditorShimComponent]
})
export class CkeditorShimModule {}
