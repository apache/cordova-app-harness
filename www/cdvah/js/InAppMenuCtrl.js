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
    myApp.controller('InAppMenuCtrl', ['$rootScope', '$scope', '$window', 'AppsService', 'AppHarnessUI', function($rootScope, $scope, $window, AppsService, AppHarnessUI) {
        var activeApp = AppsService.getActiveApp();
        if (!activeApp) {
            $window.history.back();
        }

        function backButtonListener() {
            $scope.$apply($scope.hideMenu);
        }
        document.addEventListener('backbutton', backButtonListener);
        $scope.$on('$destroy', function() {
            document.removeEventListener('backbutton', backButtonListener);
        });

        $scope.app = activeApp;

        $scope.hideMenu = function() {
            return AppHarnessUI.setVisible(true);
        };

        $scope.restartApp = function() {
            return AppsService.launchApp(activeApp);
        };

        $scope.quitApp = function() {
            return AppsService.quitApp();
        };

        AppHarnessUI.setEventHandler(function(eventName) {
            $scope.$apply(function() {
                if (eventName == 'showMenu') {
                    AppHarnessUI.setVisible(false);
                } else if (eventName == 'destroyed') {
                    $window.history.back();
                } else {
                    console.warn('Unknown message from AppHarnessUI: ' + eventName);
                }
            });
        });
    }]);
})();
