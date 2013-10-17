(function(){
    "use strict";
    /* global myApp */
    myApp.run(["Installer", "AppsService", "ResourcesLoader", function(Installer, AppsService, ResourcesLoader) {
        var platformId = cordova.platformId;

        function ServeInstaller(url, appId) {
            Installer.call(this, url, appId);
            this._cachedProjectJson = null;
            this._cachedConfigXml = null;
        }
        ServeInstaller.prototype = Object.create(Installer.prototype);

        ServeInstaller.prototype.type = 'serve';

        ServeInstaller.prototype._updateAppMeta = function() {
            var self = this;
            return ResourcesLoader.xhrGet(this.url + '/' + platformId + '/project.json')
            .then(function(xhr) {
                self._cachedProjectJson = JSON.parse(xhr.responseText);
                return ResourcesLoader.xhrGet(self.url + self._cachedProjectJson['configPath']);
            })
            .then(function(xhr) {
                self._cachedConfigXml = xhr.responseText;
                var configXml = new DOMParser().parseFromString(self._cachedConfigXml, 'text/xml');
                self.appId = configXml.firstChild.getAttribute('id');
            });
        };

        // TODO: update should be more atomic. Maybe download to a new directory?
        ServeInstaller.prototype.updateApp = function(installPath) {
            var self = this;
            return this._updateAppMeta()
            .then(function() {
                var wwwPath = self._cachedProjectJson['wwwPath'];
                var files = self._cachedProjectJson['wwwFileList'];
                var i = 0;
                function downloadNext() {
                    // Don't download cordova.js. We want to use the version bundled with the harness.
                    if (/\/cordova(?:_plugins)?.js$/.exec(files[i])) {
                        ++i;
                    }
                    if (!files[i]) {
                        Installer.prototype.updateApp.call(self, installPath);
                        return;
                    }
                    console.log('now downloading ' + i + ' of ' + files.length);
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
        };

        function createFromUrl(url) {
            // Strip platform and trailing slash if they exist.
            url = url.replace(/\/$/, '').replace(new RegExp(platformId + '$'), '').replace(/\/$/, '');
            if (!/^http:/.test(url)) {
                url = 'http://' + url;
            }
            if (!/:(\d)/.test(url)) {
                url = url.replace(/(.*?\/\/[^\/]*)/, '$1:8000');
            }
            // Fetch config.xml.
            var ret = new ServeInstaller(url);

            return ret._updateAppMeta().then(function() { return ret; });
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
