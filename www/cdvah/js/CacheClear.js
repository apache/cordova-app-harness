(function() {
    'use strict';
    /* global myApp */
    myApp.factory('CacheClear', ['$q', function($q) {
        function clear() {
            var deferred = $q.defer();
            cordova.plugins.cacheclear.clear(deferred.resolve, deferred.reject);
            return deferred.promise;
        }
        return {
            clear: clear
        };
    }]);
})();
