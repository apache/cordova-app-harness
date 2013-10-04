#!/bin/bash

CORDOVA=${CORDOVA-cordova}

set -x
$CORDOVA create CordovaAppHarness org.apache.appharness CordovaAppHarness
cd CordovaAppHarness


echo '
var cordova = require('../../cordova-cli/cordova');

module.exports = function(grunt) {
  // Simple config to run jshint any time a file is added, changed or deleted
  grunt.initConfig({
    watch: {
      files: ['www/**'],
      tasks: ['prepare'],
    },
  });
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('prepare', 'Runs cdv prepare', function() {
    cordova.prepare();
  });

  // Default task(s).
  grunt.registerTask('default', ['watch']);
};
' > Gruntfile.js
mkdir node_modules
npm install grunt grunt-contrib-watch

rm -r www
ln -s ../www www
$CORDOVA platform add ios
../../cordova-ios/bin/update_cordova_subproject platforms/ios/CordovaAppHarness.xcodeproj

$CORDOVA plugin add ../../../mobile_chrome_apps/AppBundle
$CORDOVA plugin add ../../../mobile_chrome_apps/zip
$CORDOVA plugin add ../../../BarcodeScanner # https://github.com/wildabeast/BarcodeScanner.git
$CORDOVA plugin add ../../cordova-plugin-file
$CORDOVA plugin add ../../cordova-plugin-file-transfer


exit 0

# optional plugins
for l in ../cordova-plugin-* ; do
  $CORDOVA plugin add "$l"
done



