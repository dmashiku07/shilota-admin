const config = require("../config");
let express = require('express');
let router = express.Router();
let mongoose = require('mongoose');
let app = express();
let fs = require("fs");
let server;

/* EXPRESS SERVER CONNECTIVITY */
const httpsMode = config.httpsMode;
server = require("http").createServer(app);
if (httpsMode === "enable") {
  const privateKey = fs.readFileSync("/etc/letsencrypt/live/shilota.tz/privkey.pem");
  const certificate = fs.readFileSync("/etc/letsencrypt/live/shilota.tz/fullchain.pem");
  const ca = fs.readFileSync("/etc/letsencrypt/live/shilota.tz/fullchain.pem");
  /* SSL CERTIFICATES */
  const sslOptions = {
    key: privateKey,
    cert: certificate,
    ca: ca
  };
  server = require("https").createServer(sslOptions, app);
}

let io = require('socket.io')(server);
// The API may use PORT for its HTTP listener. Signaling must always bind its
// dedicated socket port so nginx's /socket.io/ upstream remains available.
let port = config.socketPort;

/** schemas */
let User = require("../schema/user");
let Driver = require("../schema/driver");
let Rides = require("../schema/rides");
let Admin = require("../models/admin");
let Categories = require("../schema/categories");
let Commissions = require("../schema/commissions");
const googledistance = require('google-distance');
const socketRegistry = require("../socketRegistry");
const jwt = require("jsonwebtoken");

const TRACKABLE_RIDE_STATUSES = ["accepted", "ontheway", "onride", "arrived"];
const rideLocationRoom = function (rideId) {
  return "ride-location:" + String(rideId);
};

function sendSocketError(socket, code, message) {
  socket.emit("ride-location-error", { code: code, message: message });
}

function authenticatedSocketIdentity(socket, payload) {
  const token = String(
    (payload && payload.auth_token) ||
      (socket.handshake.query && socket.handshake.query.auth_token) ||
      ""
  ).trim().replace(/^JWT\s+/i, "");
  if (!token) {
    return null;
  }
  try {
    const decoded = jwt.verify(token, config.secret);
    const userId = String(
      (decoded && decoded.data && decoded.data._id) ||
        (decoded && decoded._id) ||
        (decoded && decoded.id) ||
        (decoded && decoded.sub) ||
        ""
    ).trim();
    const role = String((decoded && decoded.role) || "").trim();
    return userId ? { userId: userId, role: role } : null;
  } catch (_error) {
    return null;
  }
}

function parseCoordinate(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/* check nodejs working*/
server.listen(port, function () {
  //console.log('Server listening at port %d', port);
});

/* socket connection */
io.sockets.on('connection', function (socket) {
  let registeredUserId = String(socket.handshake.query.user_id || "").trim();

  if (registeredUserId) {
    socketRegistry.registerSocket(registeredUserId, socket);
  }

  socket.on("register-user", function (data) {
    let nextUserId = String(data && data.user_id ? data.user_id : "").trim();
    if (!nextUserId) {
      return;
    }
    if (registeredUserId && registeredUserId !== nextUserId) {
      socketRegistry.unregisterSocket(registeredUserId, socket);
    }
    registeredUserId = nextUserId;
    socketRegistry.registerSocket(registeredUserId, socket);
  });

  // The legacy `sharelocation` event is retained for backwards compatibility
  // with the online-driver map. Assigned-ride tracking uses the authenticated,
  // ride-bound events below instead and never trusts a client-provided driver id.
  socket.on("watch-ride-location", function (data) {
    const identity = authenticatedSocketIdentity(socket, data);
    const rideId = String(data && data.ride_id ? data.ride_id : "").trim();
    if (!identity || identity.role !== "user" || !rideId) {
      return sendSocketError(socket, "UNAUTHORIZED", "Unable to watch this ride location.");
    }
    Rides.findOne({ _id: rideId, user_id: identity.userId })
      .populate("driver_id")
      .exec(function (error, ride) {
        if (error || !ride || !ride.driver_id || !TRACKABLE_RIDE_STATUSES.includes(String(ride.ridestatus || ""))) {
          return sendSocketError(socket, "RIDE_NOT_TRACKABLE", "This ride is not available for live tracking.");
        }
        socket.join(rideLocationRoom(ride._id));
        const lat = parseCoordinate(ride.driver_id.instant_lat);
        const lng = parseCoordinate(ride.driver_id.instant_lng);
        if (lat === null || lng === null) {
          return;
        }
        socket.emit("ride-driver-location", {
          ride_id: String(ride._id),
          lat: lat,
          lng: lng,
          recorded_at: new Date().toISOString()
        });
      });
  });

  socket.on("unwatch-ride-location", function (data) {
    const identity = authenticatedSocketIdentity(socket, data);
    const rideId = String(data && data.ride_id ? data.ride_id : "").trim();
    if (!identity || identity.role !== "user" || !rideId) {
      return;
    }
    socket.leave(rideLocationRoom(rideId));
  });

  socket.on("share-ride-location", function (data) {
    const identity = authenticatedSocketIdentity(socket, data);
    const rideId = String(data && data.ride_id ? data.ride_id : "").trim();
    const lat = parseCoordinate(data && data.lat);
    const lng = parseCoordinate(data && data.lng);
    if (!identity || identity.role !== "driver" || !rideId || lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return sendSocketError(socket, "INVALID_LOCATION_UPDATE", "Unable to update the ride location.");
    }

    Rides.findOne({
      _id: rideId,
      driver_id: identity.userId,
      ridestatus: { $in: TRACKABLE_RIDE_STATUSES }
    }).exec(function (rideError, ride) {
      if (rideError || !ride) {
        return sendSocketError(socket, "RIDE_NOT_TRACKABLE", "This ride is not available for live tracking.");
      }
      Driver.findByIdAndUpdate(identity.userId, {
        $set: {
          instant_lat: String(lat),
          instant_lng: String(lng),
          instant_location: String((data && data.location) || "")
        }
      }).exec(function (driverError) {
        if (driverError) {
          return sendSocketError(socket, "LOCATION_SAVE_FAILED", "Unable to save the ride location.");
        }
        io.to(rideLocationRoom(ride._id)).emit("ride-driver-location", {
          ride_id: String(ride._id),
          lat: lat,
          lng: lng,
          recorded_at: new Date().toISOString()
        });
      });
    });
  });

  console.log("user Connected");
  /* share driver instant location */
  socket.on('sharelocation', function (data) {
    console.log('sharelocation received:', data);
    var result = {
      loc: [data.lng, data.lat],
      instant_lat: data.lat,
      instant_lng: data.lng,
      instant_location: data.location
    };
    Driver.findOneAndUpdate({
      _id: data.user_id
    }, {
      "$set": result
    }).exec(function (err, users) {
      if (err) {
        console.error('sharelocation database error:', err);
        return;
      }

      if (!users) {
        console.warn('sharelocation driver not found:', data.user_id);
        return;
      }

      console.log('sharelocation updated driver:', users._id);
    });
  });

  /* rides details */
  socket.on('whereareyou', function (data) {
    let querystring = {
      _id: data.onride_id
    };
    Rides.findOne(querystring).populate('driver_id').
    exec(function (err, rides) {
      
      if (!rides) {
        //senderr(res);
      } else {
        let ridesresult = {};
        ridesresult.instant_lan = rides.driver_id.instant_lat;
        ridesresult.instant_lng = rides.driver_id.instant_lng;
        ridesresult.ridestatus = rides.ridestatus;
        socket.emit('iamhere', ridesresult);
      }
    });
  });

  /* grab nearby  10 s*/
  socket.on('cabneargo', function (data) {
    let lng = parseFloat(data.lng);
    let lat = parseFloat(data.lat);
    let categoryid = data.category_id;
    Admin.findOne(function (err, admin) {
      /* maximum distance coverage */
      let maxdistcoverage = parseInt(admin.distancePerCab);
      let query = Driver.aggregate([{
          "$geoNear": {
            "near": {
              "type": "Point",
              "coordinates": [lng, lat]
            },
            "maxDistance": maxdistcoverage * 1000,
            "spherical": true,
            "distanceField": "distance",
            "query": {
              "live_status": "1",
              "approval": "1",
              "category_id": categoryid
            },
          }
        },
        {
          "$sort": {
            "distance": 1
          }
        },
      ]);
      query.exec(function (err, driver) {
        if (err) {
          //senderr(res);
          //console.log("Error" + err);
        } else {
          if (driver.length == '0') {
            //senderr(res);
            //console.log("No driver in the socket");
          } else {
            let nearbycategories = [];
            driver.forEach(function (c) {
              nearbycategories.push({
                id: c._id,
                category_name: c.category_name,
                image: c.image,
                lat: c.instant_lat,
                lng: c.instant_lng,
              });
            });
            socket.emit('cabnearby', nearbycategories);
          }
        }
      });
    });
  });

  socket.on("join-call", function (data) {
    let roomId = String(data && data.room_id ? data.room_id : "").trim();
    if (!roomId) {
      return;
    }
    socket.join(roomId);
    // Joining means the call screen is listening, not that the receiver has
    // accepted. Only ready-call may start SDP negotiation.
    socket.emit("call-joined", { room_id: roomId });
  });

  socket.on("ready-call", function (data) {
    let roomId = String(data && data.room_id ? data.room_id : "").trim();
    if (!roomId) {
      return;
    }
    socket.to(roomId).emit("call-ready", data || {});
  });

  socket.on("rtcmessage", function (data) {
    let roomId = String(data && data.room_id ? data.room_id : "").trim();
    if (!roomId) {
      return;
    }
    socket.to(roomId).emit("rtcmessage", data || {});
  });

  socket.on("bye", function (data) {
    let roomId = "";
    if (typeof data === "string") {
      roomId = data.trim();
    } else {
      roomId = String(data && data.room_id ? data.room_id : "").trim();
    }
    if (!roomId) {
      return;
    }
    io.to(roomId).emit("bye", {
      room_id: roomId
    });
    socket.leave(roomId);
  });

  socket.on("disconnect", function () {
    if (registeredUserId) {
      socketRegistry.unregisterSocket(registeredUserId, socket);
    }
  });
});

module.exports = router;
