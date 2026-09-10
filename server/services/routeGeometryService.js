const Request = require("request");
const Admin = require("../models/admin");

function validCoordinate(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function parseStops(value) {
  let stops = value;
  if (typeof stops === "string") {
    try {
      stops = JSON.parse(stops);
    } catch (_error) {
      stops = [];
    }
  }
  return (Array.isArray(stops) ? stops : []).filter(function (stop) {
    return validCoordinate(stop.latitude || stop.lat, stop.longitude || stop.lng);
  });
}

function requestJson(options) {
  return new Promise(function (resolve, reject) {
    Request.get({
      ...options,
      headers: {
        "User-Agent": "ShilotaRide/1.0 (support@shilota.tz)",
        "Accept": "application/json",
        ...(options.headers || {})
      },
      json: true,
      timeout: 10000
    }, function (error, response, body) {
      if (error || !response || response.statusCode !== 200) {
        const status = response && response.statusCode ? " (HTTP " + response.statusCode + ")" : "";
        return reject(error || new Error("Route service request failed" + status));
      }
      resolve(body);
    });
  });
}

async function googleRoute(points, apiKey) {
  if (!apiKey) {
    return null;
  }
  const intermediate = points.slice(1, -1);
  const body = await requestJson({
    url: "https://maps.googleapis.com/maps/api/directions/json",
    qs: {
      origin: points[0].lat + "," + points[0].lng,
      destination: points[points.length - 1].lat + "," + points[points.length - 1].lng,
      mode: "driving",
      key: apiKey,
      ...(intermediate.length ? {
        waypoints: intermediate.map(function (point) {
          return "via:" + point.lat + "," + point.lng;
        }).join("|")
      } : {})
    }
  });
  const route = body && Array.isArray(body.routes) ? body.routes[0] : null;
  if (!route || !route.overview_polyline) return null;
  const legs = Array.isArray(route.legs) ? route.legs : [];
  return {
    encoded_polyline: route.overview_polyline.points,
    distance_meters: legs.length ? legs.reduce((sum, leg) => sum + Number(leg.distance && leg.distance.value), 0) : null,
    duration_seconds: legs.length ? legs.reduce((sum, leg) => sum + Number(leg.duration && leg.duration.value), 0) : null
  };
}

async function osrmRoute(points, serviceUrl) {
  const coordinates = points.map(function (point) {
    return point.lng + "," + point.lat;
  }).join(";");
  const body = await requestJson({
    url: serviceUrl + "/route/v1/driving/" + coordinates,
    qs: {
      overview: "full",
      geometries: "polyline",
      steps: "false"
    }
  });
  const route = body && Array.isArray(body.routes) ? body.routes[0] : null;
  return route && route.geometry ? {
    encoded_polyline: route.geometry,
    distance_meters: route.distance,
    duration_seconds: route.duration
  } : null;
}

async function getRoadRouteDetails(payload) {
  if (!validCoordinate(payload.pickup_lat, payload.pickup_lng) ||
      !validCoordinate(payload.drop_lat, payload.drop_lng)) {
    throw new Error("Valid route coordinates are required");
  }
  const stops = parseStops(payload.ride_stops);
  const points = [
    { lat: Number(payload.pickup_lat), lng: Number(payload.pickup_lng) },
    ...stops.map(function (stop) {
      return {
        lat: Number(stop.latitude || stop.lat),
        lng: Number(stop.longitude || stop.lng)
      };
    }),
    { lat: Number(payload.drop_lat), lng: Number(payload.drop_lng) }
  ];

  const admin = await Admin.findOne({}).select("googleMapKey").lean().exec();
  let routeDetails = null;
  try {
    routeDetails = await googleRoute(points, String(admin && admin.googleMapKey || "").trim());
  } catch (_googleError) {
    routeDetails = null;
  }
  if (!routeDetails || !routeDetails.encoded_polyline) {
    const osrmServices = [
      "https://router.project-osrm.org",
      "https://routing.openstreetmap.de/routed-car"
    ];
    for (const serviceUrl of osrmServices) {
      try {
        routeDetails = await osrmRoute(points, serviceUrl);
      } catch (_osrmError) {
        routeDetails = null;
      }
      if (routeDetails && routeDetails.encoded_polyline) {
        break;
      }
    }
  }
  if (!routeDetails || !routeDetails.encoded_polyline) {
    throw new Error("No driving route was found");
  }
  return routeDetails;
}

async function getRoadRoute(payload) {
  return (await getRoadRouteDetails(payload)).encoded_polyline;
}

module.exports = {
  getRoadRouteDetails,
  getRoadRoute,
  validCoordinate
};
