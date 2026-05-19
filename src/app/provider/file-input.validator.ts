import {Directive} from "@angular/core";
import {NG_VALIDATORS, Validator, UntypedFormControl} from "@angular/forms";

@Directive({
  standalone: false,
selector: "[requireFile]",
    providers: [
        { provide: NG_VALIDATORS, useExisting: FileValidator, multi: true },
    ]
})
export class FileValidator implements Validator {
    static validate(c: UntypedFormControl): {[key: string]: any} {
      return c.value == null || c.value.length == 0 ? { "required" : true} : null;
    }

    validate(c: UntypedFormControl): {[key: string]: any} {
      return FileValidator.validate(c);
    }
}