(function(){
    "use strict";
    /* global myApp */
    myApp.controller("AddCtrl", ["$scope", "AppsService", function ($scope, AppsService) {

        $scope.appData = {
            appName : "",
            appSource : "pattern",
            appSourcePattern : "",
            appSourceServe  : ""
        };

        $scope.addApp = function() {
            var serviceCall;
            if($scope.appData.appSource === "pattern") {
                if(!$scope.appData.appSourcePattern) {
                    alert("Url of package not specified");
                    return;
                }
                serviceCall = AppsService.addAppFromPattern($scope.appData.appName, $scope.appData.appSourcePattern);
            } else if($scope.appData.appSource === "serve") {
                if(!$scope.appData.appSourceServe) {
                    alert("Url of config file not specified");
                    return;
                }
                serviceCall = AppsService.addAppFromServe($scope.appData.appName, $scope.appData.appSourceServe);
            }

            if(serviceCall) {
                serviceCall.then(function() {
                    alert("Successfully installed");
                }, function(error) {
                    console.error(error);
                    alert("Unable to add application because: \n" + error);
                });
            }

        };
    }]);

})();