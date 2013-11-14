(function(){
    "use strict";
    /* global myApp */
    myApp.factory("Installer", ["$q", "UrlRemap", "ResourcesLoader", "ContextMenuInjectScript", function($q, UrlRemap, ResourcesLoader, ContextMenuInjectScript) {

        function getAppStartPageFromConfig(configFile) {
            return ResourcesLoader.readFileContents(configFile)
            .then(function(contents) {
                if(!contents) {
                    throw new Error("Config file is empty. Unable to find a start page for your app.");
                } else {
                    var startLocation = 'index.html';
                    var parser = new DOMParser();
                    var xmlDoc = parser.parseFromString(contents, "text/xml");
                    var els = xmlDoc.getElementsByTagName("content");

                    if(els.length > 0) {
                        // go through all "content" elements looking for the "src" attribute in reverse order
                        for(var i = els.length - 1; i >= 0; i--) {
                            var el = els[i];
                            var srcValue = el.getAttribute("src");
                            if (srcValue) {
                                startLocation = srcValue;
                                break;
                            }
                        }
                    }

                    return startLocation;
                }
            });
        }

        function Installer(url, appId) {
            this.url = url;
            this.appId = appId || '';
            this.updatingStatus = null;
            this.lastUpdated = null;
            this.installPath = null;
        }

        Installer.prototype.type = '';

        Installer.prototype.updateApp = function(installPath) {
            var self = this;
            this.updatingStatus = 0;
            return this.doUpdateApp(installPath)
            .then(function() {
                self.installPath = installPath;
                self.lastUpdated = new Date();
                self.updatingStatus = null;
            }, null, function(status) {
                self.updatingStatus = Math.round(status * 100);
            });
        };

        Installer.prototype.deleteFiles = function() {
            this.lastUpdated = null;
            if (this.installPath) {
                return ResourcesLoader.deleteDirectory(this.installPath);
            }
            return $q.when();
        };

        Installer.prototype.launch = function(appIndex) {
            var installPath = this.installPath;
            var appId = this.appId;
            if (!installPath) {
                throw new Error('App ' + appId + ' requires an update');
            }
            var configLocation = installPath + '/config.xml';

            return getAppStartPageFromConfig(configLocation)
            .then(function(rawStartLocation) {
                var urlutil = cordova.require('cordova/urlutil');
                var harnessUrl = urlutil.makeAbsolute(location.pathname);
                var harnessDir = harnessUrl.replace(/\/[^\/]*\/[^\/]*$/, '');
                var installUrl = urlutil.makeAbsolute(installPath);
                var injectString = ContextMenuInjectScript.getInjectString(appId, appIndex);
                var startLocation = urlutil.makeAbsolute(rawStartLocation).replace('/cdvah/', '/');
                // On iOS, file:// URLs can't be re-routed via an NSURLProtocol for top-level navications.
                // http://stackoverflow.com/questions/12058203/using-a-custom-nsurlprotocol-on-ios-for-file-urls-causes-frame-load-interrup
                // The work-around (using loadData:) breaks history.back().
                // So, for file:// start pages, we just point to the install location.
                if (cordova.platformId == 'ios') {
                    startLocation = startLocation.replace(harnessDir, installUrl + '/www')
                }

                // Inject the context menu script for all pages except the harness menu.
                UrlRemap.injectJsForUrl('^(?!' + harnessUrl + ')', injectString);
                // Allow navigations back to the menu.
                UrlRemap.setResetUrl('^' + harnessUrl);
                // Override cordova.js, cordova_plugins.js, and www/plugins to point at bundled plugins.
                UrlRemap.aliasUri('/cordova\\.js.*', '.+', harnessDir + '/cordova.js', false /* redirect */);
                UrlRemap.aliasUri('/cordova_plugins\\.js.*', '.+', harnessDir + '/cordova_plugins.js', false /* redirect */);
                var pluginsUrl = startLocation.replace(/\/www\/.*/, '/www/plugins/');
                UrlRemap.aliasUri('^' + pluginsUrl, '^' + pluginsUrl, harnessDir + '/plugins/', false /* redirect */);
                // Make any references to www/ point to the app's install location.
                UrlRemap.aliasUri('^' + harnessDir, '^' + harnessDir, installUrl + '/www', false /* redirect */);
                // Set-up app-harness: scheme to point at the harness.
                UrlRemap.aliasUri('^app-harness:///cdvah/index.html', '^app-harness://', harnessDir, true);
                return UrlRemap.aliasUri('^app-harness:', '^app-harness://', harnessDir, false)
                .then(function() {
                    return startLocation;
                });
            });
        };
        return Installer;
    }]);
})();
