(function(){
    'use strict';

    var ASSET_MANIFEST_PATH = 'installmanifest.json';

    /* global myApp */
    myApp.run(['$q', 'Installer', 'AppsService', 'ResourcesLoader', 'urlCleanup', 'PluginMetadata', function($q, Installer, AppsService, ResourcesLoader, urlCleanup, PluginMetadata) {
        var platformId = cordova.require('cordova/platform').id;

        function ServeInstaller(url, appId) {
            Installer.call(this, url, appId);
            // Asset manifest is a cache of what files have been downloaded along with their etags.
            this._assetManifest = null;
            this._cachedProjectJson = null;
            this._cachedConfigXml = null;
        }
        ServeInstaller.prototype = Object.create(Installer.prototype);

        ServeInstaller.prototype.type = 'serve';

        ServeInstaller.prototype._readAssetManifest = function() {
            var deferred = $q.defer();
            var me = this;
            ResourcesLoader.readJSONFileContents(this.installPath + '/' + ASSET_MANIFEST_PATH)
            .then(function(result) {
                me._assetManifest = result;
                deferred.resolve();
            }, function() {
                me._assetManifest = {
                    'etagByPath': {}
                };
                deferred.resolve();
            });
            return deferred.promise;
        };

        ServeInstaller.prototype._writeAssetManifest = function() {
            var stringContents = JSON.stringify(this._assetManifest);
            return ResourcesLoader.writeFileContents(this.installPath + '/' + ASSET_MANIFEST_PATH, stringContents);
        };

        function fetchMetaServeData(url) {
            var projectJsonUrl = url + '/' + platformId + '/project.json';
            return ResourcesLoader.xhrGet(projectJsonUrl, true)
            .then(null, function(e) {
                // If there was no :8000, try again with one appended.
                if (!/:(\d)/.test(url)) {
                    var newUrl = url.replace(/(.*?\/\/[^\/]*)/, '$1:8000');
                    if (newUrl != url) {
                        url = newUrl;
                        projectJsonUrl = url + '/' + platformId + '/project.json';
                        return ResourcesLoader.xhrGet(projectJsonUrl, true);
                    }
                }
                throw e;
            })
            .then(function(projectJson) {
                return ResourcesLoader.xhrGet(url + projectJson.configPath)
                .then(function(configXmlRaw) {
                    var configXml = new DOMParser().parseFromString(configXmlRaw, 'text/xml');
                    var appId = configXml.firstChild.getAttribute('id');
                    return {
                        url: url,
                        projectJson: projectJson,
                        configXml: configXmlRaw,
                        appId: appId
                    };
                });
            });
        }
        // TODO: update should be more atomic. Maybe download to a new directory?
        ServeInstaller.prototype.doUpdateApp = function() {
            if (this._assetManifest) {
                return this._doUpdateAppForReal();
            }
            var me = this;
            return this._readAssetManifest().then(function() {
                return me._doUpdateAppForReal();
            });
        };

        ServeInstaller.prototype._bulkDownload = function(files) {
            var installPath = this.installPath;
            var wwwPath = this._cachedProjectJson.wwwPath;
            var deferred = $q.defer();
            var self = this;
            // Write the asset manifest to disk at most every 2 seconds.
            var assetManifestDirty = 0; // 0 = false, 1 = true, 2 = terminate interval.
            var intervalId = setInterval(function() {
                if (assetManifestDirty) {
                    if (assetManifestDirty == 2) {
                        clearInterval(intervalId);
                    }
                    self._writeAssetManifest();
                    assetManifestDirty = 0;
                }
            }, 2000);

            console.log('Number of files to fetch: ' + files.length);
            var i = 0;
            var totalFiles = files.length + 1; // + 1 for the updateAppMeta.
            deferred.notify((i + 1) / totalFiles);
            function downloadNext() {
                if (i > 0) {
                    self._assetManifest[files[i - 1].path] = files[i - 1].etag;
                    assetManifestDirty = 1;
                }
                if (!files[i]) {
                    assetManifestDirty = 2;
                    deferred.resolve();
                    return;
                }
                deferred.notify((i + 1) / totalFiles);

                var sourceUrl = self.url + wwwPath + files[i].path;
                var destPath = installPath + '/www' + files[i].path;
                if (files[i].path == '/cordova_plugins.js') {
                    destPath = installPath + '/orig-cordova_plugins.js';
                }
                console.log(destPath);
                i += 1;
                ResourcesLoader.downloadFromUrl(sourceUrl, destPath).then(downloadNext, deferred.reject);
            }
            downloadNext();
            return deferred.promise;
        };

        ServeInstaller.prototype._doUpdateAppForReal = function() {
            var installPath = this.installPath;
            var self = this;

            return fetchMetaServeData(this.url)
            .then(function(meta) {
                self._cachedProjectJson = meta.projectJson;
                self._cachedConfigXml = meta.configXml;
                self.appId = self.appId || meta.appId;
                var files = self._cachedProjectJson.wwwFileList;
                files = files.filter(function(f) {
                    // Don't download cordova.js or plugins. We want to use the version bundled with the harness.
                    // Do download cordova_plugins.js, since we need that to compare plugins with the harness.
                    var isPlugin = /\/cordova\.js$|^\/plugins\//.exec(f.path);
                    var haveAlready = self._assetManifest[f.path] == f.etag;
                    return (!isPlugin && !haveAlready);
                });
                return ResourcesLoader.writeFileContents(installPath + '/config.xml', self._cachedConfigXml)
                .then(function() {
                    return self._bulkDownload(files);
                });
            });
        };

        ServeInstaller.prototype.getPluginMetadata = function() {
            return ResourcesLoader.readFileContents(this.installPath + '/orig-cordova_plugins.js')
            .then(function(contents) {
                return PluginMetadata.extractPluginMetadata(contents);
            });
        };

        function createFromUrl(url, /*option*/ appId) {
            // Strip platform and trailing slash if they exist.
            url = urlCleanup(url);
            // Fetch config.xml.
            return fetchMetaServeData(url)
            .then(function(meta) {
                return new ServeInstaller(meta.url, appId || meta.appId);
            });
        }

        function createFromJson(url, appId) {
            return new ServeInstaller(url, appId);
        }

        AppsService.registerInstallerFactory({
            type: 'serve',
            createFromUrl: createFromUrl, // returns a promise.
            createFromJson: createFromJson // does not return a promise.
        });
    }]);
})();
