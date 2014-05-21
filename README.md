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

Using a Unix environment, run:

    ./createproject.sh DirName
    cd DirName
    cordova plugin add PLUGINS_THAT_YOU_WANT

## Features
* Install and launch via `cordova serve`
* Control via http running within the app
* Use two-finger double-tap, or pinch towards middle to bring up in-app menu.

## Major Unimplemented Features
* Applying app settings (DisallowOverscroll, etc)
* Applying app splashscreen
* Applying app's whitelist

## Major Unimplemented In-App Menu Features
* Inject a JSConsole script tag
* JSHybugger support

## Test by using `cordova serve`
* Go to Cordova project of the app you want to test in a terminal and run.

      cordova serve <platform>

  * If you are running this on a simulator, you can use `http://localhost` as your address, or on Android `10.0.0.22`.
  * If `cordova serve` is on a different network than your App Harness, then use [ProxyLocal](http://proxylocal.com/) or [LocalTunnel](http://progrium.com/localtunnel/) to forward the port.

# Harness Server

A server runs within the app that enables remote control functionality.

Use [harness-push/harness-push.js](harness-push/README.md) to send commands to the App Harness.

