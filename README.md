cordova-app-harness
===================

An App harness for Cordova that can download and run Cordova apps as well as Chrome packaged apps. This enables an edit &amp; refresh workflow. Also enables local development of apps without needing the Android / iOS SDK.

##Setting up environment

**Very important**: At this time, only the android section is implemented and tested

*   Clone the the cordova-app-harness, cordova-android, cordova-ios, cordova-js, plugman, cordova-cli, zip(https://github.com/MobileChromeApps/zip) and chrome-cordova repos into folders of the same name in a common directory - eg 'Repo'. (Note the chrome-cordova repo is required only if you intend to run chrome apps in the harness as well)
*   Use the future branch of plugman and cordova-cli
*   Link these plugman and cordova-cli of this branch as the globally symlinked plugman and cordova-cli commands. (You may want to see 'npm link')
*   Build the cordova-js repo and grab the cordova.android.js and cordova.ios.js
*   Note this project uses a slightly modified version of cordova.android.js and cordova.ios.js
*   Replace the cordova-cli/lib/cordova-android/framework/assets/js/cordova.android.js and the cordova-cli/lib/cordova-ios/CordovaLib/cordova.ios.js files with the ones above
*   Build the cordova-android repository and generate new cordova.jar
*   Run the following commands

        cordova create CordovaAppHarness
        cd CordovaAppHarness
        cordova platform add android
        cordova platform add ios
        cordova plugin add ../Repo/cordova-app-harness/plugins/CordovaAppHarnessPlugin
        cordova plugin add ../Repo/zip/
        cordova plugin add ../Repo/chrome-cordova/plugins/*
        cp -rf ../Repo/cordova-app-harness/www app/www
        cp -rf ../Repo/cordova-app-harness/hooks .cordova/hooks
        cordova prepare

*   Get a copy of the google-play-services.jar
*   Put the cordova.jar and the google-play-services.jar in the CordovaAppHarness/platforms/android/libs folder. (Note you may want to link the cordova-android project directly instead of adding a built jar so you can easily make changes to cordova-android and test the app harness)
*   Replace the contents of CordovaAppHarness/platforms/ios/CordovaLib with /Repo/cordova-ios/CordovaLib
*   Go to eclipse and got to new, other, android, android project from existing code. Navigate to CordovaAppHarness/platforms/android and then add the project
*   Double click the  .xcodeproj file in CordovaAppHarnessNew/platforms/ios/
*   You can now build the app harness from the ides or with cordova compile

##Using the app

*   Run the app harness (works in android only currently)
*   Click add new app
*   Give a name and a url to a zip. The zip should contain a www directory with a index.html file as the start page
*   Go back to the main screen after you see the prompt "successfully installed"
*   Click launch on the newly installed app
*   See if the app looks as expected
*   Use the 3 finger tap to access the app menu while testing your app
*   Press Back to Main Menu to return to the main screen
