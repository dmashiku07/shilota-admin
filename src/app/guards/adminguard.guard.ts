import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from "@angular/router";
import { Observable } from "rxjs";
import { AuthenticationService } from "app/service/authentication.service";

@Injectable({
  providedIn: "root"
})
export class AdminguardGuard {
  constructor(
    private authService: AuthenticationService,
    private router: Router
  ) {}
  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const expectedRole = (next.data?.expectedRole || "").toString();
    const token = localStorage.getItem("authtoken");
    const tokenPayLoad = this.decodeToken(token);

    if (this.authService.loggedIn()) {
      const role = tokenPayLoad?.data?.role?.toString?.().trim?.() || "";
      if (expectedRole && role && role !== expectedRole.trim()) {
        if (expectedRole === "admin") {
          return this.router.createUrlTree(["/"]);
        } else {
          return this.router.createUrlTree(["signin"]);
        }
      }
      return true;
    } else {
      if (expectedRole === "admin") {
        return this.router.createUrlTree(["/"]);
      } else {
        return this.router.createUrlTree(["signin"]);
      }
    }
  }

  private decodeToken(token: string | null): any {
    if (!token) {
      return {};
    }
    try {
      const parts = token.split(".");
      if (parts.length < 2) {
        return {};
      }
      const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(
        atob(payload)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(json);
    } catch {
      return {};
    }
  }
}
