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

## Port Forwarding (Android)

If you are not on the same network, you can use adb to port forward:

    adb forward tcp:2424 tcp:2424

And also use Chrome DevTool's [Reverse Port Forwarding](https://developers.google.com/chrome-developer-tools/docs/remote-debugging#reverse-port-forwarding):

    Map 8000 -> localhost:8000

## Commands

### /menu

Show in-app overlay menu.

    curl -v -X POST "http://$IP_ADDRESS:2424/menu"

### /exec

Executes a JS snippet:

    curl -v -X POST "http://$IP_ADDRESS:2424/exec?code='alert(1)'"

### /launch

Starts the app with the given ID (or the first app if none is given).

    curl -v -X POST "http://$IP_ADDRESS:2424/launch?appId=a.b.c"

### /info

Returns JSON of server info / app state

    curl -v "http://$IP_ADDRESS:2424/info"

### /assetmanifest

Returns JSON of the asset manifest for the given app ID (or the first app if none is given).

    curl -v "http://$IP_ADDRESS:2424/assetmanifest?appId=a.b.c"

### /prepupdate

Tell the interface that an update is in progress for the given app ID (or the first app if none is given).

    echo '{"transferSize": 100}' | curl -v -X POST -d @- "http://$IP_ADDRESS:2424/prepupdate?app=foo"

### /deletefiles

Deletes a set of files within the given app ID (or the first app if none is given).

    echo '{"paths":["www/index.html"]}' | curl -v -X POST -d @- "http://$IP_ADDRESS:2424/deletefiles?appId=a.b.c"

### /putfile

Updates a single file within the given app ID (or the first app if none is given).

    cat file | curl -v -X PUT -d @- "http://$IP_ADDRESS:2424/assetmanifest?appId=a.b.c&path=www/index.html&etag=1234"

### /deleteapp

Deletes the app with the given ID (or the first app if none is given).

    curl -v -X POST "http://$IP_ADDRESS:2424/deleteapp?appId=a.b.c"
    curl -v -X POST "http://$IP_ADDRESS:2424/deleteapp?all=true" # Delete all apps.
