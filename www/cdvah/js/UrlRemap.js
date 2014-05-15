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
    myApp.factory('UrlRemap', ['$q', function($q) {

        // URI aliasing : the ability to launch an app in the harness, query the document.location and get the same location as would have been got if you run the app separately
        // Without URI aliasing, document.location in the harness would give something like file:///APP_HARNESS_INSTALLED_APPS_LOCATION/www/index.html

        function aliasUri(sourceUriMatchRegex, sourceUriReplaceRegex, replaceString, redirectToReplacedUrl, allowFurtherRemapping) {
            var deferred = $q.defer();
            cordova.plugins.urlremap.addAlias(sourceUriMatchRegex, sourceUriReplaceRegex, replaceString, redirectToReplacedUrl, !!allowFurtherRemapping, function(succeded) {
                if (succeded){
                    deferred.resolve();
                } else {
                    deferred.reject(new Error('Unable to set up uri aliasing'));
                }
            });
            return deferred.promise;
        }

        function setResetUrl(url) {
            var deferred = $q.defer();
            cordova.plugins.urlremap.setResetUrl(url, deferred.resolve);
            return deferred.promise;
        }

        function injectJsForUrl(url, js) {
            var deferred = $q.defer();
            cordova.plugins.urlremap.injectJsForUrl(url, js, deferred.resolve);
            return deferred.promise;
        }

        function reset() {
            var deferred = $q.defer();
            cordova.plugins.urlremap.clearAllAliases(deferred.resolve);
            return deferred.promise;
        }

        function escapeRegExp(str) {
            return str.replace(/[-\[\]\/{}()*+?.\\^$|]/g, '\\$&');
        }

        return {
            aliasUri: aliasUri,
            reset: reset,
            setResetUrl: setResetUrl,
            injectJsForUrl: injectJsForUrl,
            escapeRegExp: escapeRegExp
        };

    }]);
})();
