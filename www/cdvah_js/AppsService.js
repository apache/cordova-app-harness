(function() {
    "use strict";
    /* global myApp */
    myApp.factory("AppsService", [ "ResourcesLoader", "INSTALL_DIRECTORY", "APPS_JSON", function(ResourcesLoader, INSTALL_DIRECTORY, APPS_JSON) {

        var platformId = cordova.platformId;
        // Map of type -> installer.
        var _installerFactories = {};

        var _installers = null;
        var _lastLaunchedAppId = null;

        function createInstallHandlersFromJson(json) {
            var appList = json['appList'] || [];
            var ret = [];
            for (var i = 0, entry; entry = appList[i]; ++i) {
                var factory = _installerFactories[entry['appType']];
                var installer = factory.createFromJson(entry['appUrl'], entry['appId']);
                installer.lastUpdated = entry['lastUpdated'] && new Date(entry['lastUpdated']);
                installer.installPath = entry['installPath'];
                ret.push(installer);
            }
            return ret;
        }

        function readAppsJson() {
            var deferred = Q.defer();
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
                return Q();
            }

            return readAppsJson()
            .then(function(appsJson) {
                _lastLaunchedAppId  = appsJson['lastLaunched'];
                _installers = createInstallHandlersFromJson(appsJson);
            });
        }

        function writeAppsJson() {
            var appsJson = {
                'lastLaunched': _lastLaunchedAppId,
                'appList': []
            };
            var appList = appsJson['appList'];
            for (var i = 0, installer; installer = _installers[i]; ++i) {
                appList.push({
                    'appId' : installer.appId,
                    'appType' : installer.type,
                    'appUrl' : installer.url,
                    'lastUpdated': installer.lastUpdated && +installer.lastUpdated,
                    'installPath': installer.installPath
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
                _lastLaunchedAppId = installer.appId;
                return writeAppsJson()
                .then(function() {
                    var installPath = INSTALL_DIRECTORY + '/' + installer.appId;
                    return installer.launch(installPath);
                })
                .then(function(launchUrl) {
                    window.location = launchUrl;
                });
            },

            addApp : function(installerType, appUrl) {
                var installerFactory = _installerFactories[installerType];
                return Q.fcall(function(){
                    return installerFactory.createFromUrl(appUrl);
                })
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
                    return writeAppsJson()
                });
            },

            getLastRunApp : function() {
                throw new Error('Not implemented.');
            },

            updateApp : function(installer){
                return Q.fcall(function() {
                    var installPath = INSTALL_DIRECTORY + '/' + installer.appId;
                    return installer.updateApp(installPath)
                    .then(writeAppsJson);
                });
            },

            registerInstallerFactory : function(installerFactory) {
                _installerFactories[installerFactory.type] = installerFactory;
            }
        };
    }]);
})();
