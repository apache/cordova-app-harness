(function(){
    "use strict";
    /* global myApp */
    myApp.controller("ListCtrl", [ "$scope", "resourcesLoader", "INSTALL_DIRECTORY", function ($scope, resourcesLoader, INSTALL_DIRECTORY) {

        $scope.appsList = [];

        $scope.loadAppsList = function(source) {
            var gotDirectoriesCallback = function(directoryNames, errorString) {
                if(errorString) {
                    console.error(errorString);
                    alert("There was an error retrieving the list of installed applications. Please try again.");
                } else {
                    $scope.appsList.splice(0, $scope.appsList);
                    angular.extend($scope.appsList, directoryNames);
                    if(source === "deviceready") {
                        $scope.$apply();
                    }
                }
            };
            resourcesLoader.getSubDirectories(INSTALL_DIRECTORY, gotDirectoriesCallback, true);
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