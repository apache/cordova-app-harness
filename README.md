cordova-app-harness
===================

---
📌 **Deprecation Notice**

This repository is deprecated and no more work will be done on this by Apache Cordova. You can continue to use this and it should work as-is but any future issues will not be fixed by the Cordova community.

Feel free to fork this repository and improve your fork. Existing forks are listed in [Network](../../network) and [Forks](../../network/members).

- Learn more: https://github.com/apache/cordova/blob/master/deprecated.md#deprecated-other
---

An App that can run Cordova apps within it.

Primary Goals:
* Super-fast edit &amp; refresh workflow
  * E.g. have a `grunt watch` that pushes every time a file changes
  * E.g. have `livereload`-type functionality for CSS & images
* Test on devices without needing platform SDKs
  * E.g. develop for iOS on a Windows machine
  * Non-goal: Release to iOS from Windows

# How to use it:
1. Run the app on a device or simulator
2. Push your app to it via the harness-push tool
3. Use two-finger double-tap to bring up in-app menu.

## Building the App Harness

Using a Unix environment, run:

    ./createproject.sh DirName
    cd DirName
    cordova plugin add PLUGINS_THAT_YOU_WANT

## Major Unimplemented Features
* Applying app settings (DisallowOverscroll, etc)
* Applying app splashscreen
* Applying app's whitelist

## Major Unimplemented In-App Menu Features
* Inject a JSConsole script tag
* Initiate a weinre session
* Suggestions welcome! :)

# Harness Server

A server runs within the app that enables remote control functionality.

Use [harness-push/harness-push.js](harness-push/README.md) to send commands to the App Harness.

