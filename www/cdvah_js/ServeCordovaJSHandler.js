(function(){
    "use strict";
    /* global myApp */
    myApp.run(["AppsService", "ResourcesLoader", "ContextMenuInjectScript", function(AppsService, ResourcesLoader, ContextMenuInjectScript){
        var platformId = cordova.platformId;

        AppsService.addPreLaunchHook(function(appEntry, appInstallLocation , wwwLocation) {
            if(appEntry.Source === "serve"){
                return Q.fcall(function(){
                    // We can't inject the context menu script into cordova.js remotely
                    // So we create a local copy of the cordova.js used by the server,
                    //      append the context menu script (requests for cordova.js are routed to it)
                    wwwLocation += (wwwLocation.charAt(wwwLocation.length - 1) === "/")? "" : "/";
                    var cordovaJSPath = wwwLocation + "cordova.js";
                    return ResourcesLoader.xhrGet(cordovaJSPath);
                })
                .then(function(xhr){
                    var dataToAppend = ContextMenuInjectScript.getInjectString(appEntry.Name);
                    var completeText = xhr.responseText + dataToAppend;
                    appInstallLocation += (appInstallLocation.charAt(appInstallLocation.length - 1) === "/")? "" : "/";
                    return ResourcesLoader.writeFileContents(appInstallLocation + "cordova.js", completeText);
                });
            }
        }, 250 /* Give it a priority */);

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
                    return ResourcesLoader.writeFileContents(installPath + '/config.xml', self._cachedConfigXml);
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
