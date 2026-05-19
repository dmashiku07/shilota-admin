import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-server-pagination',
  templateUrl: './server-pagination.component.html',
  styleUrls: ['./server-pagination.component.css']
})
export class ServerPaginationComponent {
  @Input() page = 1;
  @Input() totalPages = 1;
  @Input() totalItems = 0;
  @Input() pageSize = 25;
  @Output() pageChange = new EventEmitter<number>();

  get pages(): number[] {
    const total = this.totalPages || 1;
    if (total <= 7) {
      return Array.from({ length: total }, (_value, index) => index + 1);
    }

    const start = Math.max(1, this.page - 2);
    const end = Math.min(total, start + 4);
    const adjustedStart = Math.max(1, end - 4);
    return Array.from({ length: end - adjustedStart + 1 }, (_value, index) => adjustedStart + index);
  }

  goTo(targetPage: number): void {
    const total = this.totalPages || 1;
    const nextPage = Math.min(Math.max(1, targetPage), total);
    if (nextPage !== this.page) {
      this.pageChange.emit(nextPage);
    }
  }
}
