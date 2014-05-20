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
    /* global chrome */
    myApp.factory('HarnessServer', ['$q', 'HttpServer', 'ResourcesLoader', 'AppHarnessUI', 'AppsService', 'notifier', function($q, HttpServer, ResourcesLoader, AppHarnessUI, AppsService, notifier) {

        var server = null;
        var listenAddress = null;

        function ensureMethodDecorator(method, func) {
            return function(req, resp) {
                if (req.method != method) {
                    return resp.sendTextResponse(405, 'Method Not Allowed\n');
                }
                return func(req, resp);
            };
        }

        function pipeRequestToFile(req, destUrl) {
            var writer = null;
            function handleChunk(arrayBuffer) {
                var ret = $q.when();
                if (writer == null) {
                   ret = ResourcesLoader.createFileWriter(destUrl)
                   .then(function(w) {
                       writer = w;
                   });
                }
                return ret.then(function() {
                    var deferred = $q.defer();
                    writer.onwrite = deferred.resolve;
                    writer.onerror = function() {
                      deferred.reject(writer.error);
                    };
                    writer.write(arrayBuffer);
                    return deferred.promise;
                })
                .then(function() {
                    if (req.bytesRemaining > 0) {
                        return req.readChunk().then(handleChunk);
                    }
                });
            }
            return req.readChunk().then(handleChunk);
        }

        function handleExec(req, resp) {
            var js = req.getQueryParam('code');
            return AppHarnessUI.evalJs(js)
            .then(function() {
                resp.sendTextResponse(200, '');
            });
        }

        function handleMenu(req, resp) {
            resp.sendTextResponse(200, '');
            return AppHarnessUI.createOverlay();
        }

        function handleLaunch(req, resp) {
            var appId = req.getQueryParam('appId');
            return AppsService.getAppById(appId)
            .then(function(app) {
                if (app) {
                    return AppsService.launchApp(app)
                    .then(function() {
                        return resp.sendTextResponse(200, '');
                    });
                }
                return resp.sendTextResponse(412, 'No apps available for launch\n');
            });
        }

        function handleAssetManifest(req, resp) {
            var appId = req.getQueryParam('appId');
            return AppsService.getAppById(appId)
            .then(function(app) {
                if (app) {
                    return app.directoryManager.getAssetManifest();
                }
                return null;
            }).then(function(assetManifest) {
                resp.sendJsonResponse({
                    'assetManifest': assetManifest
                });
            });
        }

        function handlePrepUpdate(req, resp) {
            var appId = req.getQueryParam('appId');
            var appType = req.getQueryParam('appType') || 'cordova';
            return AppsService.getAppById(appId, appType)
            .then(function(app) {
                return req.readAsJson()
                .then(function(requestJson) {
                    app.updatingStatus = 0;
                    app.updateBytesTotal = +requestJson['transferSize'];
                    app.updateBytesSoFar = 0;
                    return resp.sendTextResponse(200, '');
                });
            });
        }

        function handleDeleteFiles(req, resp) {
            var appId = req.getQueryParam('appId');
            var appType = req.getQueryParam('appType') || 'cordova';
            return AppsService.getAppById(appId, appType)
            .then(function(app) {
                return req.readAsJson()
                .then(function(requestJson) {
                    var paths = requestJson['paths'];
                    for (var i = 0; i < paths.length; ++i) {
                        app.directoryManager.deleteFile(paths[i]);
                    }
                    return resp.sendTextResponse(200, '');
                });
            });
        }

        function handleDeleteApp(req, resp) {
            var appId = req.getQueryParam('appId');
            var all = req.getQueryParam('all');
            var ret;
            if (all) {
                ret = AppsService.uninstallAllApps();
            } else {
                ret = AppsService.getAppById(appId)
                .then(function(app) {
                    if (app) {
                        return AppsService.uninstallApp(app);
                    }
                });
            }
            return ret.then(function() {
                return resp.sendTextResponse(200, '');
            });
        }

        function handlePutFile(req, resp) {
            var appId = req.getQueryParam('appId');
            var appType = req.getQueryParam('appType') || 'cordova';
            var path = req.getQueryParam('path');
            var etag = req.getQueryParam('etag');
            if (!path || !etag) {
                throw new Error('Request is missing path or etag query params');
            }
            return AppsService.getAppById(appId, appType)
            .then(function(app) {
                var tmpUrl = ResourcesLoader.createTmpFileUrl();
                return pipeRequestToFile(req, tmpUrl)
                .then(function() {
                    var ret = $q.when();
                    if (path == 'www/cordova_plugins.js') {
                        path = 'orig-cordova_plugins.js';
                    }
                    if (path == 'www/config.xml') {
                        ret = ret.then(function() {
                          return ResourcesLoader.downloadFromUrl(tmpUrl, tmpUrl + '-2');
                        });
                    }
                    ret = ret.then(function() {
                        return app.directoryManager.addFile(tmpUrl, path, etag);
                    });
                    if (path == 'www/config.xml') {
                        ret = ret.then(function() {
                            return app.directoryManager.addFile(tmpUrl + '-2', 'config.xml', etag);
                        });
                    }
                    if (path == 'config.xml' || path == 'www/config.xml') {
                        ret = ret.then(function() {
                            return app.readConfigXml();
                        });
                    } else if (path == 'orig-cordova_plugins.js') {
                        ret = ret.then(function() {
                            return app.readCordovaPluginsFile();
                        });
                    }
                    return ret;
                })
                .then(function() {
                    app.updateBytesSoFar += +req.headers['content-length'];
                    app.updatingStatus = app.updateBytesTotal / app.updateBytesSoFar;
                    if (app.updatingStatus === 1) {
                        app.updatingStatus = null;
                        app.lastUpdated = new Date();
                        notifier.success('Update complete.');
                    }
                    return resp.sendTextResponse(200, '');
                });
            });
        }

        function handleInfo(req, resp) {
            var json = {
                'platform': cordova.platformId,
                'cordovaVer': cordova.version,
                'protocolVer': 2,
                'userAgent': navigator.userAgent,
                'appList': AppsService.getAppListAsJson()
            };
            resp.sendJsonResponse(json);
        }

        function start() {
            if (server) {
                return;
            }
            server = new HttpServer()
                .addRoute('/exec', ensureMethodDecorator('POST', handleExec))
                .addRoute('/menu', ensureMethodDecorator('POST', handleMenu))
                .addRoute('/launch', ensureMethodDecorator('POST', handleLaunch))
                .addRoute('/info', ensureMethodDecorator('GET', handleInfo))
                .addRoute('/assetmanifest', ensureMethodDecorator('GET', handleAssetManifest))
                .addRoute('/prepupdate', ensureMethodDecorator('POST', handlePrepUpdate))
                .addRoute('/deletefiles', ensureMethodDecorator('POST', handleDeleteFiles))
                .addRoute('/deleteapp', ensureMethodDecorator('POST', handleDeleteApp))
                .addRoute('/putfile', ensureMethodDecorator('PUT', handlePutFile));
            return server.start();
        }

        function getListenAddress() {
            if (listenAddress) {
                return $q.when(listenAddress);
            }
            var deferred = $q.defer();
            chrome.socket.getNetworkList(function(interfaces) {
                // Filter out ipv6 addresses.
                var ret = interfaces.filter(function(i) {
                    return i.address.indexOf(':') === -1;
                }).map(function(i) {
                    return i.address;
                }).join(', ');
                listenAddress = ret;
                deferred.resolve(ret);
            });
            return deferred.promise;
        }

        return {
            start: start,
            getListenAddress: getListenAddress
        };
    }]);
})();
