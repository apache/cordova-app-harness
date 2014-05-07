(function(){
    'use strict';
    /* global myApp */
    /* global appharness */
    myApp.controller('ListCtrl', ['$location', 'notifier', '$rootScope', '$scope', '$routeParams', '$q', 'AppsService', function ($location, notifier, $rootScope, $scope, $routeParams, $q, AppsService) {
        $scope.appList = [];
        $rootScope.appTitle = document.title;

        function initialise() {
            return $scope.loadAppsList()
            .then(function() {
                if (!window.appharness || !appharness.push) {
                    return;
                }

                // listen is a no-op if already listening.
                appharness.push.listen(function() {
                    $scope.listening = true;
                    $scope.$apply();
                }, notifier.error);

                appharness.push.getListenAddress(function(value) {
                    $scope.ipAddress = value;
                    $scope.$apply();
                });

                appharness.push.pending(function(e) {
                    var type = e.type;
                    var extra = e.extra;
                    if (type == 'updateApp') {
                        AppsService.getAppList().then(function(list) {
                            var matches = list && list.filter(function(x) { return x.appId == extra.name; });
                            var promise;
                            if (list && matches.length > 0) {
                                // App exists.
                                var app = matches[0];
                                app.url = extra.url;
                                promise = $q.when(app);
                            } else {
                                // New app.
                                var handler;
                                promise = AppsService.addApp(extra.type, extra.url, extra.name).then(function(h) {
                                    handler = h;
                                    var msg = 'Added new app ' + handler.appId + ' from push';
                                    notifier.success(msg);
                                }).then(function() {
                                    // Reload so the app is visible while it's updating (below).
                                    return $scope.loadAppsList().then(function() {
                                        return handler;
                                    });
                                });
                            }

                            promise.then(function(theApp) {
                                return AppsService.updateApp(theApp)
                                .then(function() {
                                    notifier.success('Updated ' + theApp.appId + ' due to remote push.');
                                    return $scope.launchApp(theApp, { stopPropagation: function() { } });
                                })
                            }).then(null, function(err) {
                                notifier.error(err);
                            });
                        });
                    }
                });
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
                notifier.error(error);
            });
        };

        $scope.launchApp = function(app, event){
            event.stopPropagation();
            return AppsService.launchApp(app)
            .then(null, function(error){
                notifier.error(error);
            });
        };

        $scope.updateApp = function(app, event) {
            event.stopPropagation();
            return AppsService.updateApp(app)
            .then(function(){
                notifier.success('Updated successfully');
            }, function(error) {
                notifier.error(error);
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
                    notifier.error(error);
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

    }]);
})();


