# cordova-harness-push

Command-line tool for controlling the Cordova App Harness.

# Usage:

For usage, run:

   harness-push.js --help

## Port Forwarding (Android)

If are connected via `adb`, you can port forward via:

    adb forward tcp:2424 tcp:2424

## Port Forwarding (iOS)

Download tcprelay.py from: https://github.com/chid/tcprelay
Then run:

    python tcprelay.py 2424:2424
