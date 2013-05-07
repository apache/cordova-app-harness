(function(){
    "use strict";
    /* global myApp */
    myApp.controller("AddCtrl", ["$scope", "AppsService", function ($scope, AppsService) {

        $scope.addApp = function(appName, appSource, appSourcePattern) {
            if(appSource === "pattern") {
                if(!appSourcePattern) {
                    alert("Url not specified");
                    return;
                }

                AppsService.addAppFromPattern(appName, appSourcePattern)
                .then(function() {
                    alert("Successfully installed");
                }, function(error) {
                    console.error(error);
                    alert("Unable to add application because: \n" + JSON.stringify(error));
                });
            }
        };
    }]);

})();