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
  reporting = require('./server/routes/reportingRoutes'),
  subscriptionPlans = require('./server/routes/subscriptionPlanRoutes'),
  subscriptions = require('./server/routes/subscriptionRoutes'),
  vehicle = require('./server/routes/vehicleManagement'),
  rides = require('./server/routes/ridesManagement'),
  settlement = require('./server/routes/settlementRoutes'),
  cetsRoutes = require('./server/routes/cetsRoutes'),
  safetyRoutes = require('./server/routes/safetyRoutes'),
  driverSubscriptionService = require('./server/services/driverSubscriptionService'),
  passengerSubscriptionService = require('./server/services/passengerSubscriptionService');

var api = require('./server/apiroutes/api');
var driverapi = require('./server/apiroutes/driverapi');
var chat = require('./server/apiroutes/chat');
var cetsSyncService = require('./server/services/cetsSyncService');
var logger = require('morgan');


// var ejs = require('ejs');


const app = express();
const adminDistRoot = path.join(__dirname, 'dist', 'shilota');
const adminDistIndex = path.join(adminDistRoot, 'index.html');
const mediaRoot = path.join(__dirname, 'src', 'assets', 'media');
const uploadsRoot = path.join(__dirname, 'src', 'assets', 'uploads');
const apiAssetsRoot = path.join(__dirname, 'src', 'assets');
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
  '/reporting',
  '/subscription-plans',
  '/subscriptions',
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

app.get('/healthz', function (_req, res) {
  const databaseReady = mongoose.connection.readyState === 1;
  return res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'ok' : 'unavailable'
  });
});

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
app.use('/gallery', express.static(mediaRoot));
app.use('/imagegallery', express.static(uploadsRoot));
app.use('/api', api);
app.use('/api/admin', admin);
app.use('/api/page', pageRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/banner', bannerRoutes);
app.use('/api/faqroutes', faqRoutes);
app.use('/api/bodytype', bodytypes);
app.use('/api/amenities', amenities);
app.use('/api/category', category);
app.use('/api/user', user);
app.use('/api/driverRoutes', driver);
app.use('/api/vehicleRoutes', vehicle);
app.use('/api/rides', rides);
app.use('/api/gallery', express.static(mediaRoot));
app.use('/api/imagegallery', express.static(uploadsRoot));
app.use('/api/assets', express.static(apiAssetsRoot));
app.use('/api/api', api);
app.use('/driverapi', driverapi);
app.use('/api/driverapi', driverapi);
app.use('/chat', chat);
app.use('/api/chat', chat);
app.use('/tax', tax);
app.use('/api/tax', tax);
app.use('/payment', payment);
app.use('/api/payment', payment);
app.use('/reporting', reporting);
app.use('/api/reporting', reporting);
app.use('/subscription-plans', subscriptionPlans);
app.use('/api/subscription-plans', subscriptionPlans);
app.use('/subscriptions', subscriptions);
app.use('/api/subscriptions', subscriptions);
app.use('/settlement', settlement);
app.use('/api/settlement', settlement);
app.use('/safety', safetyRoutes);
app.use('/api/safety', safetyRoutes);
app.use('/', cetsRoutes);
app.use('/api', cetsRoutes);
cetsSyncService.initializeSchedulers();
driverSubscriptionService.initializeSchedulers();
passengerSubscriptionService.initializeSchedulers();
app.use('/admin', express.static(adminDistRoot, {
  index: false
}));

// app.set('view engine', 'ejs');
// app.set('views', path.join(__dirname, 'views'));
// app.engine('html', require('ejs').renderFile);
// app.set('view engine', 'html');

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

function sendAdminIndex(_req, res) {
  if (fs.existsSync(adminDistIndex)) {
    return res.sendFile(adminDistIndex);
  }
  return res.status(503).json({
    error: true,
    message: 'Admin frontend build not found. Run npm run build:admin to generate dist/shilota.'
  });
}

app.get(['/admin', '/admin/'], sendAdminIndex);
app.get('/admin/*', (req, res, next) => {
  if (path.extname(req.path)) {
    return next();
  }
  return sendAdminIndex(req, res);
});

app.use(function (req, res) {
  if (req.originalUrl && req.originalUrl.startsWith('/api')) {
    return res.status(404).json({
      error: true,
      message: 'API route not found'
    });
  }
  return res.status(404).send('Not Found');
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
