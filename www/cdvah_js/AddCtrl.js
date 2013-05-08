(function(){
    "use strict";
    /* global myApp */
    myApp.controller("AddCtrl", ["$scope", "AppsService", function ($scope, AppsService) {

        $scope.addApp = function(appName, appSource, appSourcePattern, appSourceServe) {
            var serviceCall;
            if(appSource === "pattern") {
                if(!appSourcePattern) {
                    alert("Url of package not specified");
                    return;
                }
                serviceCall = AppsService.addAppFromPattern(appName, appSourcePattern);
            } else if(appSource === "serve") {
                if(!appSourceServe) {
                    alert("Url of config file not specified");
                    return;
                }
                serviceCall = AppsService.addAppFromServe(appName, appSourceServe);
            }

            serviceCall.then(function() {
                alert("Successfully installed");
            }, function(error) {
                console.error(error);
                alert("Unable to add application because: \n" + error);
            });

        };
    }]);

})();