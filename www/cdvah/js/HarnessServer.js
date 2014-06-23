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

// Server actions:
//
// Show in-app overlay menu:
//     curl -v -X POST "http://$IP_ADDRESS:2424/menu"
//
// Execute a JS snippet:
//     curl -v -X POST "http://$IP_ADDRESS:2424/exec?code='alert(1)'"
//
// Starts the app with the given ID (or the first app if none is given):
//     curl -v -X POST "http://$IP_ADDRESS:2424/launch?appId=a.b.c"
//
// Returns JSON of server info / app state:
//     curl -v "http://$IP_ADDRESS:2424/info"
//
// Returns JSON of the asset manifest for the given app ID (or the first app if none is given):
//     curl -v "http://$IP_ADDRESS:2424/assetmanifest?appId=a.b.c"
//
// Deletes a set of files within the given app ID (or the first app if none is given):
//     echo '{"paths":["www/index.html"]}' | curl -v -X POST -d @- "http://$IP_ADDRESS:2424/deletefiles?appId=a.b.c"
//
// Updates a single file within the given app ID (or the first app if none is given):
//     cat file | curl -v -X PUT -d @- "http://$IP_ADDRESS:2424/assetmanifest?appId=a.b.c&appType=cordova&path=www/index.html&etag=1234"
//
// Deletes the app with the given ID (or the first app if none is given):
//     curl -v -X POST "http://$IP_ADDRESS:2424/deleteapp?appId=a.b.c"
//     curl -v -X POST "http://$IP_ADDRESS:2424/deleteapp?all=true" # Delete all apps.
//
// Send a set of files within the given app ID (or the first app if none is given):
//     cat file | curl -v -X POST -d @- "http://$IP_ADDRESS:2424/zippush?appId=a.b.c&appType=cordova"
// The zip file must contain a zipassetmanifest.json file at its root that is a map of "srcPath"->"$etag"}.
//
// Send a partial update of files within the given app ID (or the first app if none is given):
//     cat file | curl -v -X POST -d @- "http://$IP_ADDRESS:2424/zippush?appId=a.b.c&appType=cordova&movetype=file"
// The zip file must contain a zipassetmanifest.json file at its root that is a map of "srcPath"->"$etag"}.
// With this method, the files are moved one at a time and will overwrite any existing file of the same name.
//
// PROTOCOL CHANGES BY VERSION:
// Version 3:
//   - Allow zipassetmanifest to use { "srcPath" => "$etag" } rather than { "srcPath" => { "etag": "foo" } } (still supports either though).
//   - Removed support for custom dstPath within zipassetmanifest.json
//   - Sped up zippush by doing a directory move rather than per-file moves.
//   - Added ?movetype=file to zippush command for old per-file behaviour.
    myApp.factory('HarnessServer', ['$q', 'HttpServer', 'ResourcesLoader', 'AppHarnessUI', 'AppsService', 'APP_VERSION', function($q, HttpServer, ResourcesLoader, AppHarnessUI, AppsService, APP_VERSION) {

        var PROTOCOL_VER = 3;
        var server = null;
        var listenAddress = null;

        function ensureMethodDecorator(method, func) {
            return function(req, resp) {
                if (req.method != method) {
                    throw new HttpServer.ResponseException(405, 'Method Not Allowed');
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
            return AppHarnessUI.fireEvent('showMenu');
        }

        function handleQuit(req, resp) {
            return AppsService.quitApp()
            .then(function() {
                return resp.sendTextResponse(200, '');
            });
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
                throw new HttpServer.ResponseException(412, 'No apps available for launch');
            });
        }

        function getAssetManifestJson(app) {
            return {
                'assetManifest': app && app.directoryManager.getAssetManifest(),
                'assetManifestEtag': app ? app.directoryManager.getAssetManifestEtag() : '0',
                'platform': cordova.platformId,
                'cordovaVer': cordova.version,
                'protocolVer': PROTOCOL_VER
            };
        }

        function handleAssetManifest(req, resp) {
            var appId = req.getQueryParam('appId');
            return AppsService.getAppById(appId)
            .then(function(app) {
                return resp.sendJsonResponse(200, getAssetManifestJson(app));
            });
        }

        function handleDeleteFiles(req, resp) {
            var appId = req.getQueryParam('appId');
            var manifestEtag = req.getQueryParam('manifestEtag');
            return AppsService.getAppById(appId)
            .then(function(app) {
                return req.readAsJson()
                .then(function(requestJson) {
                    if (app) {
                        if (manifestEtag && app.directoryManager.getAssetManifestEtag() !== manifestEtag) {
                            return resp.sendJsonResponse(409, getAssetManifestJson(app));
                        }
                        var paths = requestJson['paths'];
                        for (var i = 0; i < paths.length; ++i) {
                            app.directoryManager.deleteFile(paths[i]);
                        }
                    } else {
                        console.log('Warning: tried to delete files from non-existant app: ' + appId);
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
            var manifestEtag = req.getQueryParam('manifestEtag');
            if (!path || !etag) {
                throw new Error('Request is missing path or etag query params');
            }
            return AppsService.getAppById(appId, appType)
            .then(function(app) {
                // Checking the manifest ETAG is meant to catch the case where
                // the client has cached the manifest from a first push, and
                // wants to validate that it is still valid at the start of a
                // subsequent push (e.g. make sure the device hasn't changed).
                if (manifestEtag && app.directoryManager.getAssetManifestEtag() !== manifestEtag) {
                    return resp.sendJsonResponse(409, getAssetManifestJson(app));
                }
                startUpdateProgress(app, req);
                var tmpUrl = ResourcesLoader.createTmpFileUrl();
                return pipeRequestToFile(req, tmpUrl)
                .then(function() {
                    return importFile(tmpUrl, path, app, etag);
                })
                .then(function() {
                    return incrementUpdateStatusAndSendManifest(app, req, resp);
                });
            });
        }

        // This is set at the beginning of a push to show progress bar
        // across multiple requests.
        function startUpdateProgress(app, req) {
            // This is passed for the first file only, and is used to track total progress.
            var expectTotal = +req.getQueryParam('expectBytes') || req.headers['content-length'];
            app.updatingStatus = 0;
            app.updateBytesTotal = expectTotal;
            app.updateBytesSoFar = 0;
        }

        function incrementUpdateStatusAndSendManifest(app, req, resp) {
            if (app.updatingStatus !== null) {
                // TODO: Add a timeout that resets updatingStatus if no more requests come in.
                app.updateBytesSoFar += +req.headers['content-length'];
                app.updatingStatus = app.updateBytesTotal / app.updateBytesSoFar;
                if (app.updatingStatus === 1) {
                    app.updatingStatus = null;
                    app.lastUpdated = new Date();
                    AppsService.triggerAppListChange();
                    console.log('Update complete.');
                }
            }
            return resp.sendJsonResponse(200, {
                'assetManifestEtag': app.directoryManager.getAssetManifestEtag()
            });
        }

        function importFile(fileUrl, destPath, app, etag) {
            console.log('Adding file: ' + destPath);
            if (destPath == 'www/cordova_plugins.js') {
                destPath = 'orig-cordova_plugins.js';
            }
            return app.directoryManager.addFile(fileUrl, destPath, etag);
        }

        function handleZipPush(req, resp) {
            var appId = req.getQueryParam('appId');
            var appType = req.getQueryParam('appType') || 'cordova';
            var manifestEtag = req.getQueryParam('manifestEtag');
            var movetype = req.getQueryParam('movetype') || 'bulk';
            return AppsService.getAppById(appId, appType)
            .then(function(app) {
                if (manifestEtag && app.directoryManager.getAssetManifestEtag() !== manifestEtag) {
                    return resp.sendJsonResponse(409, getAssetManifestJson(app));
                }
                startUpdateProgress(app, req);
                var tmpZipUrl = ResourcesLoader.createTmpFileUrl();
                var tmpDirUrl = ResourcesLoader.createTmpFileUrl() + '/';
                return pipeRequestToFile(req, tmpZipUrl)
                .then(function() {
                    console.log('Extracting update zip');
                    return ResourcesLoader.extractZipFile(tmpZipUrl, tmpDirUrl);
                })
                .then(function() {
                    // This file looks like:
                    // {"path/within/zip": "$etag" }
                    return ResourcesLoader.readJSONFileContents(tmpDirUrl + 'zipassetmanifest.json');
                }, null, function(unzipPercentage) {
                    app.updatingStatus = unzipPercentage;
                })
                .then(function(zipAssetManifest) {
                    // Support old format of {"path/within/zip": {"etag": "$etag" }}
                    Object.keys(zipAssetManifest).forEach(function(k) {
                        if (typeof zipAssetManifest[k] != 'string') {
                            zipAssetManifest[k] = zipAssetManifest[k]['etag'];
                        }
                    });
                    if (movetype == 'bulk') {
                        console.log('Moving files in bulk');
                        return $q.when()
                        .then(function(){
                            if (zipAssetManifest['www/cordova_plugins.js']) {
                                zipAssetManifest['orig-cordova_plugins.js'] = zipAssetManifest['www/cordova_plugins.js'];
                                delete zipAssetManifest['www/cordova_plugins.js'];
                                return ResourcesLoader.moveFile(tmpDirUrl + 'www/cordova_plugins.js', tmpDirUrl + 'orig-cordova_plugins.js');
                            }
                        }).then(function() {
                            return app.directoryManager.bulkAddFile(zipAssetManifest, tmpDirUrl);
                        });
                    } else {
                        var keys = Object.keys(zipAssetManifest);
                        console.log('Moving '+keys.length+ ' files separately');
                        return $q.when()
                        .then(function next() {
                            var k = keys.shift();
                            if (k) {
                                return importFile(tmpDirUrl + k, k, app, zipAssetManifest[k])
                                .then(next);
                            }
                        });
                    }
                }, function() {
                    throw new HttpServer.ResponseException(400, 'Zip file missing zipassetmanifest.json');
                })
                .then(function() {
                    return incrementUpdateStatusAndSendManifest(app, req, resp);
                })
                .finally(function() {
                    app.updatingStatus = null;
                    ResourcesLoader.delete(tmpZipUrl);
                    ResourcesLoader.delete(tmpDirUrl);
                });
            });
        }

        function handleInfo(req, resp) {
            var activeApp = AppsService.getActiveApp();
            var json = {
                'platform': cordova.platformId,
                'cordovaVer': cordova.version,
                'protocolVer': PROTOCOL_VER,
                'harnessVer': APP_VERSION,
                'supportedAppTypes': ['cordova'],
                'userAgent': navigator.userAgent,
                'activeAppId': activeApp && activeApp.appId,
                'appList': AppsService.getAppListAsJson()
            };
            resp.sendJsonResponse(200, json);
        }

        function start() {
            if (server) {
                return;
            }
            server = new HttpServer()
                .addRoute('/exec', ensureMethodDecorator('POST', handleExec))
                .addRoute('/menu', ensureMethodDecorator('POST', handleMenu))
                .addRoute('/launch', ensureMethodDecorator('POST', handleLaunch))
                .addRoute('/quit', ensureMethodDecorator('POST', handleQuit))
                .addRoute('/info', ensureMethodDecorator('GET', handleInfo))
                .addRoute('/assetmanifest', ensureMethodDecorator('GET', handleAssetManifest))
                .addRoute('/deletefiles', ensureMethodDecorator('POST', handleDeleteFiles))
                .addRoute('/putfile', ensureMethodDecorator('PUT', handlePutFile))
                .addRoute('/zippush', ensureMethodDecorator('POST', handleZipPush))
                .addRoute('/deleteapp', ensureMethodDecorator('POST', handleDeleteApp));
            return server.start();
        }

        function getListenAddress(skipCache) {
            if (listenAddress && !skipCache) {
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
