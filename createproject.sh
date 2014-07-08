#!/bin/bash
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

if [[ $# -eq 0 || "$1" = "--help" ]]; then
    echo "Use this script to create an Cordova App Harness project"
    echo "Usage: $0 NewDirName [--allplugins]>"
    echo 'Options via variables:'
    echo '  PLATFORMS="android ios"'
    echo '  CORDOVA="path/to/cordova"'
    echo '  PLUGIN_SEARCH_PATH="path1:path2:path3"'
    echo '  APP_ID="org.apache.AppHarness"'
    echo '  APP_NAME="CordovaAppHarness"'
    echo '  APP_VERSION="0.0.1"'
    echo '  ANDROID_PATH="path/to/cordova-android"'
    exit 1
fi

CORDOVA="${CORDOVA-cordova}"
PLATFORMS="${PLATFORMS-android}"
APP_ID=${APP_ID-org.apache.appharness}
APP_NAME=${APP_NAME-CordovaAppHarness}
APP_VERSION=${APP_VERSION-0.0.1}
DIR_NAME="${1}"
AH_PATH="$(cd $(dirname $0) && pwd)"
extra_search_path="$PLUGIN_SEARCH_PATH"
PLUGIN_SEARCH_PATH="$(dirname "$AH_PATH")"

function ResolveSymlinks() {
  local found_path="$1"
  if [[ -n "$found_path" ]]; then
      node -e "console.log(require('fs').realpathSync('$found_path'))"
  fi
}
function AddSearchPathIfExists() {
    if [[ -d "$1" ]]; then
        PLUGIN_SEARCH_PATH="$PLUGIN_SEARCH_PATH:$1"
    fi
}

# Use coho to find Cordova plugins
COHO_PATH=$(ResolveSymlinks $(which coho))
if [[ -n "$COHO_PATH" ]]; then
    CDV_PATH="$(dirname $(dirname "$COHO_PATH"))"
    AddSearchPathIfExists "$CDV_PATH"
    AddSearchPathIfExists "$CDV_PATH/cordova-plugins"
    ANDROID_PATH=${ANDROID_PATH-$CDV_PATH/cordova-android}
else
    # For when repos are cloned as siblings.
    AddSearchPathIfExists "$(dirname "$AH_PATH")"
    AddSearchPathIfExists "$(dirname "$AH_PATH")/cordova-plugins"
fi

# Use cca to find Chrome plugins
CCA_PATH=$(ResolveSymlinks $(which cca))
if [[ -n "$CCA_PATH" ]]; then
    CCA_PATH="$(dirname $(dirname "$CCA_PATH"))"
    AddSearchPathIfExists "$CCA_PATH/chrome-cordova/plugins"
fi

if [[ -n "$extra_search_path" ]]; then
    PLUGIN_SEARCH_PATH="${extra_search_path}:$PLUGIN_SEARCH_PATH"
fi

"$CORDOVA" create "$DIR_NAME" "$APP_ID" "$APP_NAME" --link-to "$AH_PATH/www" || exit 1
cd "$DIR_NAME"
cp "$AH_PATH/template-overrides/config.xml" . || exit 1
perl -i -pe "s/{ID}/$APP_ID/g" config.xml || exit 1
perl -i -pe "s/{NAME}/$APP_NAME/g" config.xml || exit 1
perl -i -pe "s/{VERSION}/$APP_VERSION/g" config.xml || exit 1

PLATFORM_ARGS="$PLATFORMS"
if [[ -n "$ANDROID_PATH" ]]; then
  PLATFORM_ARGS="${PLATFORMS/android/$ANDROID_PATH}"
fi

set -x
$CORDOVA platform add $PLATFORM_ARGS || exit 1
set +x

if [[ "$PLATFORMS" = *android* ]]; then
    echo 'var fs = require("fs");
          var fname = "platforms/android/src/org/apache/appharness/CordovaAppHarness.java";
          var tname = "'$AH_PATH'/template-overrides/Activity.java";
          var orig = fs.readFileSync(fname, "utf8");
          var templ = fs.readFileSync(tname, "utf8");
          var newData = orig.replace(/}\s*$/, templ + "\n}\n").replace(/import.*?$/m, "import org.apache.appharness.AppHarnessUI;\n$&");
          fs.writeFileSync(fname, newData);
          ' | node || exit $?
fi

mkdir -p hooks/after_prepare
cp "$AH_PATH"/template-overrides/after-hook.js hooks/after_prepare

# if [[ $PLATFORMS = *ios* ]]; then
    # ../../cordova-ios/bin/update_cordova_subproject platforms/ios/CordovaAppHarness.xcodeproj
# fi

echo Installing plugins.
# org.apache.cordova.device isn't used directly, but is convenient to test mobilespec.
"$CORDOVA" plugin add\
    "$AH_PATH/UrlRemap" \
    "$AH_PATH/AppHarnessUI" \
    org.apache.cordova.file \
    org.apache.cordova.file-transfer \
    org.apache.cordova.device \
    org.apache.cordova.network-information \
    org.chromium.socket \
    org.chromium.zip \
    --searchpath="$PLUGIN_SEARCH_PATH"

if [[ "$2" = "--allplugins" ]]; then
"$CORDOVA" plugin add \
    org.apache.cordova.battery-status \
    org.apache.cordova.camera \
    org.apache.cordova.contacts \
    org.apache.cordova.device-motion \
    org.apache.cordova.device-orientation \
    org.apache.cordova.device \
    org.apache.cordova.dialogs \
    org.apache.cordova.file-transfer \
    org.apache.cordova.file \
    org.apache.cordova.geolocation \
    org.apache.cordova.globalization \
    org.apache.cordova.inappbrowser \
    org.apache.cordova.media \
    org.apache.cordova.media-capture \
    org.apache.cordova.splashscreen \
    org.apache.cordova.statusbar \
    org.apache.cordova.vibration \
    --searchpath="$PLUGIN_SEARCH_PATH"
    # Skipped core plugins:
    # org.apache.cordova.console
fi

# To enable barcode scanning:
# $CORDOVA plugin add https://github.com/wildabeast/BarcodeScanner.git # Optional

cordova prepare

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

