cordova-app-harness
===================

An wrapper app for Cordova that can download and run Cordova apps as well as Chrome packaged apps. This enables an edit &amp; refresh workflow. Also enables local development of apps without needing the Android / iOS SDK.

## Building the App Harness

* Install `plugman` and `cordova-cli`.
* Create a new CLI app:

        cordova create CordovaAppHarness com.yourcompany.appharness CordovaAppHarness

* Add whichever platforms you want:

        cordova platform add android ios

* Add the `zip` ([](https://github.com/MobileChromeApps/zip)) and `AppBundle` ([](https://github.com/MobileChromeApps/AppBundle)) plugins to the project (`cordova plugin add ...`).
* If you want to support Chrome apps, also add the `MobileChromeApps` `chrome-bootstrap` plugin, and any other Chrome APIs you want to support (`socket`, `identity`, etc.).
    * After each `cordova prepare`, you'll have to edit the `config.xml` on each platform to remove the new `<content>` tag that looks like this:

            <content src="chrome-extension://some_junk_here/chromeapp.html" />

* Clone the the `cordova-app-harness` repository.
* Copy the `www` directory into the project:

     cp -a cordova-app-harness/www CordovaAppHarness/www

* Run `cordova prepare`.
* Remove all `<content>` tags in `platforms/android/res/xml/config.xml`, and add:

        <content src="cdvah_index.html" />

* Remove all `<content>` tags in `platforms/ios/CordovaAppHarness/config.xml`, and add:

        <content src="cdvah_index.html" />

* Also ensure the `config.xml` for iOS has the tags

        <access origin="app-bundle://*" />
        <access origin="chrome-extension://*" />

* Now you can build the AppHarness with Eclipse/Xcode or `cordova compile`. Don't run `cordova build`, and if you run `cordova prepare` make sure you redo the above edits to the `<content>` tags.

##Features

*   Install and test multiple applications.
*   Install `.crx` files directly or from the Chrome Web Store.
*   In-app context menu to switch between child apps.
*   Firebug Lite and Weinre support for debugging.

##Install an app in the harness

There are two ways to install an app, detailed below.

###Test by installing the app on the phone through app harness

*   Run the `packapp` script and point it to a Cordova project of the app you want to test. This will package the app into a `.cdvh` file. (Note: it is expected that you have added all relevant platforms. For example, if you want to test on the iPhone, you need to have added the `ios` platform to the project.)

        Repo/cordova-app-harness/packapp -p ./TestApp TestApp.cdvh

*   Upload the the `cdvh` file onto any hosting site.
*   Run the app harness
*   Click the "Add" button.
*   Give the app a name and enter the URL to the `cdvh` file.

        Name: App1
        URL to file: http://www.somesite.com/myapp.cdvh

###Test by installing a chrome extension
*   Upload the the crx file onto any hosting site or the chrome apps store.
*   Run the app harness
*   Click add new app
*   Give a name and the url to the crx file.

        Name: App1
        URL to file: http://www.somesite.com/myapp.crx


Alternately you can use the URL of an app in the Chrome Web Store, for example `https://chrome.google.com/webstore/detail/appName/appid`.

### Test by using `cordova serve`

*   Go to Cordova project of the app you want to test in a terminal and run.

        cordova prepare
        cordova serve <platform>

*   If you want to test the app in an actual device, find the network address of your computer by running

        ifconfig

*   If you are running this on a simulator, you can use `http://localhost` as your address, or on Android `10.0.0.22`.
*   Click the "Add" button.
*   Choose the option "Enter the URL to the server hosting the app"
*   Give a name and the URL as follows. Let's assume the network address discovered above is `a.b.c.d`.

        Name: App1
        URL to server: http://a.b.c.d:8000/config.xml


##Running an app in the harness

*   Click launch on the installed app
*   See if the app looks as expected
*   Use a 3 finger tap to access the app menu while testing your app. This is unfortunately challenging in simulators.
*   The context menu that pops up allows you to return to the main screen, restart or update the app, open a Firebug console on the device, or set up remote debugging using Weinre.
