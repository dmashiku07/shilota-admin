import {
  Component,
  OnInit,
  Input,
  ViewChild,
  ElementRef,
  NgZone
} from "@angular/core";
import { MapsAPILoader, MouseEvent } from "app/shared/agm/agm-compat";
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  UntypedFormControl,
  Validators
} from "@angular/forms";
import { Router } from "@angular/router";
declare var google;
@Component({
  standalone: false,
selector: "app-drop-location",
  templateUrl: "./drop-location.component.html",
  styleUrls: ["./drop-location.component.scss"]
})
export class DropLocationComponent implements OnInit {
  latitude: number;
  longitude: number;
  zoom: number;
  drop_location: string;
  dropForm: UntypedFormGroup;
  dropCleared : Boolean;
  dropSelected : Boolean;
  private geoCoder;
  @ViewChild("drop_field")
  public searchElementRef: ElementRef;
  constructor(
    private mapsAPILoader: MapsAPILoader,
    private ngZone: NgZone,
    private fb: UntypedFormBuilder,
    private router: Router
  ) {
    this.dropCleared = true;
    this.dropSelected = true;
    this.dropForm = this.fb.group({
      drop_field: ["", Validators.compose([Validators.required])]
    });
  }

  ngOnInit() {
    // load Places Autocomplete
    this.mapsAPILoader.load().then(() => {
      this.setCurrentLocation();
      this.geoCoder = new google.maps.Geocoder();
      let autocomplete = new google.maps.places.Autocomplete(
        this.searchElementRef.nativeElement
      );
      autocomplete.addListener("place_changed", () => {
        this.ngZone.run(() => {
          // get the place result
          let place: google.maps.places.PlaceResult = autocomplete.getPlace();
          // verify result
          if (place.geometry === undefined || place.geometry === null) {
            return;
          }
          // set latitude, longitude and zoom
          this.latitude = place.geometry.location.lat();
          this.longitude = place.geometry.location.lng();
          this.zoom = 15;
          this.setAddress(this.latitude, this.longitude);
        });
      });
    });

    if (localStorage.drop_location) {
      this.updateDropState(localStorage.drop_location);
      this.dropSelected = false;
    }
  }

  private setCurrentLocation() {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(position => {
        this.zoom = 15;
        this.latitude = position.coords.latitude;
        this.longitude = position.coords.longitude;

        if (localStorage.drop_lon && localStorage.drop_lat) {
          this.latitude = parseFloat(localStorage.drop_lat);
          this.longitude = parseFloat(localStorage.drop_lon);
        }
        this.getAddress(this.latitude, this.longitude);
      });
    }
  }

  markerDragEnd($event: MouseEvent) {
    this.latitude = $event.coords.lat;
    this.longitude = $event.coords.lng;
    this.setAddress(this.latitude, this.longitude);
  }

  getAddress(latitude, longitude) {
    this.geoCoder.geocode(
      { location: { lat: latitude, lng: longitude } },
      (results, status) => {
        this.ngZone.run(() => {
          if (status === "OK") {
            this.dropSelected = false;
            if (results[0]) {
              this.zoom = 15;
              if (!localStorage.drop_location) {
                this.updateDropState(results[0].formatted_address);
              }
            } else {
              console.log("No results found");
            }
          } else {
            console.log("Geocoder failed due to: " + status);
          }
        });
      }
    );
  }

  setAddress(latitude, longitude) {
    this.geoCoder.geocode(
      { location: { lat: latitude, lng: longitude } },
      (results, status) => {
        this.ngZone.run(() => {
          this.dropSelected = false;
          if (status === "OK") {
            if (results[0]) {
              this.zoom = 15;
              this.updateDropState(results[0].formatted_address);
            } else {
              console.log("No results found");
            }
          } else {
            console.log("Geocoder failed due to: " + status);
          }
        });
      }
    );
  }

  confirmLocation(formdata) {
    if (this.dropForm.valid && this.latitude != null && this.longitude != null) {
      localStorage.setItem('drop_lat', this.latitude.toString());
      localStorage.setItem('drop_lon', this.longitude.toString());
      localStorage.setItem('drop_location', this.drop_location);
      this.router.navigate(["/search"]);
    } else {
      this.validateAllFormFields(this.dropForm);
    }
  }

  validateAllFormFields(formGroup: UntypedFormGroup) {
    Object.keys(formGroup.controls).forEach(field => {
      const control = formGroup.get(field);
      if (control instanceof UntypedFormControl) {
        control.markAsTouched({ onlySelf: true });
      } else if (control instanceof UntypedFormGroup) {
        this.validateAllFormFields(control);
      }
    });
  }

  clearDrop() {
    if(this.drop_location && this.dropCleared){
      this.updateDropState("");
      this.dropCleared = false;
      this.dropSelected = true;
    }
  }

  private updateDropState(address: string) {
    this.drop_location = address;
    this.dropCleared = !!address;
    this.dropForm.get("drop_field")?.setValue(address);
    this.dropForm.get("drop_field")?.markAsDirty();
  }
}
