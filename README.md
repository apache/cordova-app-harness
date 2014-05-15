cordova-app-harness
===================

An App that can download and run Cordova apps.

Primary Goals:
* Super-fast edit &amp; refresh workflow
  * E.g. have a `grunt watch` that pushes every time a file changes
  * E.g. have `livereload`-type functionality for CSS & images
* Test on devices without needing platform SDKs
  * E.g. develop for iOS on a Windows machine
  * Non-goal: Release to iOS from Windows

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
    * `org.apache.cordova.file-transfer`
    * `com.phonegap.plugins.barcodescanner` (optional - adds barcode scanning)

1. Clone the the `cordova-app-harness` repository.
1. Copy the `www` directory into the project:

        rm -r CordovaAppHarness/www
        cp -a cordova-app-harness/www CordovaAppHarness/www
        cordova prepare

1. Add any plugins that your apps might need.

## Features
* Install and launch via `cordova serve`
* Three-finger swipe to return to main menu

## Major Unimplemented Features
* Applying app settings (DisallowOverscroll, etc)
* Applying app splashscreen
* Applying app's whitelist
* Enabling only the plugins that the app has installed

## Major Unimplemented In-App Menu Features
* Inject a JSConsole script tag
* JSHybugger support
* Simulator-friendly menu gesture (shake gesture?)

## Test by using `cordova serve`
* Go to Cordova project of the app you want to test in a terminal and run.

      cordova serve <platform>

  * If you are running this on a simulator, you can use `http://localhost` as your address, or on Android `10.0.0.22`.
  * If `cordova serve` is on a different network than your App Harness, then use [ProxyLocal](http://proxylocal.com/) or [LocalTunnel](http://progrium.com/localtunnel/) to forward the port.

## Running an app in the harness
* Click launch on the installed app
* See if the app looks as expected
* Use a 3 finger swipe to access the app menu while testing your app.
* The context menu that pops up allows you to return to the main screen, restart or update the app, open a Firebug console on the device, or set up remote debugging using Weinre.

# Harness Server

A server runs within the app that enables remote control functionality.

## Port Forwarding (Android)

If you are not on the same network, you can use adb to port forward:

    adb forward tcp:2424 tcp:2424

## Commands

### /push

Add or update an app's settings, and then update & launch:

    curl -X POST http://$IP_ADDRESS:2424/push?type=serve&name=com.example.YourApp&url=http://$SERVE_HOST_ADDRESS:8000


### /menu

Return to main menu:

    curl -X POST http://$IP_ADDRESS:2424/menu

### /exec

Executes a JS snippet:

    curl -X POST http://$IP_ADDRESS:2424/exec?code='alert(1)'

### /info

Returns JSON of server info / app state

    curl http://$IP_ADDRESS:2424/info

