cordova-app-harness
===================

An wrapper app for Cordova that can download and run Cordova apps as well as
Chrome packaged apps. This enables an edit &amp; refresh workflow. Also enables
local development of apps without needing the Android / iOS SDK.

## Building the App Harness
* Create a new CLI app:

        cordova create CordovaAppHarness com.yourcompany.appharness CordovaAppHarness

* Add whichever platforms you want (currently only iOS and Android are supported by the underlying plugins: UrlRemap, zip):

        cordova platform add android ios

* Add the `zip` ([](https://github.com/MobileChromeApps/zip)) and `UrlRemap` (bundled in this repo) plugins to the project (`cordova plugin add ...`)
* If you want to be able to scan QR codes instead of typing URLs, add the `BarcodeScanner` ([](https://github.com/wildabeast/BarcodeScanner.git)) plugin.

* Clone the the `cordova-app-harness` repository.
* Copy the `www` directory into the project:

     rm -r CordovaAppHarness/www
     cp -a cordova-app-harness/www CordovaAppHarness/www

## Features
* Install and test multiple applications.
* In-App Menu to switch between installed apps.
* Firebug Lite and Weinre support for debugging.

## Major Unimplemented Installer Features
* Editing of URLs in the app list
* Incremental updates of `cordova serve` URLs (instead of re-downloading existing files)
* Install from `.crx` files
* Install from `.cdvh` files (created via packapp script)
* Detecting when an app requires a plugin that the harness doesn't have
* Detect version mismatches of app vs harness (report as warnings)

## Major Unimplemented Launcher Features
* Applying app settings (DisallowOverscroll, etc)
* Applying app splashscreen
* Applying app's whitelist
* Enabling only the plugins that the app has installed

## Major Unimplemented In-App Menu Features
* Inject a JSConsole script tag
* JSHybugger support

## Test by using `cordova serve`
* Go to Cordova project of the app you want to test in a terminal and run.

      cordova serve <platform>

  * If you are running this on a simulator, you can use `http://localhost` as your address, or on Android `10.0.0.22`.
  * If `cordova serve` is on a different network than your App Harness, then use [ProxyLocal](http://proxylocal.com/) or [LocalTunnel](http://progrium.com/localtunnel/) to forward the port.

## Running an app in the harness
* Click launch on the installed app
* See if the app looks as expected
* Use a 3 finger tap to access the app menu while testing your app.
* The context menu that pops up allows you to return to the main screen, restart or update the app, open a Firebug console on the device, or set up remote debugging using Weinre.
