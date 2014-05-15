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
    myApp.factory('AppHarnessUI', ['$q', function($q) {
        return {
            create: function(url) {
                var deferred = $q.defer();
                cordova.plugins.appharnessui.create(url, deferred.resolve);
                return deferred.promise;
            },
            destroy: function() {
                var deferred = $q.defer();
                cordova.plugins.appharnessui.destroy(deferred.resolve);
                return deferred.promise;
            },
            createOverlay: function() {
                var deferred = $q.defer();
                cordova.plugins.appharnessui.createOverlay('app-harness:///cdvahcm/contextMenu.html', deferred.resolve);
                return deferred.promise;
            },
            destroyOverlay: function() {
                var deferred = $q.defer();
                cordova.plugins.appharnessui.destroyOverlay(deferred.resolve);
                return deferred.promise;
            },
            setEventHandler: function(f) {
                cordova.plugins.appharnessui.onEvent = f;
            },
            evalJs: function(code) {
                var deferred = $q.defer();
                cordova.plugins.appharnessui.evalJs(code, deferred.resolve);
                return deferred.promise;
            }
        };
    }]);
})();