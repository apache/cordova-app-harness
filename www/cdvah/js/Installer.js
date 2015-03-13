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
        function Installer() {}

        Installer.prototype.init = function(installPath, /* optional */ appId) {
            var ret = this;
            ret.appType = ret.constructor.type;
            ret.appId = appId || 'default'; // Stored in apps.json. May be different from id within config.xml.
            ret.lastUpdated = null;
            // Derived values:
            ret.updatingStatus = null;
            ret.configXmlDom = null; // Read from config.xml
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
                return self.readConfigXml_();
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

        Installer.prototype.readConfigXml_ = function() {
            var self = this;
            return ResourcesLoader.readFileContents(this.directoryManager.rootURL + 'config.xml')
            .then(function(configStr) {
                self.configXmlDom = new DOMParser().parseFromString(configStr, 'text/xml');
            });
        };

        function lastEl(els) {
            return els[els.length - 1];
        }

        Installer.prototype.getAppName = function() {
            if (!this.configXmlDom) {
                return '';
            }
            var el = lastEl(this.configXmlDom.getElementsByTagName('name'));
            return el && el.textContent;
        };

        Installer.prototype.getIconUrl = function() {
            if (!this.configXmlDom) {
                return '';
            }
            var el = lastEl(this.configXmlDom.getElementsByTagName('icon'));
            var ret = el && el.getAttribute('src');
            // Don't set icon until the file exists.
            if (!ret || !this.directoryManager.getAssetEtag(ret)) {
                return '';
            }
            ret = this.directoryManager.rootURL + ret;
            return ret;
        };

        Installer.prototype.getStartPage = function() {
            var el = lastEl(this.configXmlDom.getElementsByTagName('content'));
            var ret = el ? el.getAttribute('src') : 'index.html';
            return ret;
        };

        Installer.prototype.getVersion = function() {
            if (!this.configXmlDom) {
                return '';
            }
            var widgetEl = this.configXmlDom.lastChild;
            return widgetEl.getAttribute('version');
        };

        Installer.prototype.getConfigXmlId = function() {
            if (!this.configXmlDom) {
                return '';
            }
            var widgetEl = this.configXmlDom.lastChild;
            return widgetEl.getAttribute('id');
        };

        Installer.prototype.getAndroidVersionCode = function() {
            // copied from android_parser.js
            function defaultVersionCode(version) {
                var nums = version.split('-')[0].split('.').map(Number);
                var versionCode = nums[0] * 10000 + nums[1] * 100 + nums[2];
                return versionCode;
            }

            var versionCode = this.configXmlDom.lastChild.getAttribute('android-versionCode');
            if (versionCode) {
                return +versionCode;
            }
            return defaultVersionCode(this.getVersion() || '0.0.1');
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
                return this.readConfigXml_();
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

        Installer.prototype.getWwwDir = function() {
            return this.directoryManager.rootURL + 'www/';
        };

        Installer.prototype.launch = function() {
            var self = this;
            return $q.when(this._prepareForLaunch())
            .then(function() {
                var urlutil = cordova.require('cordova/urlutil');
                var harnessWwwUrl = urlutil.makeAbsolute(location.pathname).replace(/\/[^\/]*\/[^\/]*$/, '/');
                var appWwwUrl = self.getWwwDir();
                var startLocation = urlutil.makeAbsolute(self.getStartPage()).replace('/cdvah/', '/');
                var realStartLocation = startLocation.replace(harnessWwwUrl, appWwwUrl);
                var useRemapper = false; //platformId == 'android';

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

