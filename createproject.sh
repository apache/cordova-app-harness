#!/bin/bash

if [[ $# -eq 0 || "$1" = "--help" ]]; then
    echo "Usage: $0 NewDirName"
    echo 'Options via variables:'
    echo '  PLATFORMS="android ios"'
    echo '  CORDOVA="path/to/cordova"'
    echo '  PLUGIN_SEARCH_PATH="path1:path2:path3"'
    exit 1
fi

CORDOVA="${CORDOVA-cordova}"
PLATFORMS="${PLATFORMS-android}"
DIR_NAME="${1}"
AH_PATH="$(cd $(dirname $0) && pwd)"
PLUGIN_SEARCH_PATH="${PLUGIN_SEARCH_PATH-$(dirname "$AH_PATH"):$(dirname "$AH_PATH")/cordova-plugins}"

"$CORDOVA" create "$DIR_NAME" org.apache.appharness CordovaAppHarness --link-to "$AH_PATH/www" || exit 1
cd "$DIR_NAME"
cp "$AH_PATH/config.xml" . || exit 1

set -x
$CORDOVA platform add $PLATFORMS || exit 1
set +x

# if [[ $PLATFORMS = *ios* ]]; then
    # ../../cordova-ios/bin/update_cordova_subproject platforms/ios/CordovaAppHarness.xcodeproj
# fi

echo Installing plugins.
"$CORDOVA" plugin add\
    "$AH_PATH/UrlRemap" \
    org.apache.cordova.file \
    org.apache.cordova.file-transfer \
    org.apache.cordova.device \
    org.chromium.zip \
    org.apache.cordova.file-system-roots \
    --searchpath="$PLUGIN_SEARCH_PATH"

# org.apache.cordova.device isn't used directly, but is convenient to test mobilespec.

if [[ $? != 0 ]]; then
    echo "Plugin installation failed. Probably you need to set PLUGIN_SEARCH_PATH env variable so that it contains the plugin that failed to install."
    exit 1
fi

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

# TODO: Add an option for installing grunt
exit 0
npm install grunt grunt-contrib-watch || exit 1

# $CORDOVA plugin add org.apache.cordova.device # Not used by harness, but used by mobile-spec.
# $CORDOVA plugin add https://github.com/wildabeast/BarcodeScanner.git # Optional

# cordova plugin add "https://git-wip-us.apache.org/repos/asf/cordova-plugins.git#:file-system-roots"

