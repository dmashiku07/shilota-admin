import { NgModule, Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: "filter",
  standalone: false
})
export class FilterShimPipe implements PipeTransform {
  transform(value: any, term: any): any {
    if (!Array.isArray(value)) {
      return [];
    }

    if (term === undefined || term === null || term === "") {
      return value;
    }

    const search = String(term).toLowerCase();
    return value.filter((item: any) =>
      JSON.stringify(item ?? {})
        .toLowerCase()
        .includes(search)
    );
  }
}

@Pipe({
  name: "orderBy",
  standalone: false
})
export class OrderByShimPipe implements PipeTransform {
  transform(value: any, key?: string, reverse?: boolean): any {
    if (!Array.isArray(value)) {
      return [];
    }

    if (!key) {
      return value;
    }

    const sorted = [...value].sort((a: any, b: any) => {
      const av = a?.[key];
      const bv = b?.[key];
      if (av === bv) {
        return 0;
      }
      return av > bv ? 1 : -1;
    });

    return reverse ? sorted.reverse() : sorted;
  }
}

@NgModule({
  declarations: [FilterShimPipe, OrderByShimPipe],
  exports: [FilterShimPipe, OrderByShimPipe]
})
export class FilterOrderShimModule {}
