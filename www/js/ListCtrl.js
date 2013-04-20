(function(){
    "use strict";
    /* global myApp */
    myApp.controller("ListCtrl", [ "$scope", "AppsService", function ($scope, AppsService) {

        $scope.appsList = [];

        $scope.loadAppsList = function( source ) {
            AppsService.getAppsList()
            .then(function(newAppsList){
                //clear the old apps list
                $scope.appsList.splice(0, $scope.appsList.length);
                angular.extend($scope.appsList, newAppsList);
                if(source === "deviceready") {
                    $scope.$apply();
                }
            }, function(error){
                var str = "There was an error retrieving the apps list";
                console.error(str + JSON.stringify(error));
                alert(str);
            });
        };

        $scope.launchApp = function(app){
            AppsService.launchApp(app)
            .then(null, function(error){
                console.error("Error during loading of app: " + error);
                alert("Something went wrong during the loading of the app. Please try again.");
            });
        };

        $scope.refreshApp = function(app) {
            alert("refreshApp called: " + app);
        };

        $scope.removeApp = function(app) {
            alert("removeApp called: " + app);
        };

        document.addEventListener("deviceready", function() { $scope.loadAppsList("deviceready"); }, false);
    }]);
})();