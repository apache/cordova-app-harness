cordova-app-harness
===================

An App harness for Cordova that can download and run Cordova apps as well as Chrome packaged apps. This enables an edit &amp; refresh workflow. Also enables local development of apps without needing the Android / iOS SDK.

##Setting up environment

*   Clone the the `cordova-app-harness`, `cordova-android`, `cordova-ios`, `cordova-js`, `chrome-cordova`, `plugman`, `cordova-cli`, `zip` ([](https://github.com/MobileChromeApps/zip)) and `AppBundle` ([](https://github.com/MobileChromeApps/AppBundle)) repos into folders of the same name in a common directory - eg 'Repo'.
*   Use the `future` branch for `cordova-cli` and `master` everywhere else
*   Link these `plugman` and `cordova-cli` of this branch as the globally symlinked `plugman` and `cordova-cli` commands. (You may want to see `npm link`)
*   Build the `cordova-js` repo and grab the `cordova.android.js` and `cordova.ios.js`
*   Replace the `cordova-cli/lib/cordova-android/framework/assets/js/cordova.android.js` and the `cordova-cli/lib/cordova-ios/CordovaLib/cordova.ios.js` files with the ones above
*   Build the `cordova-android` repository and generate new `cordova.jar`
*   Run the following commands

        cordova create CordovaAppHarness
        cd CordovaAppHarness
        cordova platform add android
        cordova platform add ios
        cordova plugin add ../Repo/AppBundle
        cordova plugin add ../Repo/zip/
        cordova plugin add ../Repo/chrome-cordova/plugins/*
        cp -rf ../Repo/cordova-app-harness/www app/www
        cordova prepare

*   Put the `cordova.jar` in the `CordovaAppHarness/platforms/android/libs` folder. (Note you may want to link the `cordova-android` project directly instead of adding a built jar so you can easily make changes to `cordova-android` and test the app harness)
*   Replace the contents of `CordovaAppHarness/platforms/ios/CordovaLib` with `/Repo/cordova-ios/CordovaLib`
*   Go to Eclipse and got to new, other, android, android project from existing code. Navigate to `CordovaAppHarness/platforms/android` and then add the project
*   Double click the  `.xcodeproj` file in `CordovaAppHarnessNew/platforms/ios/`
*   Ensure the `config.xml` for Android (Project Folder In IDE/res/xml/config.xml) and iOS (Project Folder In IDE/config.xml) have the content tag's `src` set to

        <content src="app-bundle:///cdvah_index.html" />

*   Remove the additional `content` tag added by the `chrome-cordova` plugins later in the file. The line to remove should be something like

        <content src="chrome-extension://sdfsdfdfssf/chromeapp.html" />

*   Ensure the config.xml for ios has the tags

        <access origin="app-bundle://*" />
        <access origin="chrome-extension://*" />

*   Open the `cordova_plugins.json` file in Eclipse and Xcode and ensure replace the contents with

        [{"file":"plugins/AppBundle/appBundle.js","id":"AppBundle.AppBundle"},{"file":"plugins/zip/zip.js","id":"zip.Zip","clobbers":["zip"]}]

*   You can now build the app harness from the IDEs or with `cordova compile`

##Features

*   Install and test multiple applications.
*   Install crx files directly or from the Chrome App Store.
*   Run apps locally or run them directly from `cordova serve`.
*   Edit and Refresh workflow with `cordova serve`.
*   In App context menu to switch between apps.
*   Firebug Lite and Weinre support for debugging.
*   Support for bundle paths such as `file:///android_asset/www` - These point to the tested application's bundle and not the app harness' bundle. (In development)

##Install an app in the harness

*   Install the app in one of the two ways below

###Test by installing the app on the phone through app harness
*   Run the `packapp` script and point it to a cordova project of the app you want to test. This will package the app into a `cdvh` file. (Note: it is expected that you have added all relevant platforms. For example, if you want to test on the iphone, you need to have added the ios platform to the project)

        Repo/cordova-app-harness/packapp -p ./TestApp TestApp.cdvh

*   Upload the the `cdvh` onto any hosting site.
*   Run the app harness
*   Click add new app
*   Give a name and the url to the cdvh file.

        Name: App1
        URL to file: http://www.somesite.com/myapp.cdvh

###Test by installing a chrome extension
*   Upload the the crx file onto any hosting site or the chrome apps store.
*   Run the app harness
*   Click add new app
*   Give a name and the url to the crx file.

        Name: App1
        URL to file: http://www.somesite.com/myapp.crx

*   Alternately you can use the url of the app in the apps store for example https://chrome.google.com/webstore/detail/appName/appid

###Test by using cordova serve
*   Go to cordova project of the app you want to test in a terminal and run.
        cordova prepare
        cordova serve <platform>
*   If you want to test the app in an actual device, find the network address of your computer by running
        ifconfig
*   If you are running this on a simulator, you can use `http://localhost` as your address
*   Click add new app
*   Choose the option "Enter the URL to the server hosting the app"
*   Give a name and the url as follows. Let's assume the network address discovered above is `a.b.c.d`

        Name: App1
        URL to server: http://a.b.c.d:8000/config.xml

*   Go back to the main screen after you see the prompt "successfully installed"

##Running an app in the harness
*   Click launch on the installed app
*   See if the app looks as expected
*   Use the 3 finger tap to access the app menu while testing your app
*   The context menu that pops up, will allow you to return to the main screen, restart or update the app, open a firebug console in the device, setup remote debugging using weinre etc.
