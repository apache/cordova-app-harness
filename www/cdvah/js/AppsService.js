/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
*/
(function() {
    'use strict';
    /* global myApp */
    myApp.factory('AppsService', ['$q', 'ResourcesLoader', 'INSTALL_DIRECTORY', 'APPS_JSON', 'notifier', 'PluginMetadata', 'AppHarnessUI', function($q, ResourcesLoader, INSTALL_DIRECTORY, APPS_JSON, notifier, PluginMetadata, AppHarnessUI) {

        // Map of type -> installer.
        var _installerFactories = {};
        // Array of installer objects.
        var _installers = null;
        // The app that is currently running.
        var activeInstaller = null;

        function createInstallHandlersFromJson(json) {
            var appList = json.appList || [];
            var ret = [];
            for (var i = 0; i < appList.length; i++) {
                var entry = appList[i];
                var factory = _installerFactories[entry.appType];
                var installer = factory.createFromJson(entry.appUrl, entry.appId);
                installer.lastUpdated = entry.lastUpdated && new Date(entry.lastUpdated);
                installer.installPath = entry.installPath;
                installer.plugins = PluginMetadata.process(entry.plugins);
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

        function createAppsJson() {
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
                    'plugins': installer.plugins.raw
                });
            }
            return appsJson;
        }

        function writeAppsJson() {
            if (AppsService.onAppListChange) {
                AppsService.onAppListChange();
            }
            var appsJson = createAppsJson();
            var stringContents = JSON.stringify(appsJson, null, 4);
            return ResourcesLoader.writeFileContents(APPS_JSON, stringContents);
        }

        AppHarnessUI.setEventHandler(function(eventName) {
            console.log('Got event from UI: ' + eventName);
            if (eventName == 'showMenu') {
                AppHarnessUI.createOverlay('app-harness:///cdvahcm/contextMenu.html');
            } else if (eventName == 'hideMenu') {
                AppHarnessUI.destroyOverlay();
            } else if (eventName == 'updateApp') {
                AppsService.updateAndLaunchApp(activeInstaller)
                .then(null, notifier.error);
            } else if (eventName == 'restartApp') {
                // TODO: Restart in place?
                AppsService.launchApp(activeInstaller)
                .then(null, notifier.error);
            } else if (eventName == 'quitApp') {
                AppsService.quitApp();
            }
        });

        var AppsService = {
            // return promise with the array of apps
            getAppList : function() {
                return initHandlers()
                .then(function() {
                    return _installers.slice();
                });
            },

            getAppListAsJson : function() {
                return createAppsJson();
            },

            quitApp : function() {
                if (activeInstaller) {
                    activeInstaller.unlaunch();
                    AppHarnessUI.destroy();
                    activeInstaller = null;
                }
                return $q.when();
            },

            launchApp : function(installer) {
                return AppsService.quitApp()
                .then(function() {
                    activeInstaller = installer;
                    return installer.launch();
                }).then(function(launchUrl) {
                    return AppHarnessUI.create(launchUrl);
                });
            },

            addApp : function(installerType, appUrl, /*optional*/ appId) {
                var installerFactory = _installerFactories[installerType];
                return initHandlers().then(function() {
                    return installerFactory.createFromUrl(appUrl, appId);
                }).then(function(installer) {
                    _installers.push(installer);
                    return writeAppsJson()
                    .then(function() {
                        return installer;
                    });
                });
            },

            editApp : function(oldId, installer) {
                _installers.forEach(function(inst, i) {
                    if (inst.appId == oldId) {
                        _installers.splice(i, 1, installer);
                    }
                });
                return writeAppsJson();
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
                var installPath = INSTALL_DIRECTORY + '/' + encodeURIComponent(installer.appId);
                return installer.updateApp(installPath)
                .then(writeAppsJson);
            },

            updateAndLaunchApp : function(installer) {
                return AppsService.quitApp()
                .then(function() {
                    return AppsService.updateApp(installer);
                }).then(function() {
                    return AppsService.launchApp(installer);
                });
            },

            registerInstallerFactory : function(installerFactory) {
                _installerFactories[installerFactory.type] = installerFactory;
            },

            onAppListChange: null
        };
        return AppsService;
    }]);
})();
