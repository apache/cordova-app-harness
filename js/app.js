var myApp = angular.module("CordovaAppHarness", []);
myApp.config(["$routeProvider", function($routeProvider){
    $routeProvider.when("/", {
        templateUrl: "views/list.html",
        controller: "ListCtrl"
    });
    $routeProvider.when("/add", {
        templateUrl: "views/add.html",
        controller: "AddCtrl"
    });
}]);