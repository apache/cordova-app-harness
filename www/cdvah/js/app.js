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

var myApp = angular.module('CordovaAppHarness', ['ngRoute']);


myApp.config(['$routeProvider', function($routeProvider){
    $routeProvider.when('/', {
        templateUrl: 'views/list.html',
        controller: 'ListCtrl'
    });
    $routeProvider.when('/details/:index', {
        templateUrl: 'views/details.html',
        controller: 'DetailsCtrl'
    });
}]);

myApp.factory('urlCleanup', function() {
    return function(url) {
        url = url.replace(/\/$/, '').replace(new RegExp(cordova.platformId + '$'), '').replace(/\/$/, '');
        if (!/^(file|http|https)+:/.test(url)) {
            url = 'http://' + url;
        }
        return url;
    };
});

document.addEventListener('deviceready', function() {
    cordova.filesystem.getDataDirectory(false, function(dirEntry) {
        myApp.value('INSTALL_DIRECTORY', dirEntry.toURL() + 'apps/');
        myApp.value('APPS_JSON', dirEntry.toURL() + 'apps.json');
        window.requestFileSystem(window.TEMPORARY, 1 * 1024 * 1024, function(fs) {
            myApp.value('TEMP_DIR', fs.root.toURL());
            angular.bootstrap(document, ['CordovaAppHarness']);
        }, function() {
            console.error('Failed to get temporary FS');
        });
    });
}, false);
