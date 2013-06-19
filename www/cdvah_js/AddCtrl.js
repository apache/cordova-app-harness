(function(){
    "use strict";
    /* global myApp */
    myApp.controller("AddCtrl", ["notifier", "$rootScope", "$scope", "$location", "AppsService", function (notifier, $rootScope, $scope, $location, AppsService) {

        $rootScope.appTitle = 'Add App';

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
                    notifier.error('Url of package not specified');
                    return;
                }
                serviceCall = AppsService.addAppFromPattern($scope.appData.appName, $scope.appData.appSourcePattern);
            } else if($scope.appData.appSource === "serve") {
                if(!$scope.appData.appSourceServe) {
                    notifier.error('Url of config file not specified');
                    return;
                }
                serviceCall = AppsService.addAppFromServe($scope.appData.appName, $scope.appData.appSourceServe);
            }

            if(serviceCall){
                serviceCall.then(function() {
                    console.log('successfully installed');
                    notifier.success('Successfully installed');
                }, function(error) {
                    console.error(error);
                    notifier.error('Unable to add application because: ' + error.message);
                });
            } else {
                notifier.error('Error adding application: Unrecognized application source: ' + $scope.appData.appSource);
            }
        };
    }]);
})();
