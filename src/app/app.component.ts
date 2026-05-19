import { Component, OnInit } from "@angular/core";
import { MessagingService } from "./service/messaging.service";
@Component({
  standalone: false,
selector: "app-root",
  templateUrl: "./app.component.html"
})
export class AppComponent implements OnInit {
  message;
  profilelog;
  profileid;
  constructor(private messagingService: MessagingService) {}

  ngOnInit() {
    this.hidePageLoader();
    try {
      this.messagingService.requestPermission();
      this.messagingService.receiveMessage();
      this.message = this.messagingService.currentMessage;
    } catch (error) {
      console.warn("Messaging initialization skipped:", error);
    }
  }

  private hidePageLoader() {
    setTimeout(() => {
      const loader = document.querySelector(".page-loading") as HTMLElement | null;
      if (loader) {
        loader.style.display = "none";
      }
    }, 1200);
  }
}
