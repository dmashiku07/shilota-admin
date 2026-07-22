import { map } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl + '/subscription-plans';

@Injectable()
export class SubscriptionPlanService {
  constructor(private http: HttpClient) {}

  list(customerType: string) {
    return this.http.get(API_URL, {
      params: {
        customer_type: customerType
      }
    }).pipe(map(res => res));
  }

  getFeatureCatalog() {
    return this.http.get(API_URL + '/meta/features').pipe(map(res => res));
  }

  get(id: string) {
    return this.http.get(API_URL + '/' + id).pipe(map(res => res));
  }

  create(payload: any) {
    return this.http.post(API_URL, payload).pipe(map(res => res));
  }

  update(id: string, payload: any) {
    return this.http.put(API_URL + '/' + id, payload).pipe(map(res => res));
  }

  activate(id: string) {
    return this.http.post(API_URL + '/' + id + '/activate', {}).pipe(map(res => res));
  }

  deactivate(id: string) {
    return this.http.post(API_URL + '/' + id + '/deactivate', {}).pipe(map(res => res));
  }

  reorder(customerType: string, orderedIds: string[]) {
    return this.http.post(API_URL + '/reorder', {
      customer_type: customerType,
      ordered_ids: orderedIds
    }).pipe(map(res => res));
  }
}
