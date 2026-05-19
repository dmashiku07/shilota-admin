let JwtStrategy = require("passport-jwt").Strategy,
  ExtractJwt = require("passport-jwt").ExtractJwt;
// load up the user model
let User = require("./schema/driver");
let config = require("./config");
module.exports = function(passport) {
  let opts = {};
  opts.jwtFromRequest = ExtractJwt.fromAuthHeaderWithScheme("JWT");
  opts.secretOrKey = config.secret;
  passport.use(
    new JwtStrategy(opts, function(jwt_payload, done) {
      const driverId =
        jwt_payload &&
        ((jwt_payload.data && jwt_payload.data._id) ||
          jwt_payload._id ||
          jwt_payload.id ||
          jwt_payload.sub);
      if (!driverId) {
        return done(null, false);
      }
      User.findOne({ _id: driverId, deletion_status: 0 }, function(err, user) {
        if (err) {
          return done(err, false);
        }
        if (user) {
          done(null, user);
        } else {
          done(null, false);
        }
      });
    })
  );
};
