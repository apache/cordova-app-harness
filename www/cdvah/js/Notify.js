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
    myApp.directive('cdvahNotify', [ '$rootScope', function($rootScope) {
        return {
            scope: {},
            restrict: 'E',
            template: '<div class="notification-container" ng-click="showNotify=false" ng-show="showNotify"><div class="notification" ng-class="notification.css">{{ notification.message }}</div></div>',
            replace: true,
            link: function(scope) {
                $rootScope.$watch('notification', function(newValue) {
                    scope.showNotify = !!newValue;
                    if (newValue) {
                        scope.notification = {};
                        scope.notification.message = newValue.message;
                        scope.notification.css = 'notification-' + newValue.type;
                    }
                });
            }
        };
    }]);

    myApp.factory('notifier', ['$rootScope', function($rootScope) {
        return {
            success: function(msg) {
                console.log(msg);
                $rootScope.notification = { message: msg, type: 'success' };
            },
            error: function(msg) {
                if (typeof(msg) == 'object') {
                    msg = msg.message || msg;
                }
                if (msg && typeof msg != 'string') {
                    msg = JSON.stringify(msg);
                }
                console.error(msg);
                $rootScope.notification = { message: msg, type: 'error' };
            }
        };
    }]);
})();

