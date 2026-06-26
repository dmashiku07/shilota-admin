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
let port = process.env.PORT || config.socketPort;

/** schemas */
let User = require("../schema/user");
let Driver = require("../schema/driver");
let Rides = require("../schema/rides");
let Admin = require("../models/admin");
let Categories = require("../schema/categories");
let Commissions = require("../schema/commissions");
const googledistance = require('google-distance');
const socketRegistry = require("../socketRegistry");

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

  console.log("user Connected");
  /* share driver instant location */
  socket.on('sharelocation', function (data) {
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
      // console.log("sharing location" + data.location);
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
    let room = io.sockets.adapter.rooms.get(roomId);
    if (room && room.size > 1) {
      io.to(roomId).emit("call-ready", {
        room_id: roomId
      });
    }
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
