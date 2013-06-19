var myApp = angular.module("CordovaAppHarness", []);
myApp.config(["$routeProvider", function($routeProvider){
    $routeProvider.when("/", {
        templateUrl: "cdvah_views/list.html",
        controller: "ListCtrl"
    });
    $routeProvider.when("/add", {
        templateUrl: "cdvah_views/add.html",
        controller: "AddCtrl"
    });
}]);
