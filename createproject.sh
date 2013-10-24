#!/bin/bash

CORDOVA=${CORDOVA-cordova}
PLATFORMS=${PLATFORMS-ios}

set -x
$CORDOVA create CordovaAppHarness org.apache.appharness CordovaAppHarness || exit 1
cd CordovaAppHarness

echo '
var cordova = require("../../cordova-cli/cordova");

module.exports = function(grunt) {
  // Simple config to run jshint any time a file is added, changed or deleted
  grunt.initConfig({
    watch: {
      files: ["www/**"],
      tasks: ["prepare"],
    },
  });
  grunt.loadNpmTasks("grunt-contrib-watch");

  grunt.registerTask("prepare", "Runs cdv prepare", function() {
    var done = this.async();
    cordova.prepare(function(e) {
      done(!e);
    });
  });

  // Default task(s).
  grunt.registerTask("default", ["watch"]);
};
' > Gruntfile.js
mkdir node_modules
npm install grunt grunt-contrib-watch

rm -r www
ln -s ../www www

$CORDOVA platform add $PLATFORMS || exit 1

if [[ $PLATFORMS = *ios* ]]; then
    ../../cordova-ios/bin/update_cordova_subproject platforms/ios/CordovaAppHarness.xcodeproj
fi

$CORDOVA plugin add ../UrlRemap
$CORDOVA plugin add ../../cordova-plugin-file
$CORDOVA plugin add ../../cordova-plugin-file-transfer
$CORDOVA plugin add ../../cordova-labs/file-extras
$CORDOVA plugin add https://github.com/wildabeast/BarcodeScanner.git # Optional
$CORDOVA plugin add ../../cordova-plugin-device # Not used by harness, but used by mobile-spec.
# Currently unused. Will want it for .cdvh .crx support.
# $CORDOVA plugin add ../../../mobile_chrome_apps/zip

exit 0

# optional plugins
for l in ../cordova-plugin-* ; do
  $CORDOVA plugin add "$l"
done

