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
                    resp.sendTextResponse(405, 'Method Not Allowed\n');
                } else {
                    func(req, resp);
                }
            };
        }

        function pipeRequestToFile(req, destUrl) {
            var outerDeferred = $q.defer();
            var writer = null;
            req.onData = function(arrayBuffer) {
                var ret = $q.when();
                if (writer == null) {
                   ret = ResourcesLoader.createFileWriter(destUrl)
                   .then(function(w) {
                       writer = w;
                   });
                }
                return ret
                .then(function() {
                    var deferred = $q.defer();
                    writer.onwrite = deferred.resolve;
                    writer.onerror = deferred.reject;
                    writer.write(arrayBuffer);
                    return deferred.promise;
                })
                .then(function() {
                    if (req.bytesRemaining === 0) {
                        outerDeferred.resolve();
                    }
                }, outerDeferred.reject);
            };
            return outerDeferred.promise;
        }

        function handlePush(req, resp) {
            var type = req.getQueryParam('type');
            var name = req.getQueryParam('name');
            var url = req.getQueryParam('url');
            if (!(type && name)) {
                resp.sendTextResponse(400, 'Missing required query params type=' + type + ' name=' + name + '\n');
                return;
            }
            var ret = $q.when();
            return ret.then(function() {
                if (!url) {
                    resp.sendTextResponse(400, 'Missing required query param "url"\n');
                    return;
                }
                return AppHarnessUI.destroy()
                .then(function() {
                    return updateApp(type, name, url);
                }).then(function() {
                    notifier.success('Updated ' + name + ' from remote push.');
                    resp.sendTextResponse(200, '');
                }, function(e) {
                    notifier.error(e);
                    resp.sendTextResponse(500, e + '\n');
                });
            });
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
            return AppHarnessUI.destroy();
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

        function updateApp(type, name, url) {
            return AppsService.getAppList()
            .then(function(list) {
                var matches = list && list.filter(function(x) { return x.appId == name; });
                var promise;
                if (list && matches.length > 0) {
                    // App exists.
                    var app = matches[0];
                    app.url = url;
                    promise = $q.when(app);
                } else {
                    // New app.
                    promise = AppsService.addApp(type, url, name).then(function(handler) {
                        var msg = 'Added new app ' + handler.appId + ' from push';
                        notifier.success(msg);
                        return handler;
                    });
                }

                return promise.then(function(theApp) {
                    return AppsService.updateAndLaunchApp(theApp);
                });
            });
        }

        function start() {
            if (server) {
                return;
            }
            server = HttpServer.create()
                .addRoute('/push', ensureMethodDecorator('POST', handlePush))
                .addRoute('/exec', ensureMethodDecorator('POST', handleExec))
                .addRoute('/menu', ensureMethodDecorator('POST', handleMenu))
                .addRoute('/info', ensureMethodDecorator('GET', handleInfo));
            return server.start();
        }

        function getListenAddress() {
            if (listenAddress) {
                return listenAddress;
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
