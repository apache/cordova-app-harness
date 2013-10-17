(function(){
    "use strict";
    /* global myApp */
    myApp.factory("Installer", ["AppBundle", "ResourcesLoader", "ContextMenuInjectScript", function(AppBundle, ResourcesLoader, ContextMenuInjectScript) {

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
            this.lastUpdated = null;
            this.installPath = null;
        }

        Installer.prototype.type = '';

        Installer.prototype.updateApp = function(installPath) {
            this.installPath = installPath;
            this.lastUpdated = new Date();
        };

        Installer.prototype.deleteFiles = function() {
            var self = this;
            return Q.fcall(function() {
                self.lastUpdated = null;
                if (self.installPath) {
                    return ResourcesLoader.deleteDirectory(self.installPath);
                }
            });
        };

        Installer.prototype.launch = function() {
            var installPath = this.installPath;
            if (!installPath) {
                throw new Error('App ' + this.appId + ' requires an update');
            }
            var configLocation = installPath + '/config.xml';

            return getAppStartPageFromConfig(configLocation)
            .then(function(rawStartLocation) {
                var harnessUrl = cordova.require('cordova/urlutil').makeAbsolute(location.pathname);
                var harnessDir = harnessUrl.replace(/\/[^\/]*$/, '');
                var installUrl = cordova.require('cordova/urlutil').makeAbsolute(installPath);
                var injectString = ContextMenuInjectScript.getInjectString();
                // Inject the context menu script for all pages except the harness menu.
                AppBundle.injectJsForUrl('^(?!' + harnessUrl + ')', injectString);
                // Allow navigations back to the menu.
                AppBundle.setResetUrl('^' + harnessUrl);
                // Make any references to www/ point to the app's install location.
                AppBundle.aliasUri('^' + harnessDir, '^' + harnessDir, installUrl + '/www', false /* redirect */);
                // Override cordova.js and cordova_plugins.js.
                AppBundle.aliasUri('/cordova\\.js.*', '.+', harnessDir + '/cordova.js', false /* redirect */);
                AppBundle.aliasUri('/cordova_plugins\\.js.*', '.+', harnessDir + '/cordova_plugins.js', false /* redirect */);
                // Set-up app-bundle: scheme to point at the harness.
                AppBundle.aliasUri('^app-bundle:///cdvah_index.html', '^app-bundle://', harnessDir, true);
                return AppBundle.aliasUri('^app-bundle:', '^app-bundle://', harnessDir, false)
                .then(function() {
                    var startLocation = cordova.require('cordova/urlutil').makeAbsolute(rawStartLocation);
                    // On iOS, file:// URLs can't be re-routed via an NSURLProtocol for top-level navications.
                    // http://stackoverflow.com/questions/12058203/using-a-custom-nsurlprotocol-on-ios-for-file-urls-causes-frame-load-interrup
                    // The work-around (using loadData:) breaks history.back().
                    // So, for file:// start pages, we just point to the install location.
                    if (cordova.platformId == 'ios') {
                        return startLocation.replace(harnessDir, installUrl + '/www')
                    }
                    return startLocation;
                });
            });
        };
        return Installer;
    }]);
})();
