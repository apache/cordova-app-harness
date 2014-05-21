# harness-push

A node module & command-line tool for controlling the Cordova App Harness.

# Usage:

For usage, run:

   harness-push.js --help

## Port Forwarding (Android)

If are connected via `adb`, you can port forward via:

    adb forward tcp:2424 tcp:2424

## Port Forwarding (iOS)

TODO: Should be possible to port forward via usbmuxd (as described [here](http://www.oodlestechnologies.com/blogs/Data-transfer-to-iOS-devices-from-PC-using-USB-cable--(using-USB-Multiplex-Daemon))
