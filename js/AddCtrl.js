(function(){
    "use strict";
    /* global myApp */
    myApp.controller("AddCtrl", ["$scope", "AppsService", function ($scope, AppsService) {

        $scope.addApp = function(appName, appSource, appUrl) {
            if(appSource === "urlToZip") {
                if(!appUrl) {
                    alert("Url not specified");
                    return;
                }

                AppsService.addAppFromZipUrl(appName, appUrl)
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