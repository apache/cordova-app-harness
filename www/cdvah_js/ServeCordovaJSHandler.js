(function(){
    "use strict";
    /* global myApp */
    myApp.run(["$location", "AppBundle", "AppsService", "ResourcesLoader", "ContextMenuInjectScript", function($location, AppBundle, AppsService, ResourcesLoader, ContextMenuInjectScript){
        var platformId = cordova.platformId;

        function ServeHandler(url, appId) {
            this.url = url;
            this.appId = appId || '';
            this.lastUpdated = null;
            this._cachedProjectJson = null;
            this._cachedConfigXml = null;
        }

        ServeHandler.prototype.type = 'serve';

        ServeHandler.prototype._updateAppMeta = function() {
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
        ServeHandler.prototype.updateApp = function(installPath) {
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
                        self.lastUpdated = new Date();
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

        ServeHandler.prototype.prepareForLaunch = function(installPath, launchUrl) {
            var harnessUrl = cordova.require('cordova/urlutil').makeAbsolute(location.pathname);
            var harnessDir = harnessUrl.replace(/\/[^\/]*$/, '');
            var installUrl = cordova.require('cordova/urlutil').makeAbsolute(installPath);
            var injectString = ContextMenuInjectScript.getInjectString()
            // Inject the context menu script for all pages except the harness menu.
            return AppBundle.injectJsForUrl('^(?!' + harnessUrl + ')', injectString)
            .then(function() {
                // Allow navigations back to the menu.
                return AppBundle.setResetUrl('^' + harnessUrl);
            })
            .then(function() {
                // Make any references to www/ point to the app's install location.
                return AppBundle.aliasUri('^' + harnessDir, '^' + harnessDir, installUrl + '/www', false /* redirect */);
            })
            .then(function() {
                return AppBundle.aliasUri('/cordova\\.js.*', '.+', harnessDir + '/cordova.js', false /* redirect */);
            })
            .then(function() {
                return AppBundle.aliasUri('/cordova_plugins\\.js.*', '.+', harnessDir + '/cordova_plugins.js', false /* redirect */);
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
            var ret = new ServeHandler(url);

            return ret._updateAppMeta().then(function() { return ret; });
        }

        function createFromJson(url, appId) {
            return new ServeHandler(url, appId);
        }

        AppsService.registerInstallHandlerFactory({
            type: 'serve',
            createFromUrl: createFromUrl, // returns a promise.
            createFromJson: createFromJson // does not return a promise.
        });
    }]);
})();
