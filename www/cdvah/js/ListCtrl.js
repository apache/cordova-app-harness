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
(function(){
    'use strict';
    /* global myApp */
    myApp.controller('ListCtrl', ['$location', '$scope', '$routeParams', '$q', 'AppsService', 'HarnessServer', function ($location, $scope, $routeParams, $q, AppsService, HarnessServer) {
        $scope.appList = [];

        function initialise() {
            $scope.$on('$destroy', function() {
                AppsService.onAppListChange = null;
            });
            AppsService.onAppListChange = loadAppsList;
            return loadAppsList()
            .then(function() {
                return HarnessServer.start();
            }).then(function() {
                var getInfoCallback = function() {
                    HarnessServer.getListenAddress(/* skipCache */ true)
                    .then(function(value) {
                        $scope.ipAddress = value ? value : 'Failed to start server';
                    });
                };

                // When getInfo is called, the callback is retained and called every time network info changes.
                // The callback updates the IP.
                navigator.connection.getInfo(getInfoCallback);
            }, function() {
                $scope.ipAddress = 'Failed to start server';
            });
        }

        function loadAppsList() {
            return AppsService.getAppList()
            .then(function(newAppsList){
                newAppsList.sort(function(a, b){
                    if (a.appId < b.appId) {
                        return -1;
                    } else if(a.appId > b.appId) {
                        return 1;
                    }
                    return 0;
                });
                $scope.appList = newAppsList;
            }, function(error){
                console.error(error);
            });
        }

        $scope.launchApp = function(app, event){
            event.stopPropagation();
            return AppsService.launchApp(app)
            .then(null, function(error){
                console.error(error);
            });
        };

        $scope.removeApp = function(app, event) {
            event.stopPropagation();
            var shouldUninstall = confirm('Are you sure you want to uninstall ' + app.appId + '?');
            if(shouldUninstall) {
                return AppsService.uninstallApp(app)
                .then(null, function(error) {
                    console.error(error);
                });
            }
        };

        $scope.showDetails = function(index) {
            $location.path('/details/' + index);
        };

        return initialise();
    }]);
})();


