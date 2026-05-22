import { DOCUMENT } from "@angular/common";
import { Inject, Injectable } from "@angular/core";
import { environment } from "environments/environment";

export interface AgmMouseEvent {
  coords: {
    lat: number;
    lng: number;
  };
}

export type MouseEvent = AgmMouseEvent;

export const ControlPosition = {
  TOP_RIGHT: (window as any)?.google?.maps?.ControlPosition?.TOP_RIGHT ?? 2
};

@Injectable({
  providedIn: "root"
})
export class MapsAPILoader {
  private loadingPromise: Promise<void> | null = null;

  constructor(@Inject(DOCUMENT) private document: Document) {}

  load(): Promise<void> {
    const globalGoogle = (window as any).google;
    if (globalGoogle?.maps?.places) {
      return Promise.resolve();
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = new Promise<void>((resolve, reject) => {
      const callbackName = "__shilotaGoogleMapsInit";
      (window as any)[callbackName] = () => resolve();

      const script = this.document.createElement("script");
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error("Failed to load Google Maps API"));
      script.src =
        "https://maps.googleapis.com/maps/api/js?key=" +
        environment.googleapiKey +
        "&libraries=places,geometry,drawing&callback=" +
        callbackName;

      this.document.body.appendChild(script);
    });

    return this.loadingPromise;
  }
}
