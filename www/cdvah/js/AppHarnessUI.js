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
    myApp.factory('AppHarnessUI', ['$q', 'pluginIdToServiceNames', function($q, pluginIdToServiceNames) {
        function createServiceNameWhitelist(pluginMetadata) {
            var ret = [];
            Object.keys(pluginMetadata).forEach(function(pluginId) {
                var serviceNames = pluginIdToServiceNames[pluginId];
                if (serviceNames) {
                    ret.push.apply(ret, serviceNames);
                }
            });
            if (cordova.platformId == 'android') {
                // This is a plugin bundled with the platform.
                ret.push('CoreAndroid');
                // Needed for launching to work.
                ret.push('UrlRemap');
            }
            return ret;
        }

        return {
            create: function(startUrl, configXmlUrl, pluginMetadata, webViewType) {
                var deferred = $q.defer();
                var serviceNames = createServiceNameWhitelist(pluginMetadata);
                cordova.plugins.appharnessui.create(startUrl, configXmlUrl, serviceNames, webViewType, deferred.resolve);
                return deferred.promise;
            },
            destroy: function() {
                var deferred = $q.defer();
                cordova.plugins.appharnessui.destroy(deferred.resolve);
                return deferred.promise;
            },
            reload: function(startUrl, configXmlUrl, pluginMetadata) {
                var deferred = $q.defer();
                var serviceNames = createServiceNameWhitelist(pluginMetadata);
                cordova.plugins.appharnessui.reload(startUrl, configXmlUrl, serviceNames, deferred.resolve);
                return deferred.promise;
            },
            setVisible: function(value) {
                var deferred = $q.defer();
                cordova.plugins.appharnessui.setVisible(value, deferred.resolve);
                return deferred.promise;
            },
            setEventHandler: function(f) {
                cordova.plugins.appharnessui.onEvent = f && function(type) {
                    $q.when().then(function() {
                        f(type);
                    });
                };
            },
            fireEvent: function(type) {
                if (cordova.plugins.appharnessui.onEvent) {
                    cordova.plugins.appharnessui.onEvent(type);
                }
            },
            evalJs: function(code) {
                var deferred = $q.defer();
                cordova.plugins.appharnessui.evalJs(code, deferred.resolve);
                return deferred.promise;
            }
        };
    }]);
})();
