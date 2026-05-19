import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Injectable, Input, NgModule, OnChanges, Output, Pipe, PipeTransform, SimpleChanges } from '@angular/core';

interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
}

@Injectable({ providedIn: 'root' })
export class PaginationShimService {
  private states = new Map<string, PaginationState>();

  update(id: string, state: PaginationState): void {
    this.states.set(id, state);
  }

  get(id: string): PaginationState {
    return this.states.get(id) || { currentPage: 1, itemsPerPage: 25, totalItems: 0 };
  }
}

@Pipe({
  name: 'paginate',
  standalone: false
})
export class PaginateShimPipe implements PipeTransform {
  constructor(private readonly pagination: PaginationShimService) {}

  transform<T>(value: T[] | null | undefined, config?: { itemsPerPage?: number; currentPage?: number; id?: string }): T[] {
    if (!Array.isArray(value)) {
      this.pagination.update(config?.id || 'default', {
        currentPage: config?.currentPage || 1,
        itemsPerPage: config?.itemsPerPage || 25,
        totalItems: 0
      });
      return [];
    }

    const itemsPerPage = Math.max(1, Number(config?.itemsPerPage) || 25);
    const totalPages = Math.max(1, Math.ceil(value.length / itemsPerPage));
    const currentPage = Math.min(Math.max(1, Number(config?.currentPage) || 1), totalPages);
    const start = (currentPage - 1) * itemsPerPage;

    this.pagination.update(config?.id || 'default', {
      currentPage,
      itemsPerPage,
      totalItems: value.length
    });

    return value.slice(start, start + itemsPerPage);
  }
}

@Component({
  selector: 'pagination-controls',
  standalone: false,
  template: `
    <nav class="pagination-shim" *ngIf="pages.length > 1">
      <ul class="pagination justify-content-center mb-0">
        <li class="page-item" [class.disabled]="currentPage <= 1">
          <a class="page-link" href="javascript:;" (click)="selectPage(currentPage - 1, $event)">Previous</a>
        </li>
        <li class="page-item" *ngFor="let page of pages" [class.active]="page === currentPage">
          <a class="page-link" href="javascript:;" (click)="selectPage(page, $event)">{{ page }}</a>
        </li>
        <li class="page-item" [class.disabled]="currentPage >= totalPages">
          <a class="page-link" href="javascript:;" (click)="selectPage(currentPage + 1, $event)">Next</a>
        </li>
      </ul>
    </nav>
  `
})
export class PaginationControlsShimComponent implements OnChanges {
  @Input() id = 'default';
  @Output() pageChange = new EventEmitter<number>();

  currentPage = 1;
  totalPages = 1;
  pages: number[] = [];

  constructor(private readonly pagination: PaginationShimService) {}

  ngOnChanges(_changes: SimpleChanges): void {
    this.refresh();
  }

  private refresh(): void {
    const state = this.pagination.get(this.id);
    this.currentPage = state.currentPage;
    this.totalPages = Math.max(1, Math.ceil(state.totalItems / state.itemsPerPage));
    this.pages = Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  selectPage(page: number, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.refresh();
    const nextPage = Math.min(Math.max(1, page), this.totalPages);
    if (nextPage === this.currentPage) {
      return;
    }
    this.currentPage = nextPage;
    this.pageChange.emit(nextPage);
  }
}

@NgModule({
  imports: [CommonModule],
  declarations: [PaginateShimPipe, PaginationControlsShimComponent],
  exports: [PaginateShimPipe, PaginationControlsShimComponent]
})
export class PaginationShimModule {}
