(function(){
    'use strict';
    /* global myApp */
    myApp.controller('ListCtrl', ['$location', 'notifier', '$rootScope', '$scope', '$routeParams', '$q', 'AppsService', 'HarnessServer', function ($location, notifier, $rootScope, $scope, $routeParams, $q, AppsService, HarnessServer) {
        $scope.appList = [];
        $rootScope.appTitle = document.title;

        function initialise() {
            $scope.$on('$destroy', function() {
                AppsService.onAppListChange = null;
            });
            AppsService.onAppListChange = loadAppsList;
            return loadAppsList()
            .then(function() {
                return HarnessServer.start();
            }).then(function() {
                return HarnessServer.getListenAddress()
                .then(function(value) {
                    $scope.ipAddress = value;
                });
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
                notifier.error(error);
            });
        }

        $scope.launchApp = function(app, event){
            event.stopPropagation();
            return AppsService.launchApp(app)
            .then(null, function(error){
                notifier.error(error);
            });
        };

        $scope.updateApp = function(app, event) {
            event.stopPropagation();
            return AppsService.updateApp(app)
            .then(function(){
                notifier.success('Updated successfully');
            }, function(error) {
                notifier.error(error);
            });
        };

        $scope.removeApp = function(app, event) {
            event.stopPropagation();
            var shouldUninstall = confirm('Are you sure you want to uninstall ' + app.appId + '?');
            if(shouldUninstall) {
                return AppsService.uninstallApp(app)
                .then(null, function(error) {
                    notifier.error(error);
                });
            }
        };

        $scope.editApp = function(app, event) {
            event.stopPropagation();
            $location.path('/edit/' + app.appId);
        };

        $scope.showDetails = function(index) {
            $location.path('/details/' + index);
        };

        return initialise();
    }]);
})();


