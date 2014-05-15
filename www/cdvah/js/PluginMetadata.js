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
(function() {
    'use strict';
    /* global myApp */
    myApp.factory('PluginMetadata', function() {
        var harnessPluginList = cordova.require('cordova/plugin_list');
        var harnessPluginMetadata = harnessPluginList.metadata;

        // Returns -1, (a > b), 0 (a = b), or 1 (a < b).
        function semverCompare(a, b) {
            var regex = /^(\d+)\.(\d+)\.(\d+)/;
            var aComps = a.match(regex);
            var bComps = b.match(regex);

            for(var i = 1; i <= 3; i++) {
                if (+aComps[i] != +bComps[i]) {
                    return +aComps[i] < +bComps[i] ? 1 : -1;
                }
            }

            return 0;
        }

        return {
            extractPluginMetadata: function(pluginListFileContents) {
                if (!pluginListFileContents) {
                    throw new Error('cordova_plugins.js file is empty. Something has gone wrong with "cordova prepare".');
                }

                // Extract the JSON data from inside the JS file.
                // It's between two magic comments created by Plugman.
                var startIndex = pluginListFileContents.indexOf('TOP OF METADATA') + 16;
                var endIndex = pluginListFileContents.indexOf('// BOTTOM OF METADATA');
                var target = pluginListFileContents.substring(startIndex, endIndex);
                var metadata = JSON.parse(target);
                return metadata;
            },

            // Returns an object with plugin matching data.
            process: function(childPlugins) {
                var results = {
                    raw: childPlugins,
                    matched: [],
                    missing: [],
                    newer: [], // Those dependencies which are newer in the child than the harness.
                    older: []  // And those which are older in the child than the harness.
                };

                if (!childPlugins) {
                    results.raw = {};
                    return results;
                }

                Object.keys(childPlugins).forEach(function(plugin) {
                    if (!harnessPluginMetadata[plugin]) {
                        results.missing.push({ id: plugin, version: childPlugins[plugin] });
                    } else {
                        switch(semverCompare(harnessPluginMetadata[plugin], childPlugins[plugin])) {
                            case -1: // Child older.
                                results.older.push({ id: plugin, versions: { harness: harnessPluginMetadata[plugin], child: childPlugins[plugin] } });
                                break;
                            case 1: // Child newer.
                                results.newer.push({ id: plugin, versions: { harness: harnessPluginMetadata[plugin], child: childPlugins[plugin] } });
                                break;
                            case 0: // Match!
                                results.matched.push({ id: plugin, version: harnessPluginMetadata[plugin] });
                                break;
                        }
                    }
                });

                return results;
            },
            // This creates the contents for the app's cordova_plugins.js file.
            // Right now, it contains the harness's plugins with all plugins not listed
            // in the target app removed.
            // TODO: is to also add in plugin .js that is exists in the app but *not*
            // in the harness. This will allow for JS-only plugins to work.
            createNewPluginListFile: function(appPluginIds) {
                function startsWith(a, b) {
                    return a.lastIndexOf(b, 0) === 0;
                }

                function isPluginIdEnabled(id) {
                    for (var i = 0; i < appPluginIds.length; ++i) {
                        if (startsWith(id, appPluginIds[i])) {
                            return true;
                        }
                    }
                    return false;
                }
                var newPluginList = harnessPluginList.filter(function(entry) {
                    return isPluginIdEnabled(entry.id);
                });
                var newMetadata = {};
                for (var i = 0; i < appPluginIds.length; ++i) {
                    var pluginId = appPluginIds[i];
                    if (pluginId in harnessPluginMetadata) {
                        newMetadata[pluginId] = harnessPluginMetadata[pluginId];
                    }
                }
                var ret = 'cordova.define("cordova/plugin_list", function(require, exports, module) {\n' +
                    'module.exports = ' + JSON.stringify(newPluginList, null, 4) + ';\n' +
                    'module.exports.metadata =\n' +
                    '// TOP OF METADATA\n' +
                    JSON.stringify(newMetadata, null, 4) + '\n' +
                    '// BOTTOM OF METADATA\n' +
                    '});\n';

                return ret;
            }
        };
    });
})();

