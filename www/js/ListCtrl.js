(function(){
    "use strict";
    /* global myApp */
    myApp.controller("ListCtrl", [ "$scope", "$routeParams", "AppsService", function ($scope, $routeParams, AppsService) {

        $scope.appsList = [];

        function initialise() {
            if($routeParams.lastLaunched) {
                return AppsService.getLastRunApp()
                .then(AppsService.launchApp, function(e){
                    e = e || {};
                    console.error("Error launching last run app: " + e.message);
                    alert("Error launching last run app. Please try again.");
                });
            }
            else if($routeParams.updateLastLaunched) {
                var app;
                // updating may take a while so we show the apps list like we normally do
                return $scope.loadAppsList(true)
                .then(AppsService.getLastRunApp)
                .then(function(_app){
                    app = _app;
                    return AppsService.updateApp(app);
                })
                .then(function(){
                    return AppsService.launchApp(app);
                }, function(e){
                    e = e || {};
                    console.error("Error updating last run app: " + e.message);
                    alert("Error updating last run app. Please try again.");
                });
            }
            else {
                return $scope.loadAppsList(true);
            }
        }

        $scope.loadAppsList = function(callApply) {
            return AppsService.getAppsList()
            .then(function(newAppsList){
                newAppsList.sort();
                //clear the old apps list
                $scope.appsList.splice(0, $scope.appsList.length);
                angular.extend($scope.appsList, newAppsList);
                if(callApply) {
                    $scope.$apply();
                }
            }, function(error){
                var str = "There was an error retrieving the apps list";
                console.error(str + JSON.stringify(error));
                alert(str);
            });
        };

        $scope.launchApp = function(app){
            return AppsService.launchApp(app)
            .then(null, function(error){
                console.error("Error during loading of app " + app + ": " + error);
                alert("Something went wrong during the loading of the app. Please try again.");
            });
        };

        $scope.updateApp = function(app) {
            return AppsService.updateApp(app)
            .then(function(){
                alert("Updated successfully");
            }, function(error){
                console.error("Error during updating of app " + app + ": " + error);
                alert("Something went wrong during the updating of the app. Please try again.");
            });
        };

        $scope.removeApp = function(app) {
            var shouldUninstall = confirm("Are you sure you want to uninstall " + app + "?");
            if(shouldUninstall) {
                return AppsService.uninstallApp(app)
                .then(function() { $scope.loadAppsList(true); }, function(error){
                    console.error("Error during uninstall of app " + app + ": " + error);
                    alert("Something went wrong during the uninstall of the app. Please try again.");
                });
            }
        };

        document.addEventListener("deviceready", initialise, false);
    }]);
})();