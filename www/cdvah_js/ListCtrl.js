(function(){
    "use strict";
    /* global myApp */
    myApp.controller("ListCtrl", [ "notifier", "$rootScope", "$scope", "$location", "$routeParams", "AppsService", function (notifier, $rootScope, $scope, $location, $routeParams, AppsService) {

        $scope.appsList = [];
        $rootScope.appTitle = 'Cordova App Harness';

        function clearAppBundleAliases(){
            var deferred = Q.defer();
            var appBundle = cordova.require("AppBundle.AppBundle");

            try {
                appBundle.clearAllAliases(function(succeded){
                    if(succeded){
                        deferred.resolve();
                    } else {
                        deferred.reject(new Error("Unable to clear old url aliases. Please restart App Harness."));
                    }
                });
            } catch(e) {
                deferred.reject(new Error(e));
            } finally {
                return deferred.promise;
            }
        }

        function initialise() {
            //if we are navigating here after running an app, reset any aliases set for the app by app harness or any aliases setup by the previous app
            return clearAppBundleAliases()
            .then(function(){
                if($routeParams.lastLaunched) {
                    return AppsService.getLastRunApp()
                    .then(AppsService.launchApp, function(e){
                        e = e || {};
                        console.error("Error launching last run app: " + e);
                        notifier.error("Error launching last run app. Please try again.");
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
                        console.error("Error updating last run app: " + e);
                        notifier.error("Error updating last run app. Please try again.");
                    });
                }
                else {
                    return $scope.loadAppsList(true);
                }
            });
        }

        $scope.loadAppsList = function(callApply) {
            return AppsService.getAppsList(true /* get full information about the app */)
            .then(function(newAppsList){
                newAppsList.sort(function(a, b){
                    if(a.Name < b.Name) {
                        return -1;
                    } else if(a.Name > b.Name) {
                        return 1;
                    }
                    return 0;
                });
                //clear the old apps list
                $scope.appsList.splice(0, $scope.appsList.length);
                angular.extend($scope.appsList, newAppsList);
                if(callApply) {
                    $scope.$apply();
                }
            }, function(error){
                var str = "There was an error retrieving the apps list";
                console.error(str + ": " + error);
                notifier.error(str);
            });
        };

        $scope.launchApp = function(app){
            return AppsService.launchApp(app)
            .then(null, function(error){
                console.error("Error during loading of app " + app + ": " + error);
                notifier.error("Something went wrong during the loading of the app. Please try again." + error);
            });
        };

        $scope.updateApp = function(app) {
            return AppsService.updateApp(app)
            .then(function(){
                notifier.success("Updated successfully");
                console.log('successfully updated');
            }, function(error){
                console.error("Error during updating of app " + app + ": " + error);
                notifier.error("Something went wrong during the updating of the app. Please try again.");
            });
        };

        $scope.removeApp = function(app) {
            var shouldUninstall = confirm("Are you sure you want to uninstall " + app + "?");
            if(shouldUninstall) {
                return AppsService.uninstallApp(app)
                .then(function() { $scope.loadAppsList(true); }, function(error){
                    console.error("Error during uninstall of app " + app + ": " + error);
                    notifier.error("Something went wrong during the uninstall of the app. Please try again.");
                });
            }
        };

        document.addEventListener("deviceready", initialise, false);
    }]);
})();


