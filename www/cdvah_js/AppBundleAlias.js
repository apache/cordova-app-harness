(function(){
    "use strict";
    /* global myApp */
    myApp.run(["AppsService", function(AppsService){

        // URI aliasing : the ability to launch an app in the harness, query the document.location and get the same location as would have been got if you run the app separately
        // Without URI aliasing, document.location in the harness would give something like file:///APP_HARNESS_INSTALLED_APPS_LOCATION/www/index.html

        function aliasUri(sourceUriMatchRegex, sourceUriReplaceRegex, replaceString, redirectToReplacedUrl){
            var deferred = Q.defer();
            var appBundle = cordova.require("AppBundle.AppBundle");
            try {
                appBundle.addAlias(sourceUriMatchRegex, sourceUriReplaceRegex, replaceString, redirectToReplacedUrl, function(succeded){
                    if(succeded){
                        deferred.resolve();
                    } else {
                        deferred.reject(new Error("Unable to set up uri aliasing"));
                    }
                });
            } catch(e) {
                deferred.reject(new Error(e));
            } finally {
                return deferred.promise;
            }
        }

        AppsService.addPreLaunchHook(function(appName, wwwLocation) {
            console.log("Adding aliases for " + appName);
            wwwLocation += (wwwLocation.charAt(wwwLocation.length - 1) === "/")? "" : "/";
            wwwLocation = (wwwLocation.indexOf("file://") === 0) ? wwwLocation : "file://" + wwwLocation;
            //Make any direct references to the bundle paths such as file:///android_asset point to the installed location without redirecting
            //{BUNDLE_WWW} in the regex is automatically replaced by the appBundle component
            return aliasUri("^{BUNDLE_WWW}.*", "^{BUNDLE_WWW}", wwwLocation, false /* redirect */);
        });
    }]);
})();
