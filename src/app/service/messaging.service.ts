import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

@Injectable({
  providedIn: "root"
})
export class MessagingService {
  currentMessage = new BehaviorSubject(null);
  constructor() {}

  /**
   * request permission for notification from firebase cloud messaging
   *
   * @param userId userId
   */
  requestPermission() {
    // Disabled temporarily: @angular/fire in this project version is incompatible with Angular 21.
    return;
  }

  /**
   * hook method when new notification received in foreground
   */
  receiveMessage() {
    // No-op while messaging integration is disabled.
    return;
  }
}
