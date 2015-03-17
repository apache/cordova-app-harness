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
    myApp.factory('AppsService', ['$q', '$location', 'ResourcesLoader', 'INSTALL_DIRECTORY', 'APPS_JSON', 'AppHarnessUI', function($q, $location, ResourcesLoader, INSTALL_DIRECTORY, APPS_JSON, AppHarnessUI) {
        // Map of type -> installer.
        var _installerFactories = Object.create(null);
        // Array of installer objects.
        var _installers = null;
        // The app that is currently running.
        var activeInstaller = null;

        function readAppsJson() {
            var deferred = $q.defer();
            ResourcesLoader.readJSONFileContents(APPS_JSON)
            .then(function(result) {
                if (result['fileVersion'] !== 1) {
                    console.warn('Ignoring old version of apps.json');
                    result = {};
                }
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
            .then(function(json) {
                var appList = json['appList'] || [];
                _installers = [];
                var i = -1;
                return $q.when()
                .then(function next() {
                    var entry = appList[++i];
                    if (!entry) {
                        return;
                    }
                    var Ctor = _installerFactories[entry['appType']];
                    return new Ctor().initFromJson(entry)
                    .then(function(app) {
                        _installers.push(app);
                        return next();
                    }, next);
                });
            });
        }

        function createAppsJson() {
            var appsJson = {
                'fileVersion': 1,
                'appList': []
            };
            for (var i = 0; i < _installers.length; ++i) {
                var installer = _installers[i];
                appsJson.appList.push(installer.toDiskJson());
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

        var AppsService = {
            // return promise with the array of apps
            getAppList : function() {
                return initHandlers()
                .then(function() {
                    return _installers.slice();
                });
            },

            getActiveApp: function() {
                return activeInstaller;
            },

            getAppListAsJson : function() {
                return createAppsJson();
            },

            // If no appId, then return the first app.
            // If appId and appType, then create it if it doesn't exist.
            // Else: return null.
            getAppById : function(appId, /* optional */ appType) {
                return initHandlers()
                .then(function() {
                    var matches = _installers;
                    if (appId) {
                        matches = _installers.filter(function(x) {
                            return x.appId == appId;
                        });
                    }
                    if (matches.length > 0) {
                        return matches[0];
                    }
                    if (appType) {
                        return AppsService.addApp(appType, appId);
                    }
                    return null;
                });
            },

            quitApp : function() {
                if (activeInstaller) {
                    activeInstaller.unlaunch();
                    activeInstaller = null;
                    return AppHarnessUI.destroy();
                }
                return $q.when();
            },

            launchApp : function(installer) {
                // Determine whether we're relaunching the same app as is already active.
                var activeAppId = activeInstaller && activeInstaller.appId;
                var newAppId = installer && installer.appId;
                var relaunch = activeAppId && newAppId && activeAppId === newAppId;

                return $q.when()
                .then(function() {
                    // If we're relaunching the active app, move on.
                    // Otherwise, quit the active app.
                    // TODO(maxw): Determine whether we actually ever need to quit the app.
                    if (relaunch) {
                        return $q.when();
                    } else {
                        return AppsService.quitApp();
                    }
                }).then(function() {
                    activeInstaller = installer;
                    return installer.launch();
                }).then(function(launchUrl) {
                    return $q.when(installer.getPluginMetadata())
                    .then(function(pluginMetadata) {
                        $location.path('/inappmenu');
                        // If we're relaunching the active app, just reload the existing webview.
                        // Otherwise, create a new one.
                        var configXmlUrl = installer.directoryManager.rootURL + 'config.xml';
                        var webViewType = 'system';
                        if (relaunch) {
                            if (webViewType != curWebViewType) {
                                curWebViewType = webViewType;
                                return AppHarnessUI.destroy()
                                .then(function() {
                                    return AppHarnessUI.create(launchUrl, configXmlUrl, pluginMetadata, webViewType);
                                });
                            } else {
                                return AppHarnessUI.reload(launchUrl, configXmlUrl, pluginMetadata);
                            }
                        } else {
                            curWebViewType = webViewType;
                            return AppHarnessUI.create(launchUrl, configXmlUrl, pluginMetadata, webViewType);
                        }
                    }).then(function() {
                        if (AppsService.onAppListChange) {
                            AppsService.onAppListChange();
                        }
                    });
                });
            },

            addApp : function(appType, /* optional */ appId) {
                var installPath = INSTALL_DIRECTORY + 'app' + Math.floor(Math.random() * 0xFFFFFFFF).toString(36) + '/';
                return initHandlers().then(function() {
                    var Ctor = _installerFactories[appType];
                    return new Ctor().init(installPath, appId);
                }).then(function(installer) {
                    _installers.push(installer);
                    return writeAppsJson()
                    .then(function() {
                        return installer;
                    });
                });
            },

            uninstallAllApps : function() {
                return this.quitApp()
                .then(function() {
                    var deletePromises = [];
                    for (var i = 0; i < _installers.length; ++i) {
                        deletePromises.push(AppsService.uninstallApp(_installers[i]));
                    }
                    return $q.all(deletePromises);
                });
            },

            uninstallApp : function(installer) {
                var ret = $q.when();
                if (installer == activeInstaller) {
                    ret = this.quitApp();
                }
                return ret.then(function() {
                    return installer.deleteFiles();
                }).then(function() {
                    _installers.splice(_installers.indexOf(installer), 1);
                    return writeAppsJson();
                });
            },

            triggerAppListChange: function() {
                return writeAppsJson();
            },

            registerInstallerFactory : function(installerFactory) {
                 _installerFactories[installerFactory.type] = installerFactory;
            },

            onAppListChange: null
        };
        return AppsService;
    }]);
})();
