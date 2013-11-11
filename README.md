cordova-app-harness
===================

An App that can download and run Cordova apps.

Primary Goals:
* Super-fast edit &amp; refresh workflow
* Test on devices without needing platform SDKs

## Building the App Harness

TLDR - using a Unix environment, run:

    ./createproject.sh

The manual way:

1. Create a new CLI app:

        cordova create CordovaAppHarness com.yourcompany.appharness CordovaAppHarness

1. Add whichever platforms you want (currently only iOS and Android are supported by the underlying plugins: UrlRemap, zip):

        cordova platform add android ios

1. Add the following plugins:

    * `org.apache.cordova.UrlRemap` (exists in the `UrlRemap` directory)
    * `org.apache.cordova.file`
    * `org.apache.cordova.file-extras` (exists in cordova-labs right now)
    * `org.apache.cordova.file-transfer`
    * `com.phonegap.plugins.barcodescanner` (optional - adds barcode scanning)

1. Clone the the `cordova-app-harness` repository.
1. Copy the `www` directory into the project:

        rm -r CordovaAppHarness/www
        cp -a cordova-app-harness/www CordovaAppHarness/www
        cordova prepare

1. Add any plugins that your apps might need.

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
