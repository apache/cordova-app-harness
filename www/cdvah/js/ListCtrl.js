(function(){
    'use strict';
    /* global myApp */
    myApp.controller('ListCtrl', ['$location', 'notifier', '$rootScope', '$scope', '$routeParams', 'AppsService', function ($location, notifier, $rootScope, $scope, $routeParams, AppsService) {
        $scope.appList = [];
        $rootScope.appTitle = 'Cordova App Harness';

        function initialise() {
            return $scope.loadAppsList()
            .then(AppsService.getAppList)
            .then(function(appList) {
                var action = $routeParams.action;
                if (action) {
                    var appIndex = +$routeParams.appIndex;
                    var activeApp = appList[appIndex];
                    if (action == 'restart') {
                        return AppsService.launchApp(activeApp)
                        .then(null, function(e){
                            console.error('Error launching last run app: ' + e);
                            notifier.error('' + e);
                        });
                    } else if (action == 'update') {
                        // updating may take a while so we show the apps list like we normally do
                        return AppsService.updateApp(activeApp)
                        .then(function() {
                            return AppsService.launchApp(activeApp);
                        }).then(null, function(e){
                            console.error('Error updating last run app: ' + e);
                            notifier.error('' + e);
                        });
                    }
                }
            });
        }

        $scope.loadAppsList = function() {
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
                var str = 'There was an error retrieving the apps list';
                console.error(str + ': ' + error);
                notifier.error('' + error);
            });
        };

        $scope.launchApp = function(app, event){
            event.stopPropagation();
            return AppsService.launchApp(app)
            .then(null, function(error){
                console.error('Error during loading of app ' + app.appId + ': ' + error);
                notifier.error('' + error);
            });
        };

        $scope.updateApp = function(app, event) {
            event.stopPropagation();
            return AppsService.updateApp(app)
            .then(function(){
                notifier.success('Updated successfully');
                console.log('successfully updated');
            }, function(error){
                console.error('Error during updating of app ' + app.appId + ': ' + error);
                notifier.error('' + error);
            });
        };

        $scope.removeApp = function(app, event) {
            event.stopPropagation();
            var shouldUninstall = confirm('Are you sure you want to uninstall ' + app.appId + '?');
            if(shouldUninstall) {
                return AppsService.uninstallApp(app)
                .then(function() {
                    return $scope.loadAppsList();
                }, function(error) {
                    console.error(error);
                    notifier.error('' + error);
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

        initialise();
    }]);
})();


