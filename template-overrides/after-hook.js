#!/usr/bin/env node
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
*/

var fs = require('fs');
var path = require('path');

var preparedWwwPathMap = {
    'android': path.join('platforms', 'android', 'assets' , 'www'),
    'ios': path.join('platforms', 'ios', 'www')
};

var platforms = process.env['CORDOVA_PLATFORMS'].split(',').filter(function(name) { return name in preparedWwwPathMap; });
if (platforms.length === 0) {
  return;
}

function generatePluginInfoFile() {
    var idToServiceNameMap = {};
    var depsMap = {};

    function extractServiceNames(contents) {
        var foundNames = {};
        var pattern = /<feature\s+name="(.+?)"/g;
        var match;
        while (match = pattern.exec(contents)) {
            foundNames[match[1]] = true;
        }
        return Object.keys(foundNames);
    }

    function extractDependencies(contents) {
        var foundIds = {};
        var pattern = /<dependency\s+id="(.+?)"/g;
        var match;
        while (match = pattern.exec(contents)) {
            foundIds[match[1]] = true;
        }
        return Object.keys(foundIds);
    }

    fs.readdirSync('plugins').forEach(function(p) {
        var pluginXmlPath = path.join('plugins', p, 'plugin.xml');
        if (fs.existsSync(pluginXmlPath)) {
            var contents = fs.readFileSync(pluginXmlPath, 'utf8');
            idToServiceNameMap[p] = extractServiceNames(contents);
            depsMap[p] = extractDependencies(contents);
        }
    });

    var fileContents = 'myApp.value("pluginIdToServiceNames", ' + JSON.stringify(idToServiceNameMap, null, 4) + ');\n' +
        'myApp.value("pluginDepsMap", ' + JSON.stringify(depsMap, null, 4) + ');\n'

    platforms.forEach(function(platformId) {
        var wwwPath = preparedWwwPathMap[platformId];
        if (!fs.existsSync(path.join(wwwPath, 'cdvah', 'generated'))) {
            fs.mkdirSync(path.join(wwwPath, 'cdvah', 'generated'));
        }
        var outPath = path.join(wwwPath, 'cdvah', 'generated', 'installedPluginsMetadata.js');
        fs.writeFileSync(outPath, fileContents);
        console.log('Wrote ' + outPath);
    });
}

// This is required only on Android, and it's required because URL remapping
// does not work when the file exists on disk. E.g. the harness creates a new
// cordova_plugins.js, but it doesn't get noticed due to the existing one.
function renameCordovaPluginsFile() {
    platforms.forEach(function(platformId) {
        var wwwPath = preparedWwwPathMap[platformId];
        fs.renameSync(path.join(wwwPath, 'cordova_plugins.js'), path.join(wwwPath, 'cordova_plugins_harness.js'));
        var cordovaJsContents = fs.readFileSync(path.join(wwwPath, 'cordova.js'), 'utf8');
        cordovaJsContents = cordovaJsContents.replace(/'cordova_plugins\.js'/g, '(window.THIS_IS_APP_HARNESS ? "cordova_plugins_harness.js" : "cordova_plugins.js")');
        fs.writeFileSync(path.join(wwwPath, 'cordova.js'), cordovaJsContents);
        console.log('Renamed cordova_plugins.js -> ' + path.join(wwwPath, 'cordova_plugins_harness.js'));
    });
}
generatePluginInfoFile();
renameCordovaPluginsFile();
