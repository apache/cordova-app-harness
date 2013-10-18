(function(){
    "use strict";

    /* global myApp */
    myApp.controller("AddCtrl", ["$q", "notifier", "$location", "$rootScope", "$scope", "$window", "AppsService", function($q, notifier, $location, $rootScope, $scope, $window, AppsService) {

        $rootScope.appTitle = 'Add App';

        $scope.appData = {
            appUrl : '',
            installerType: 'serve'
        };

        $scope.selectTemplate = function() {
            $scope.appData.appUrl = $scope.appData.serveTemplateValue;
        };

        $scope.addApp = function() {
            var serviceCall = AppsService.addApp($scope.appData.installerType, $scope.appData.appUrl);

            serviceCall.then(function(handler) {
                console.log('App Added');
                notifier.success('App Added');
                $location.path('/');
                return AppsService.updateApp(handler);
            }, function(error) {
                console.error(error);
                notifier.error('Unable to add application because: ' + error.message);
            });
        };

        // True if the optional barcodescanner plugin is installed.
        $scope.qr_enabled = !!(cordova.plugins && cordova.plugins.barcodeScanner);

        // Scans a QR code, placing the URL into the currently selected of source and pattern.
        $scope.fetchQR = function() {
            var deferred = $q.defer();
            $window.cordova.plugins.barcodeScanner.scan(function(result) {
                if (!result || result.cancelled || !result.text) {
                    notifier.error('No QR code received.');
                    deferred.reject('No QR code received.');
                } else {
                    $scope.appData.appUrl = result.text;
                    notifier.success('QR code received');
                    deferred.resolve();
                }
            },
            function(error) {
                console.log('QR Error: ' + error);
                notifier.error('Error retrieving QR code: ' + error);
                deferred.reject(error);
            });
            return deferred.promise;
        };
    }]);
})();
