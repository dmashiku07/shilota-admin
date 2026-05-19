let JwtStrategy = require("passport-jwt").Strategy,
  ExtractJwt = require("passport-jwt").ExtractJwt;
// load up the user model
let User = require("./schema/user");
let config = require("./config");
module.exports = function(passport) {
  let opts = {};
  opts.jwtFromRequest = ExtractJwt.fromAuthHeaderWithScheme("JWT");
  opts.secretOrKey = config.secret;
  passport.use(
    new JwtStrategy(opts, function(jwt_payload, done) {
      const userId = jwt_payload && (jwt_payload._id || jwt_payload.id || jwt_payload.sub);
      if (!userId) {
        return done(null, false);
      }
      User.findById(userId, function(err, user) {
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
