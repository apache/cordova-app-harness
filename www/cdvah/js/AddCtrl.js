(function(){
    'use strict';

    /* global myApp */
    myApp.controller('AddCtrl', ['$q', 'notifier', '$location', '$rootScope', '$scope', '$window', '$routeParams', 'AppsService', 'urlCleanup', function($q, notifier, $location, $rootScope, $scope, $window, $routeParams, AppsService, urlCleanup) {
        $scope.editing = $routeParams.appId;
        var editingApp;

        $rootScope.appTitle = $scope.editing ? 'Edit App' : 'Add App';

        if ($scope.editing) {
            AppsService.getAppList().then(function(appList) {
                appList.forEach(function(app) {
                    if (app.appId == $scope.editing) {
                        editingApp = app;
                        $scope.editingApp = app;
                        $scope.appData = {
                            appId: app.appId,
                            appUrl: app.url,
                            installerType: app.type
                        };
                    }
                });
                if (!$scope.appData) {
                    var err = 'Could not find app to edit';
                    console.error(err);
                    notifier.error(err);
                }
            });
        } else {
            $scope.appData = {
                appUrl: '',
                installerType: 'serve'
            };
        }

        $scope.selectTemplate = function() {
            $scope.appData.appUrl = $scope.appData.serveTemplateValue;
        };

        $scope.addApp = function() {
            if ($scope.editing) {
                // Update the app, write them out, and return to the list.
                // We deliberately disallow changing the type, since that wouldn't work at all.
                var oldUrl = editingApp.url;
                editingApp.appId = $scope.appData.appId;
                editingApp.url = urlCleanup($scope.appData.appUrl);
                var urlChanged = oldUrl != editingApp.url;
                var p = AppsService.editApp($scope.editing, editingApp).then(function() {
                    console.log('App edited');
                    notifier.success('App edited');
                    $location.path('/');
                });

                if (urlChanged) {
                    return p.then(function() {
                        // If the URL changed, trigger an update.
                        return AppsService.updateApp(editingApp);
                    }).then(function() {
                        console.log('Updated app due to URL change');
                        notifier.success('Updated app due to URL change');
                    }, function(err) {
                        var msg = 'Failed to update app: ' + err.message;
                        console.error(msg);
                        notifier.error(msg);
                    });
                }
                return p;
            }
            return AppsService.addApp($scope.appData.installerType, $scope.appData.appUrl)
            .then(function(handler) {
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
        $scope.qrEnabled = !!(cordova.plugins && cordova.plugins.barcodeScanner);

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
