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
(function(){
    'use strict';

    /* global myApp, cordova */
    myApp.factory('Installer', ['$q', 'UrlRemap', 'ResourcesLoader', 'PluginMetadata', 'DirectoryManager', function($q, UrlRemap, ResourcesLoader, PluginMetadata, DirectoryManager) {
        var platformId = cordova.require('cordova/platform').id;

        function Installer() {}

        Installer.prototype.init = function(installPath, /* optional */ appId) {
            var ret = this;
            ret.appType = ret.constructor.type;
            ret.updatingStatus = null;
            ret.lastUpdated = null;
            // Asset manifest is a cache of what files have been downloaded along with their etags.
            ret.appId = null; // Read from config.xml
            ret.appName = null; // Read from config.xml
            ret.iconURL = null; // Read from config.xml
            ret.startPage = null; // Read from config.xml
            ret.plugins = {}; // Read from orig-cordova_plugins.js
            ret.appId = appId;
            ret.directoryManager = new DirectoryManager();
            return ret.directoryManager.init(installPath)
            .then(function() {
                ret.directoryManager.onFileAdded = ret.onFileAdded.bind(ret);
                return ret;
            });
        };

        Installer.prototype.initFromJson = function(json) {
            var self = this;
            return this.init(json['installPath'], json['appId'])
            .then(function(ret) {
                ret.lastUpdated = json['lastUpdated'] && new Date(json['lastUpdated']);
                return self.readConfigXml();
            });
        };

        Installer.prototype.toDiskJson = function() {
            return {
                'appType' : this.appType,
                'appId' : this.appId,
                'lastUpdated': this.lastUpdated && +this.lastUpdated,
                'installPath': this.directoryManager.rootURL
            };
        };

        Installer.prototype.readConfigXml = function() {
            var self = this;
            return ResourcesLoader.readFileContents(this.directoryManager.rootURL + 'config.xml')
            .then(function(configStr) {
                function lastEl(els) {
                    return els[els.length - 1];
                }
                var xmlDoc = new DOMParser().parseFromString(configStr, 'text/xml');
                self.appId = xmlDoc.firstChild.getAttribute('id');
                var el = lastEl(xmlDoc.getElementsByTagName('content'));
                self.startPage = el ? el.getAttribute('src') : 'index.html';
                el = lastEl(xmlDoc.getElementsByTagName('icon'));
                self.iconURL = el ? el.getAttribute('src') : null;
                if (self.iconURL) {
                    self.iconURL = self.directoryManager.rootURL + self.iconURL;
                }
                el = lastEl(xmlDoc.getElementsByTagName('name'));
                self.appName = el ? el.textContent : null;
            });
        };

        Installer.prototype.updateCordovaPluginsFile = function(etag) {
            var self = this;
            return $q.when(self.getPluginMetadata())
            .then(function(metadata) {
                self.plugins = PluginMetadata.process(metadata);
                var pluginIds = Object.keys(metadata);
                var newPluginsFileData = PluginMetadata.createNewPluginListFile(pluginIds);
                return self.directoryManager.writeFile(newPluginsFileData, 'www/cordova_plugins.js', etag);
            });
        };

        Installer.prototype.onFileAdded = function(path) {
            if (path == 'config.xml') {
                return this.readConfigXml();
            }
        };

        Installer.prototype.getPluginMetadata = function() {
            throw new Error('unimplemented.');
        };

        Installer.prototype.deleteFiles = function() {
            this.lastUpdated = null;
            return this.directoryManager.deleteAll();
        };

        Installer.prototype.unlaunch = function() {
            return UrlRemap.reset();
        };

        Installer.prototype._prepareForLaunch = function() {
            return $q.when();
        };

        Installer.prototype.launch = function() {
            var self = this;
            return $q.when(this._prepareForLaunch())
            .then(function() {
                var urlutil = cordova.require('cordova/urlutil');
                var harnessWwwUrl = urlutil.makeAbsolute(location.pathname).replace(/\/[^\/]*\/[^\/]*$/, '/');
                var appWwwUrl = self.directoryManager.rootURL + 'www/';
                var startLocation = urlutil.makeAbsolute(self.startPage).replace('/cdvah/', '/');
                var realStartLocation = startLocation.replace(harnessWwwUrl, appWwwUrl);
                var useRemapper = platformId == 'android';

                if (!/^file:/.exec(startLocation)) {
                    throw new Error('Expected to start with file: ' + startLocation);
                }

                if (useRemapper) {
                    // Override cordova.js, and www/plugins to point at bundled plugins.
                    // Note: Due to the remapper's inability to remap files that exist, this isn't strictly necessary.
                    UrlRemap.aliasUri('^(?!app-harness://).*/www/cordova\\.js.*', '.+', 'app-harness:///cordova.js', false /* redirect */, true /* allowFurtherRemapping */);
                    UrlRemap.aliasUri('^(?!app-harness://).*/www/plugins/.*', '^.*?/www/plugins/' , 'app-harness:///plugins/', false /* redirect */, true /* allowFurtherRemapping */);

                    // Make any references to www/ point to the app's install location.
                    var harnessPrefixPattern = '^' + harnessWwwUrl.replace('file:///', 'file://.*?/');
                    UrlRemap.aliasUri(harnessPrefixPattern, harnessPrefixPattern, appWwwUrl, false /* redirect */, true /* allowFurtherRemapping */);

                    // Set-up app-harness: scheme to point at the harness.
                    return UrlRemap.aliasUri('^app-harness:', '^app-harness:///', harnessWwwUrl, false, false)
                    .then(function() {
                        return startLocation;
                    });
                } else {
                    return ResourcesLoader.delete(appWwwUrl + 'plugins/')
                    .then(function() {
                        return ResourcesLoader.delete(appWwwUrl + 'cordova.js');
                    }).then(function() {
                        return ResourcesLoader.delete(appWwwUrl + 'plugins/');
                    }).then(function() {
                        return ResourcesLoader.copy(harnessWwwUrl + 'cordova.js', appWwwUrl + 'cordova.js');
                    }).then(function() {
                        return ResourcesLoader.copy(harnessWwwUrl + 'plugins/', appWwwUrl + 'plugins/');
                    }).then(function() {
                        return realStartLocation;
                    });
                }
            });
        };

        return Installer;
    }]);
})();

