(function() {
    "use strict";
    /* global myApp */
    myApp.factory("AppBundle", ['$q', '$window', function($q, $window) {

        // URI aliasing : the ability to launch an app in the harness, query the document.location and get the same location as would have been got if you run the app separately
        // Without URI aliasing, document.location in the harness would give something like file:///APP_HARNESS_INSTALLED_APPS_LOCATION/www/index.html

        function aliasUri(sourceUriMatchRegex, sourceUriReplaceRegex, replaceString, redirectToReplacedUrl){
            var deferred = $q.defer();
            cordova.plugins.appBundle.addAlias(sourceUriMatchRegex, sourceUriReplaceRegex, replaceString, redirectToReplacedUrl, function(succeded) {
                if (succeded){
                    deferred.resolve();
                } else {
                    deferred.reject(new Error("Unable to set up uri aliasing"));
                }
            });
            return deferred.promise;
        }

        function setResetUrl(url) {
            var deferred = $q.defer();
            cordova.plugins.appBundle.setResetUrl(url, deferred.resolve);
            return deferred.promise;
        }

        function injectJsForUrl(url, js) {
            var deferred = $q.defer();
            cordova.plugins.appBundle.injectJsForUrl(url, js, deferred.resolve);
            return deferred.promise;
        }

        function reset() {
            var deferred = $q.defer();
            cordova.plugins.appBundle.clearAllAliases(deferred.resolve);
            return deferred.promise;
        }

        function escapeRegExp(str) {
            return str.replace(/[-\[\]\/{}()*+?.\\^$|]/g, '\\$&');
        }

        return {
            aliasUri: aliasUri,
            reset: reset,
            setResetUrl: setResetUrl,
            injectJsForUrl: injectJsForUrl
        };

    }]);
})();
