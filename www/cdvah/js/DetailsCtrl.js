(function(){
    'use strict';

    /* global myApp */
    myApp.controller('DetailsCtrl', ['$rootScope', '$scope', '$location', 'AppsService', '$routeParams', function($rootScope, $scope, $location, AppsService, $routeParams) {
        AppsService.getAppList().then(function(appsList) {
            if ($routeParams.index >= 0) {
                $scope.app = appsList[$routeParams.index];
                $rootScope.appTitle = 'Details for ' + $scope.app.appId;
            } else {
                $location.path('/');
            }
            //$scope.$apply();
        });
    }]);
})();
