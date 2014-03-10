(function(){
    'use strict';
    /* global myApp */
    /* global appharness */
    myApp.controller('ListCtrl', ['$location', 'notifier', '$rootScope', '$scope', '$routeParams', '$q', 'AppsService', function ($location, notifier, $rootScope, $scope, $routeParams, $q, AppsService) {
        $scope.appList = [];
        $rootScope.appTitle = 'Cordova App Harness';

        function initialise() {
            return $scope.loadAppsList()
            .then(AppsService.getAppList)
            .then(function(appList) {
                var action = $routeParams.action;
                if (action) {
                    var appIndex = +$routeParams.appIndex;
                    var activeApp = appList[appIndex];
                    if (action == 'restart') {
                        return AppsService.launchApp(activeApp)
                        .then(null, function(e){
                            console.error('Error launching last run app: ' + e);
                            notifier.error('' + e);
                        });
                    } else if (action == 'update') {
                        // Updating may take a while so we show the apps list like we normally do
                        return AppsService.updateApp(activeApp)
                        .then(function() {
                            return AppsService.launchApp(activeApp);
                        }).then(null, function(e){
                            console.error('Error updating last run app: ' + e);
                            notifier.error('' + e);
                        });
                    }
                }
            });
        }

        $scope.loadAppsList = function() {
            return AppsService.getAppList()
            .then(function(newAppsList){
                newAppsList.sort(function(a, b){
                    if (a.appId < b.appId) {
                        return -1;
                    } else if(a.appId > b.appId) {
                        return 1;
                    }
                    return 0;
                });
                $scope.appList = newAppsList;
            }, function(error){
                var str = 'There was an error retrieving the apps list';
                console.error(str + ': ' + error);
                notifier.error('' + error);
            });
        };

        $scope.launchApp = function(app, event){
            event.stopPropagation();
            return AppsService.launchApp(app)
            .then(null, function(error){
                console.error('Error during loading of app ' + app.appId + ': ' + error);
                notifier.error('' + error);
            });
        };

        $scope.updateApp = function(app, event) {
            event.stopPropagation();
            return AppsService.updateApp(app)
            .then(function(){
                notifier.success('Updated successfully');
                console.log('successfully updated');
            }, function(error) {
                console.error('Error during updating of app ' + app.appId + ': ' + error);
                notifier.error('' + error);
            });
        };

        $scope.removeApp = function(app, event) {
            event.stopPropagation();
            var shouldUninstall = confirm('Are you sure you want to uninstall ' + app.appId + '?');
            if(shouldUninstall) {
                return AppsService.uninstallApp(app)
                .then(function() {
                    return $scope.loadAppsList();
                }, function(error) {
                    console.error(error);
                    notifier.error('' + error);
                });
            }
        };

        $scope.editApp = function(app, event) {
            event.stopPropagation();
            $location.path('/edit/' + app.appId);
        };

        $scope.showDetails = function(index) {
            $location.path('/details/' + index);
        };

        initialise();

        if (window.appharness && appharness.push) {
            appharness.push.listening(function(res) {
                $scope.listening = res;
                $scope.$apply();
            }, notifier.error);

            appharness.push.pending(function(obj) {
                console.log('Return from pending: ' + obj);
                if (obj && obj.type) {
                    AppsService.getAppList().then(function(list) {
                        console.log(list);
                        var matches = list && list.filter(function(x) { return x.appId == obj.name; });
                        var promise;
                        if (list && matches.length > 0) {
                            // App exists.
                            var app = matches[0];
                            app.url = obj.url;
                            promise = $q.when(app);
                        } else {
                            // New app.
                            var handler;
                            promise = AppsService.addApp(obj.type, obj.url).then(function(h) {
                                handler = h;
                                var msg = 'Added new app ' + handler.appId + ' from push';
                                console.log(msg);
                                notifier.success(msg);
                            }).then(function() {
                                // Reload so the app is visible while it's updating (below).
                                return $scope.loadAppsList().then(function() {
                                    return handler;
                                });
                            });
                        }

                        var theApp;
                        promise.then(function(app) {
                            theApp = app;
                            return AppsService.updateApp(app);
                        }).then(function() {
                            notifier.success('Updated ' + theApp.appId + ' due to remote push.');
                            return $scope.loadAppsList();
                        }).then(function() {
                            return $scope.launchApp(theApp, { stopPropagation: function() { } });
                        }).done(null, function(err) {
                            var msg = 'Failed to update ' + app.appId + ': ' + err;
                            console.error(msg);
                            notifier.error(msg);
                        });
                    });
                }
            });

            $scope.listen = function() {
                appharness.push.listen(function() {
                    $scope.listening = true;
                    $scope.$apply();
                }, notifier.error);
            };
        }
    }]);
})();


