(function(){
    "use strict";
    /* global myApp */
    myApp.run(["$q", "Installer", "AppsService", "ResourcesLoader", function($q, Installer, AppsService, ResourcesLoader) {
        var platformId = cordova.platformId;

        function ServeInstaller(url, appId) {
            Installer.call(this, url, appId);
            this._cachedProjectJson = null;
            this._cachedConfigXml = null;
        }
        ServeInstaller.prototype = Object.create(Installer.prototype);

        ServeInstaller.prototype.type = 'serve';

        function fetchMetaServeData(url) {
            var deferred = $q.defer();
            var ret = {
                url: url,
                projectJson: null,
                configXml: null,
                appId: null
            };
            ResourcesLoader.xhrGet(url + '/' + platformId + '/project.json')
            .then(function(xhr) {
                ret.projectJson = JSON.parse(xhr.responseText);
                return ResourcesLoader.xhrGet(url + ret.projectJson['configPath']);
            }, function(e) {
                // If there was no :8000, try again with one appended.
                if (!/:(\d)/.test(url)) {
                    var newUrl = url.replace(/(.*?\/\/[^\/]*)/, '$1:8000');
                    if (newUrl != url) {
                        return fetchMetaServeData(url);
                    }
                }
                deferred.reject(e);
            })
            .then(function(xhr) {
                ret.configXml = xhr.responseText;
                var configXml = new DOMParser().parseFromString(ret.configXml, 'text/xml');
                ret.appId = configXml.firstChild.getAttribute('id');
                deferred.resolve(ret);
            }, deferred.reject);
            return deferred.promise;
        };

        // TODO: update should be more atomic. Maybe download to a new directory?
        ServeInstaller.prototype._doUpdateApp = function(installPath) {
            var deferred = $q.defer();
            var self = this;
            fetchMetaServeData(this.url)
            .then(function(meta) {
                self._cachedProjectJson = meta.projectJson;
                self._cachedConfigXml = meta.configXml;
                self.appId = meta.appId;
                var wwwPath = self._cachedProjectJson['wwwPath'];
                var files = self._cachedProjectJson['wwwFileList'];
                files = files.filter(function(path) {
                    // Don't download cordova.js or plugins. We want to use the version bundled with the harness.
                    return !/\/cordova(?:_plugins)?.js$|^\/plugins\//.exec(path);
                });
                var i = 0;
                var totalFiles = files.length + 1; // +1 for the updateAppMeta.
                deferred.notify((i + 1) / totalFiles);
                function downloadNext() {
                    if (!files[i]) {
                        deferred.resolve();
                        return;
                    }
                    console.log('now downloading ' + i + ' of ' + files.length);
                    deferred.notify((i + 1) / totalFiles);

                    var sourceUrl = self.url + wwwPath + files[i];
                    var destPath = installPath + '/www' + files[i];
                    console.log(destPath);
                    i += 1;
                    return ResourcesLoader.downloadFromUrl(sourceUrl, destPath).then(downloadNext);
                }
                return ResourcesLoader.ensureDirectoryExists(installPath + '/config.xml')
                .then(function() {
                    return ResourcesLoader.writeFileContents(installPath + '/config.xml', self._cachedConfigXml)
                })
                .then(downloadNext);
            });
            return deferred.promise;
        };

        function createFromUrl(url) {
            // Strip platform and trailing slash if they exist.
            url = url.replace(/\/$/, '').replace(new RegExp(platformId + '$'), '').replace(/\/$/, '');
            if (!/^http:/.test(url)) {
                url = 'http://' + url;
            }
            // Fetch config.xml.
            return fetchMetaServeData(url)
            .then(function(meta) {
                return new ServeInstaller(meta.url, meta.appId);
            });
        }

        function createFromJson(url, appId, installPath) {
            return new ServeInstaller(url, appId);
        }

        AppsService.registerInstallerFactory({
            type: 'serve',
            createFromUrl: createFromUrl, // returns a promise.
            createFromJson: createFromJson // does not return a promise.
        });
    }]);
})();
