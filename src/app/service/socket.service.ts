import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import * as io from "socket.io-client";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root"
})
export class SocketService {
  private socket: SocketIOClient.Socket;
  constructor() {
    this.socket = io(environment.socketUrl);
  }

  // EMITTER
  sendMessage(msg: Object) {
    this.socket.emit("whereareyou", msg);
  }

  // HANDLER
  onNewMessage() {
    return new Observable(observer => {
      this.socket.on("iamhere", msg => {
        observer.next(msg);
      });
    });
  }
}
