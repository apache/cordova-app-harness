(function(){
    "use strict";
    /* global myApp */
    myApp.controller("AddCtrl", ["notifier", "$rootScope", "$scope", "$location", "$window", "AppsService", function (notifier, $rootScope, $scope, $location, $window, AppsService) {

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

        // True if the optional barcodescanner plugin is installed.
        $scope.qr_enabled = !!$window.barcodescanner;

        // Scans a QR code, placing the URL into the currently selected of source and pattern.
        $scope.fetchQR = function() {
            console.log('calling');
            $window.barcodescanner.scan(function(result) {
                console.log('success');
                if (!result || result.cancelled || !result.text) {
                    notifier.error('No QR code received.');
                } else {
                    if ($scope.appData.appSource == 'pattern') {
                        $scope.appData.appSourcePattern = result.text;
                    } else {
                        $scope.appData.appSourceServe = result.text;
                    }
                    notifier.success('QR code received');
                    $scope.$apply();
                }
            },
            function(error) {
                console.log('error: ' + error);
                notifier.error('Error retrieving QR code: ' + error);
            });
        };
    }]);
})();
