
var myApp = angular.module('CordovaAppHarness', ['ngRoute']);


myApp.config(['$routeProvider', function($routeProvider){
    $routeProvider.when('/', {
        templateUrl: 'views/list.html',
        controller: 'ListCtrl'
    });
    $routeProvider.when('/add', {
        templateUrl: 'views/add.html',
        controller: 'AddCtrl'
    });
    $routeProvider.when('/edit/:appId', {
        templateUrl: 'views/add.html',
        controller: 'AddCtrl'
    });
    $routeProvider.when('/details/:index', {
        templateUrl: 'views/details.html',
        controller: 'DetailsCtrl'
    });
}]);

// foo
document.addEventListener('deviceready', function() {
    cordova.filesystem.getDataDirectory(false, function(dirEntry) {
        var path = dirEntry.fullPath;
        myApp.value('INSTALL_DIRECTORY', path + '/apps');
        myApp.value('APPS_JSON', path + '/apps.json');

        myApp.factory('UrlCleanup', function() {
            return function(url) {
                url = url.replace(/\/$/, '').replace(new RegExp(cordova.platformId + '$'), '').replace(/\/$/, '');
                if (!/^[a-z]+:/.test(url)) {
                    url = 'http://' + url;
                }
                return url;
            };
        });

        angular.bootstrap(document, ['CordovaAppHarness']);
    });
}, false);
