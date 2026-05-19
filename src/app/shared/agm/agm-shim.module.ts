import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  Input,
  NgModule,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild
} from "@angular/core";
import { MapsAPILoader } from "app/shared/agm/agm-compat";

declare const google: any;

@Component({
  selector: "agm-map",
  standalone: false,
  template: `
    <div class="agm-shim-map" #mapContainer></div>
    <ng-content></ng-content>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 280px;
        position: relative;
      }

      .agm-shim-map {
        width: 100%;
        height: 100%;
        min-height: 280px;
      }
    `
  ]
})
export class AgmMapShimComponent implements AfterViewInit, OnChanges {
  @Input() latitude: number | null = null;
  @Input() longitude: number | null = null;
  @Input() zoom: number | null = null;
  @Input() usePanning: boolean | null = null;
  @Output() mapReady = new EventEmitter<unknown>();

  @ViewChild("mapContainer", { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  map: any;
  private overlays: Array<() => void> = [];

  constructor(private mapsApiLoader: MapsAPILoader) {}

  async ngAfterViewInit(): Promise<void> {
    await this.mapsApiLoader.load();

    const center = this.getCenter();
    this.map = new google.maps.Map(this.mapContainer.nativeElement, {
      center,
      zoom: this.zoom ?? 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    });

    this.mapReady.emit(this.map);
    this.flushOverlays();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (!this.map) {
      return;
    }

    this.map.setCenter(this.getCenter());
    if (this.zoom != null) {
      this.map.setZoom(this.zoom);
    }
  }

  registerOverlay(attach: () => void): void {
    if (this.map) {
      attach();
      return;
    }

    this.overlays.push(attach);
  }

  private flushOverlays(): void {
    this.overlays.forEach((attach) => attach());
    this.overlays = [];
  }

  private getCenter(): { lat: number; lng: number } {
    return {
      lat: this.latitude ?? -6.7924,
      lng: this.longitude ?? 39.2083
    };
  }
}

@Component({
  selector: "agm-marker",
  standalone: false,
  template: ""
})
export class AgmMarkerShimComponent implements OnInit, OnChanges, OnDestroy {
  @Input() latitude: number | null = null;
  @Input() longitude: number | null = null;
  @Input() markerDraggable: boolean | null = null;
  @Output() dragEnd = new EventEmitter<unknown>();

  private marker: any;

  constructor(
    private hostMap: AgmMapShimComponent
  ) {}

  ngOnInit(): void {
    this.hostMap.registerOverlay(() => this.attachMarker());
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (!this.marker) {
      return;
    }

    this.marker.setPosition(this.getPosition());
    this.marker.setDraggable(!!this.markerDraggable);
  }

  ngOnDestroy(): void {
    if (this.marker) {
      this.marker.setMap(null);
      this.marker = null;
    }
  }

  private attachMarker(): void {
    if (!this.hostMap.map || this.marker) {
      return;
    }

    this.marker = new google.maps.Marker({
      position: this.getPosition(),
      map: this.hostMap.map,
      draggable: !!this.markerDraggable
    });

    this.marker.addListener("dragend", (event: any) => {
      this.dragEnd.emit({
        coords: {
          lat: event.latLng.lat(),
          lng: event.latLng.lng()
        }
      });
    });
  }

  private getPosition(): { lat: number; lng: number } {
    return {
      lat: this.latitude ?? 0,
      lng: this.longitude ?? 0
    };
  }
}

@Component({
  selector: "agm-direction",
  standalone: false,
  template: ""
})
export class AgmDirectionShimComponent implements OnInit, OnChanges, OnDestroy {
  @Input() origin: any;
  @Input() destination: any;

  private directionsService: any;
  private directionsRenderer: any;

  constructor(
    private hostMap: AgmMapShimComponent
  ) {}

  ngOnInit(): void {
    this.hostMap.registerOverlay(() => this.attachDirections());
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.renderRoute();
  }

  ngOnDestroy(): void {
    if (this.directionsRenderer) {
      this.directionsRenderer.setMap(null);
      this.directionsRenderer = null;
    }
  }

  private attachDirections(): void {
    if (!this.hostMap.map || this.directionsRenderer) {
      return;
    }

    this.directionsService = new google.maps.DirectionsService();
    this.directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: "#f04e29",
        strokeOpacity: 0.9,
        strokeWeight: 5
      }
    });
    this.directionsRenderer.setMap(this.hostMap.map);
    this.renderRoute();
  }

  private renderRoute(): void {
    if (!this.directionsService || !this.directionsRenderer) {
      return;
    }

    const origin = this.normalizePoint(this.origin);
    const destination = this.normalizePoint(this.destination);
    if (!origin || !destination) {
      return;
    }

    this.directionsService.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING
      },
      (result: any, status: string) => {
        if (status === "OK") {
          this.directionsRenderer.setDirections(result);
        }
      }
    );
  }

  private normalizePoint(value: any): any {
    if (!value) {
      return null;
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value.lat === "number" && typeof value.lng === "number") {
      return { lat: value.lat, lng: value.lng };
    }

    return null;
  }
}

@NgModule({
  imports: [CommonModule],
  declarations: [AgmMapShimComponent, AgmMarkerShimComponent, AgmDirectionShimComponent],
  exports: [AgmMapShimComponent, AgmMarkerShimComponent, AgmDirectionShimComponent]
})
export class AgmShimModule {}
