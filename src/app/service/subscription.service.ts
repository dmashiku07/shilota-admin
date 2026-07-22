import { map } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl + '/subscriptions';

@Injectable()
export class SubscriptionService {
  constructor(private http: HttpClient) {}

  getPage(params: any = {}) {
    return this.http.get(API_URL, { params }).pipe(map(res => res));
  }
}
