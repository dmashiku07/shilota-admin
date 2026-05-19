const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const User = require("./schema/user");
const Driver = require("./schema/driver");
const config = require("./config");
module.exports = function (passport) {
  try {
    let opts = {};
    opts.jwtFromRequest = ExtractJwt.fromAuthHeaderWithScheme("jwt");
    opts.secretOrKey = config.secret;
    passport.use(new JwtStrategy(opts, function (jwt_payload, done) {

      console.log(jwt_payload.role);

      if (jwt_payload.role === "user") {
        return User.findById(jwt_payload._id)
          .then(user => {
            if (user) {
              if (user.deletion_status === 1) {
                return done("AccountDeleted", false);
              }
              return done(null, user);
            }
            return done("Unauthorized", false);
          }
          ).catch(err => {
            return done("Unauthorized", false);
          });
      }
      else if (jwt_payload.role === "driver") {
        return Driver.findById(jwt_payload._id)
          .then(driver => {
            if (driver) {
              if (driver.deletion_status === 1) {
                return done("AccountDeleted", false);
              }
              return done(null, driver);
            }
            return done("Unauthorized", false);
          }
          ).catch(err => {
            return done("Unauthorized", false);
          });
      }
      else {
        return done("Unauthorized", false);
      }
    }));
  }
  catch (error) {
    return done("Unauthorized", false);
  }
};
