
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

myApp.factory('urlCleanup', function() {
    return function(url) {
        url = url.replace(/\/$/, '').replace(new RegExp(cordova.platformId + '$'), '').replace(/\/$/, '');
        if (!/^(file|http|https)+:/.test(url)) {
            url = 'http://' + url;
        }
        return url;
    };
});

document.addEventListener('deviceready', function() {
    cordova.filesystem.getDataDirectory(false, function(dirEntry) {
        myApp.value('INSTALL_DIRECTORY', dirEntry.toURL() + 'apps');
        myApp.value('APPS_JSON', dirEntry.toURL() + 'apps.json');
        window.requestFileSystem(window.TEMPORARY, 1 * 1024 * 1024, function(fs) {
            myApp.value('TEMP_DIR', fs.root.toURL());
            angular.bootstrap(document, ['CordovaAppHarness']);
        }, function() {
            console.error('Failed to get temporary FS');
        });
    });
}, false);
