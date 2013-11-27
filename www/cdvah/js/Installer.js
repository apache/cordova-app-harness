(function(){
    'use strict';
    /* global myApp */
    myApp.factory('Installer', ['$q', 'UrlRemap', 'ResourcesLoader', 'ContextMenuInjectScript', function($q, UrlRemap, ResourcesLoader, ContextMenuInjectScript) {

        function getAppStartPageFromConfig(configFile) {
            return ResourcesLoader.readFileContents(configFile)
            .then(function(contents) {
                if(!contents) {
                    throw new Error('Config file is empty. Unable to find a start page for your app.');
                } else {
                    var startLocation = 'index.html';
                    var parser = new DOMParser();
                    var xmlDoc = parser.parseFromString(contents, 'text/xml');
                    var els = xmlDoc.getElementsByTagName('content');

                    if(els.length > 0) {
                        // go through all 'content' elements looking for the 'src' attribute in reverse order
                        for(var i = els.length - 1; i >= 0; i--) {
                            var el = els[i];
                            var srcValue = el.getAttribute('src');
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

        function getAppPlugins(cordovaPluginsFile) {
            return ResourcesLoader.readFileContents(cordovaPluginsFile)
            .then(function(contents) {
                if (!contents) {
                    throw new Error('cordova_plugins.js file is empty. Something has gone wrong with "cordova prepare".');
                }

                // Extract the JSON data from inside the JS file.
                // It's between two magic comments created by Plugman.
                var startIndex = contents.indexOf('TOP OF METADATA') + 16;
                var endIndex = contents.indexOf('// BOTTOM OF METADATA');
                var target = contents.substring(startIndex, endIndex);
                var metadata = JSON.parse(target);
                return metadata;
            });
        }

        function Installer(url, appId) {
            this.url = url;
            this.appId = appId || '';
            this.updatingStatus = null;
            this.lastUpdated = null;
            this.installPath = null;
            this.plugins = {};
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
                if (self.type === 'crx') {
                    // No cordova_plugins.js to read for .crx-based apps.
                    return $q.when({});
                } else {
                    return getAppPlugins(installPath + '/www/cordova_plugins.js');
                }
            }, null, function(status) {
                self.updatingStatus = Math.round(status * 100);
            }).then(function(metadata) {
                self.plugins = metadata;
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

            var type = this.type;

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
                    startLocation = startLocation.replace(harnessDir, installUrl + '/www');
                }

                // Inject the context menu script for all pages except the harness menu.
                UrlRemap.injectJsForUrl('^(?!' + harnessUrl + ')', injectString);
                // Allow navigations back to the menu.
                UrlRemap.setResetUrl('^' + harnessUrl);
                // Override cordova.js, cordova_plugins.js, and www/plugins to point at bundled plugins.
                UrlRemap.aliasUri('/cordova\\.js.*', '.+', harnessDir + '/cordova.js', false /* redirect */);
                UrlRemap.aliasUri('/cordova_plugins\\.js.*', '.+', harnessDir + '/cordova_plugins.js', false /* redirect */);
                if (startLocation.indexOf('chrome-extension://') === 0) {
                    var pluginsUrl = 'chrome-extension://[^/]+/plugins/';
                    UrlRemap.aliasUri('^' + pluginsUrl, '^' + pluginsUrl, harnessDir + '/plugins/', false /* redirect */);

                    var bootstrapUrl = 'chrome-extension://[^/]+/chrome(?:app\\.html|bgpage\\.html|appstyles\\.css)';
                    UrlRemap.aliasUri('^' + bootstrapUrl, '^chrome-extension://[^/]+/', harnessDir + '/', false /* redirect */);

                    var chromeExtensionUrl = 'chrome-extension://[^\/]+/(?!!gap_exec)';
                    // Add the extra mapping for chrome-extension://aaaa... to point to the install location.
                    // We want the /www/ for Cordova apps, and no /www/ for CRX apps.
                    var installSubdir = type == 'crx' ? '/' : '/www/';
                    UrlRemap.aliasUri('^' + chromeExtensionUrl, '^' + chromeExtensionUrl, installUrl + installSubdir, false /* redirect */);
                } else {
                    var pluginsUrl = startLocation.replace(/\/www\/.*/, '/www/plugins/');
                    UrlRemap.aliasUri('^' + pluginsUrl, '^' + pluginsUrl, harnessDir + '/plugins/', false /* redirect */);
                }
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
