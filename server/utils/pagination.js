function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePositiveInteger(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getPaginationParams(req, options) {
  const config = options || {};
  const defaultSortBy = config.defaultSortBy || "_id";
  const allowedSortFields = Array.isArray(config.allowedSortFields) && config.allowedSortFields.length
    ? config.allowedSortFields
    : [defaultSortBy];

  const page = parsePositiveInteger(req.query.page, config.defaultPage || 1);
  const pageSize = Math.min(
    parsePositiveInteger(req.query.pageSize, config.defaultPageSize || 25),
    config.maxPageSize || 100
  );
  const requestedSortBy = String(req.query.sortBy || defaultSortBy);
  const sortBy = allowedSortFields.indexOf(requestedSortBy) >= 0 ? requestedSortBy : defaultSortBy;
  const sortDir = String(req.query.sortDir || config.defaultSortDir || "desc").toLowerCase() === "asc" ? "asc" : "desc";
  const search = String(req.query.search || "").trim();

  return {
    page,
    pageSize,
    sortBy,
    sortDir,
    search
  };
}

function buildSort(sortBy, sortDir) {
  const sort = {};
  sort[sortBy] = sortDir === "asc" ? 1 : -1;
  return sort;
}

function buildSearchQuery(search, searchFields) {
  if (!search || !Array.isArray(searchFields) || !searchFields.length) {
    return null;
  }

  const regex = new RegExp(escapeRegex(search), "i");
  return {
    $or: searchFields.map(function (field) {
      const query = {};
      query[field] = regex;
      return query;
    })
  };
}

function mergeMatch(match, extraMatch) {
  if (!extraMatch) {
    return match;
  }

  if (!match || !Object.keys(match).length) {
    return extraMatch;
  }

  return {
    $and: [match, extraMatch]
  };
}

function buildPaginationResult(items, totalItems, params) {
  const page = params.page;
  const pageSize = params.pageSize;
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 1;

  return {
    items,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages
    }
  };
}

module.exports = {
  buildPaginationResult,
  buildSearchQuery,
  buildSort,
  getPaginationParams,
  mergeMatch
};
