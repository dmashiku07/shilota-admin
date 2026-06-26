var express = require('express'),
  path = require('path'),
  bodyParser = require('body-parser'),
  cors = require('cors'),
  http = require('http'),
  https = require('https'),
  fs = require("fs"),
  mongoose = require('mongoose'),
  passport = require('passport'),
  admin = require('./server/routes/user'),
  config = require('./server/config'),
  multer = require('multer'),
  pageRoutes = require('./server/routes/helpPage'),
  bannerRoutes = require('./server/routes/bannerRoutes'),
  homeRoutes = require('./server/routes/homeRoutes'),
  faqRoutes = require('./server/routes/faqRoutes'),
  nodeMailer = require('nodemailer'),
  bodytypes = require('./server/routes/bodytypeRoutes'),
  amenities = require('./server/routes/amenitiesRoutes'),
  category = require('./server/routes/categoryRoutes'),
  driver = require('./server/routes/driverRoutes'),
  tax = require('./server/routes/commissionsRoutes'),
  user = require('./server/routes/usermanagementRoutes'),
  payment = require('./server/routes/paymentRoutes'),
  vehicle = require('./server/routes/vehicleManagement'),
  rides = require('./server/routes/ridesManagement'),
  settlement = require('./server/routes/settlementRoutes'),
  cetsRoutes = require('./server/routes/cetsRoutes'),
  safetyRoutes = require('./server/routes/safetyRoutes');

var api = require('./server/apiroutes/api');
var driverapi = require('./server/apiroutes/driverapi');
var chat = require('./server/apiroutes/chat');
var cetsSyncService = require('./server/services/cetsSyncService');
var logger = require('morgan');


// var ejs = require('ejs');


const app = express();
const distRoot = path.join(__dirname, 'dist');
const distShilotaRoot = path.join(__dirname, 'dist', 'shilota');
const distIndex = path.join(distRoot, 'index.html');
const distShilotaIndex = path.join(distShilotaRoot, 'index.html');
const srcIndex = path.join(__dirname, 'src', 'index.html');
const noCachePrefixes = [
  '/admin',
  '/page',
  '/home',
  '/banner',
  '/faqroutes',
  '/bodytype',
  '/amenities',
  '/category',
  '/user',
  '/driverRoutes',
  '/vehicleRoutes',
  '/rides',
  '/api',
  '/driverapi',
  '/chat',
  '/tax',
  '/payment',
  '/settlement',
  '/cets',
  '/safety'
];

app.disable('etag');
app.use(bodyParser.urlencoded({
  'extended': 'true'
}));
app.use(bodyParser.json());
app.use(cors());
const port = process.env.PORT || config.apiPort;

app.use(cors());
app.use(passport.initialize());
//app.use(logger('dev')); /* View logs */
app.use(passport.session());
app.use(function (req, res, next) {
  if (noCachePrefixes.some(prefix => req.path.startsWith(prefix))) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
  }
  next();
});

require('./server/passport')(passport);
app.use('/admin', admin);
app.use('/page', pageRoutes);
app.use('/home', homeRoutes);
app.use('/banner', bannerRoutes);
app.use('/faqroutes', faqRoutes);
app.use('/bodytype', bodytypes);
app.use('/amenities', amenities);
app.use('/category', category);
app.use('/user', user);
app.use('/driverRoutes', driver);
app.use('/vehicleRoutes', vehicle);
app.use('/rides', rides);
app.use('/gallery', express.static(__dirname + '/src/assets/media'));
app.use('/imagegallery', express.static(__dirname + '/src/assets/uploads'));
app.get('/assets/runtime-config.local.js', function (_req, res) {
  const runtimeConfigPath = path.join(__dirname, 'src', 'assets', 'runtime-config.local.js');
  return res.type('application/javascript').sendFile(runtimeConfigPath);
});
app.use('/api', api);
app.use('/driverapi', driverapi);
app.use('/chat', chat);
app.use('/tax', tax);
app.use('/payment', payment);
app.use('/settlement', settlement);
app.use('/safety', safetyRoutes);
app.use('/', cetsRoutes);
cetsSyncService.initializeSchedulers();
app.use(express.static(distRoot));
app.use(express.static(distShilotaRoot));
app.use(express.static(__dirname + '/src'));

// app.set('view engine', 'ejs');
// app.set('views', path.join(__dirname, 'views'));
// app.engine('html', require('ejs').renderFile);
// app.set('view engine', 'html');

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('*', (req, res) => {
  if (fs.existsSync(distIndex)) {
    return res.sendFile(distIndex);
  }
  if (fs.existsSync(distShilotaIndex)) {
    return res.sendFile(distShilotaIndex);
  }
  if (fs.existsSync(srcIndex)) {
    return res.sendFile(srcIndex);
  }
  return res.status(503).json({
    error: true,
    message: 'Frontend build not found. Run Angular build to generate dist output.'
  });
});

mongoose.Promise = global.Promise;
mongoose.set('useCreateIndex', true);
mongoose.set('useFindAndModify', false);
mongoose.connect(config.database, {
  useNewUrlParser: true,
  useUnifiedTopology: true 
}).then(
  () => {
    console.log('Database is connected')
  },
  err => {
    console.log('Can not connect to the database' + err)
  }
);

// error handler
app.use(function (err, req, res, next) {
  const status = err.status || 500;
  if (req.originalUrl && req.originalUrl.startsWith('/api')) {
    return res.status(status).json({
      error: true,
      message: err.message || 'Internal Server Error'
    });
  }
  return res.status(status).send(err.message || 'Internal Server Error');
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

/* EXPRESS SERVER CONNECTIVITY */
const httpsMode = config.httpsMode;
if (httpsMode === "disable") {
  const server = http.createServer(app);
  server.listen(port, () => console.log(`API Server is running on :${port}`));
} else {
  /* SSL CERTIFICATES */
  const privateKey = fs.readFileSync("/etc/letsencrypt/live/shilota.tz/privkey.pem");
  const certificate = fs.readFileSync("/etc/letsencrypt/live/shilota.tz/fullchain.pem");
  const ca = fs.readFileSync("/etc/letsencrypt/live/shilota.tz/fullchain.pem");
  const sslOptions = {
    key: privateKey,
    cert: certificate,
    ca: ca
  };
  const server = https.createServer(sslOptions, app);
  server.listen(port, () => console.log(`API Server is running on :${port}`));
}
