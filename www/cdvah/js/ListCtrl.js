(function(){
    "use strict";
    /* global myApp */
    myApp.controller("ListCtrl", [ "AppBundle", "notifier", "$rootScope", "$scope", "$routeParams", "AppsService", function (AppBundle, notifier, $rootScope, $scope, $routeParams, AppsService) {
        $scope.appList = [];
        $rootScope.appTitle = 'Cordova App Harness';

        initialise();

        function initialise() {
            //if we are navigating here after running an app, reset any aliases set for the app by app harness or any aliases setup by the previous app
            return AppBundle.reset()
            .then(function(){
                if($routeParams.lastLaunched) {
                    return AppsService.getLastRunApp()
                    .then(AppsService.launchApp, function(e){
                        e = e || {};
                        console.error("Error launching last run app: " + e);
                        notifier.error('' + e);
                    });
                }
                else if($routeParams.updateLastLaunched) {
                    var app;
                    // updating may take a while so we show the apps list like we normally do
                    return $scope.loadAppsList()
                    .then(AppsService.getLastRunApp)
                    .then(function(_app){
                        app = _app;
                        return AppsService.updateApp(app);
                    })
                    .then(function(){
                        return AppsService.launchApp(app);
                    }, function(e){
                        e = e || {};
                        console.error("Error updating last run app: " + e);
                        notifier.error('' + e);
                    });
                } else {
                    return $scope.loadAppsList();
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
                var str = "There was an error retrieving the apps list";
                console.error(str + ": " + error);
                notifier.error('' + error);
            });
        };

        $scope.launchApp = function(app){
            return AppsService.launchApp(app)
            .then(null, function(error){
                console.error("Error during loading of app " + app.appId + ": " + error);
                notifier.error('' + error);
            });
        };

        $scope.updateApp = function(app) {
            return AppsService.updateApp(app)
            .then(function(){
                notifier.success("Updated successfully");
                console.log('successfully updated');
            }, function(error){
                console.error("Error during updating of app " + app.appId + ": " + error);
                notifier.error('' + error);
            });
        };

        $scope.removeApp = function(app) {
            var shouldUninstall = confirm("Are you sure you want to uninstall " + app.appId + "?");
            if(shouldUninstall) {
                return AppsService.uninstallApp(app)
                .then(function() {
                    return $scope.loadAppsList();
                }, function(error) {
                    console.error(error);
                    notifier.error('' + error);
                });
            }
        }
    }]);
})();


