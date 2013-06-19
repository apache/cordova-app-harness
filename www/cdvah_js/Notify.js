(function() {
    "use strict";
    /* global myApp */
    myApp.directive("cdvahNotify", [ "$rootScope", "$timeout", function($rootScope, $timeout) {
        return {
            scope: {},
            restrict: 'E',
            template: '<div class="notification-container" ng-show="showNotify"><div class="notification" ng-class="notification.css">{{ notification.message }}</div></div>',
            replace: true,
            link: function(scope, element, attrs) {
                $rootScope.$watch('notification', function(newValue) {
                    scope.showNotify = !!newValue;
                    if (newValue) {
                        scope.notification = {};
                        scope.notification.message = newValue.message;
                        scope.notification.css = 'notification-' + newValue.type;

                        $timeout(function() {
                            $rootScope.notification = undefined;
                        }, 5000);
                    }
                });
            }
        };
    }]);

    myApp.factory('notifier', ['$rootScope', function($rootScope) {
        return {
            success: function(msg) {
                $rootScope.notification = { message: msg, type: 'success' };
                $rootScope.$apply();
            },
            error: function(msg) {
                $rootScope.notification = { message: msg, type: 'error' };
                $rootScope.$apply();
            }
        };
    }]);
})();

