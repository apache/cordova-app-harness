(function() {
    'use strict';
    /* global myApp */
    myApp.factory('AppHarnessUI', ['$q', function($q) {
        return {
            create: function(url) {
                var deferred = $q.defer();
                cordova.plugins.appharnessui.create(url, deferred.resolve);
                return deferred.promise;
            },
            destroy: function() {
                var deferred = $q.defer();
                cordova.plugins.appharnessui.destroy(deferred.resolve);
                return deferred.promise;
            },
            createOverlay: function(url) {
                var deferred = $q.defer();
                cordova.plugins.appharnessui.createOverlay(url, deferred.resolve);
                return deferred.promise;
            },
            destroyOverlay: function() {
                var deferred = $q.defer();
                cordova.plugins.appharnessui.destroyOverlay(deferred.resolve);
                return deferred.promise;
            },
            setEventHandler: function(f) {
                cordova.plugins.appharnessui.onEvent = f;
            }
        };
    }]);
})();
