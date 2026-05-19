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
import { environment } from ".././../../../environments/environment";
declare var google;
@Component({
  standalone: false,
selector: "app-pickup-location",
  templateUrl: "./pickup-location.component.html",
  styleUrls: ["./pickup-location.component.scss"]
})
export class PickupLocationComponent implements OnInit {
  latitude: number;
  longitude: number;
  zoom: number;
  pickup_location: string;
  pickupForm: UntypedFormGroup;
  pickupCleared: Boolean;
  pickupSelected: Boolean;
  url: any;
  private geoCoder;
  @ViewChild("pickup_field")
  public searchElementRef: ElementRef;
  constructor(
    private mapsAPILoader: MapsAPILoader,
    private ngZone: NgZone,
    private fb: UntypedFormBuilder,
    private router: Router
  ) {
    this.pickupForm = this.fb.group({
      pickup_field: ["", Validators.compose([Validators.required])]
    });
    this.pickupCleared = true;
    this.pickupSelected = true;
  }

  ngOnInit() {
    this.url = environment.apiUrl;
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
    if (localStorage.pickup_location) {
      this.updatePickupState(localStorage.pickup_location);
      this.pickupSelected = false;
    }
  }

  private setCurrentLocation() {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(position => {
        this.latitude = position.coords.latitude;
        this.longitude = position.coords.longitude;
        this.zoom = 15;
        if (localStorage.pickup_lon && localStorage.pickup_lat) {
          this.latitude = parseFloat(localStorage.pickup_lat);
          this.longitude = parseFloat(localStorage.pickup_lon);
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
            if (results[0]) {
              this.zoom = 15;
              this.pickupSelected = false;
              if (!localStorage.pickup_location) {
                this.updatePickupState(results[0].formatted_address);
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
          if (status === "OK") {
            this.pickupSelected = false;
            if (results[0]) {
              this.zoom = 15;
              this.updatePickupState(results[0].formatted_address);
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
    if (this.pickupForm.valid && this.latitude != null && this.longitude != null) {
      localStorage.setItem("pickup_lat", this.latitude.toString());
      localStorage.setItem("pickup_lon", this.longitude.toString());
      localStorage.setItem("pickup_location", this.pickup_location);
      this.router.navigate(["/search"]);
    } else {
      this.validateAllFormFields(this.pickupForm);
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

  clearPickup() {
    if (this.pickup_location && this.pickupCleared) {
      this.updatePickupState("");
      this.pickupCleared = false;
      this.pickupSelected = true;
    }
  }

  fetchMyLocation() {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(position => {
        this.latitude = position.coords.latitude;
        this.longitude = position.coords.longitude;
        this.zoom = 15;
        this.setAddress(this.latitude, this.longitude);
      });
    }
  }

  private updatePickupState(address: string) {
    this.pickup_location = address;
    this.pickupForm.get("pickup_field")?.setValue(address);
    this.pickupForm.get("pickup_field")?.markAsDirty();
  }
}
