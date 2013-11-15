(function() {
    'use strict';
    /* global myApp */
    myApp.factory('AppsService', ['$q', 'ResourcesLoader', 'INSTALL_DIRECTORY', 'APPS_JSON', 'pluginMetadata', function($q, ResourcesLoader, INSTALL_DIRECTORY, APPS_JSON, pluginMetadata) {

        // Map of type -> installer.
        var _installerFactories = {};
        // Array of installer objects.
        var _installers = null;

        function createInstallHandlersFromJson(json) {
            var appList = json.appList || [];
            var ret = [];
            for (var i = 0; i < appList.length; i++) {
                var entry = appList[i];
                var factory = _installerFactories[entry.appType];
                var installer = factory.createFromJson(entry.appUrl, entry.appId);
                installer.lastUpdated = entry.lastUpdated && new Date(entry.lastUpdated);
                installer.installPath = entry.installPath;
                installer.plugins = entry.plugins;
                ret.push(installer);
            }
            return ret;
        }

        function readAppsJson() {
            var deferred = $q.defer();
            ResourcesLoader.readJSONFileContents(APPS_JSON)
            .then(function(result) {
                deferred.resolve(result);
            }, function() {
                // Error means first run.
                deferred.resolve({});
            });
            return deferred.promise;
        }

        function initHandlers() {
            if (_installers) {
                return $q.when();
            }

            return readAppsJson()
            .then(function(appsJson) {
                _installers = createInstallHandlersFromJson(appsJson);
            });
        }

        function writeAppsJson() {
            var appsJson = {
                'appList': []
            };
            for (var i = 0; i < _installers.length; ++i) {
                var installer = _installers[i];
                appsJson.appList.push({
                    'appId' : installer.appId,
                    'appType' : installer.type,
                    'appUrl' : installer.url,
                    'lastUpdated': installer.lastUpdated && +installer.lastUpdated,
                    'installPath': installer.installPath,
                    'plugins': installer.plugins
                });
            }

            var stringContents = JSON.stringify(appsJson);
            return ResourcesLoader.writeFileContents(APPS_JSON, stringContents);
        }

        return {
            // return promise with the array of apps
            getAppList : function() {
                return initHandlers()
                .then(function() {
                    return _installers.slice();
                });
            },

            launchApp : function(installer) {
                return installer.launch(_installers.indexOf(installer))
                .then(function(launchUrl) {
                    window.location = launchUrl;
                });
            },

            addApp : function(installerType, appUrl) {
                var installerFactory = _installerFactories[installerType];
                return installerFactory.createFromUrl(appUrl)
                .then(function(installer) {
                    _installers.push(installer);
                    return writeAppsJson()
                    .then(function() {
                        return installer;
                    });
                });
            },

            uninstallApp : function(installer) {
                return installer.deleteFiles()
                .then(function() {
                    _installers.splice(_installers.indexOf(installer), 1);
                    return writeAppsJson();
                });
            },

            getLastRunApp : function() {
                throw new Error('Not implemented.');
            },

            updateApp : function(installer){
                var installPath = INSTALL_DIRECTORY + '/' + installer.appId;
                return installer.updateApp(installPath)
                .then(writeAppsJson);
            },

            registerInstallerFactory : function(installerFactory) {
                _installerFactories[installerFactory.type] = installerFactory;
            }
        };
    }]);
})();
