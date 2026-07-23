// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses `environment.ts`, but if you do
// `ng build --env=prod` then `environment.prod.ts` will be used instead.
// The list of which env maps to which file can be found in `.angular-cli.json`.

declare const window: any;

const runtimeConfig = window.__shilotaConfig || {};
const runtimeFirebase = runtimeConfig.firebase || {};
const runtimeFeatureFlags = runtimeConfig.featureFlags || {};

export const environment = {
  production: true,
  enablePhoneVerification: String(runtimeConfig.enablePhoneVerification || "true") === "true",
  domain: "",
  apiUrl: runtimeConfig.apiUrl || "https://shilota.tz:3000",
  socketUrl: runtimeConfig.socketUrl || "https://shilota.tz:8081",
  googleapiKey: runtimeConfig.googleapiKey || "REPLACE_GOOGLE_MAPS_API_KEY",
  googleloginClientid: runtimeConfig.googleloginClientid || "REPLACE_GOOGLE_LOGIN_CLIENT_ID",
  facebookloginClientid: "",
  featureFlags: {
    commission_enabled: String(runtimeFeatureFlags.commission_enabled || "false") === "true",
    driver_subscriptions_enabled:
      String(runtimeFeatureFlags.driver_subscriptions_enabled || "true") === "true",
    driver_pricing_enabled: String(runtimeFeatureFlags.driver_pricing_enabled || "true") === "true",
    passenger_price_broadcast_enabled:
      String(runtimeFeatureFlags.passenger_price_broadcast_enabled || "true") === "true",
    driver_destination_broadcast_enabled:
      String(runtimeFeatureFlags.driver_destination_broadcast_enabled || "true") === "true"
  },
  firebase: {
    apiKey: runtimeFirebase.apiKey || "REPLACE_FIREBASE_API_KEY",
    authDomain: runtimeFirebase.authDomain || "REPLACE_FIREBASE_AUTH_DOMAIN",
    databaseURL: runtimeFirebase.databaseURL || "REPLACE_FIREBASE_DATABASE_URL",
    projectId: runtimeFirebase.projectId || "REPLACE_FIREBASE_PROJECT_ID",
    storageBucket: runtimeFirebase.storageBucket || "REPLACE_FIREBASE_STORAGE_BUCKET",
    messagingSenderId: runtimeFirebase.messagingSenderId || "REPLACE_FIREBASE_MESSAGING_SENDER_ID",
    appId: runtimeFirebase.appId || "REPLACE_FIREBASE_APP_ID",
    measurementId: runtimeFirebase.measurementId || "REPLACE_FIREBASE_MEASUREMENT_ID"
  }
};
