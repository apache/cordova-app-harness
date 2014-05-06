# App Harness Push

Allows pushing updates of apps to the App Harness via HTTP. Works only for Android for now.

## Use

There are currently four kinds of requests you can make:

## Port Forwarding

If you are not on the same network, you can use adb to port forward:

    adb forward tcp:2424 tcp:2424

When done:

    adb forward --remove tcp:2424

### Push - `cordova serve`

Make a `POST` request on port 2424 to:

    /push?type=serve&name=com.example.YourApp&url=http://192.168.1.101:8000

and this will cause the App Harness to return to the main menu, and fetch the app from `cordova serve`.

### Menu - Return to the App Harness menu

Sometimes, especially on emulators, it's hard or impossible to do the three-point touch that triggers the App Harness context menu. Sending a `POST` request on port 2424 to `/menu` will return to the App Harness main menu.

### Exec - Run arbitrary Javascript

This allows the sending of arbitrary Javascript. This is useful for debugging and may be removed later. Contact us with any interesting use-cases for this endpoint.

    /exec?code=location='file:///android_asset/www/someotherpage.html'

