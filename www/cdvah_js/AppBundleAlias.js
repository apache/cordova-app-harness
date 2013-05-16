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

        function getRegex(string){
            return string.replace("[", "\\[")
            .replace("\\", "\\\\")
            .replace("^", "\\^")
            .replace("$", "\\$")
            .replace(".", "\\.")
            .replace("|", "\\|")
            .replace("?", "\\?")
            .replace("*", "\\*")
            .replace("+", "\\+")
            .replace("(", "\\(")
            .replace(")", "\\)");
        }

        AppsService.addPreLaunchHook(function(appEntry, appInstallLocation, wwwLocation) {
            console.log("Adding aliases for " + appEntry.Name);
            wwwLocation += (wwwLocation.charAt(wwwLocation.length - 1) === "/")? "" : "/";
            appInstallLocation += (appInstallLocation.charAt(appInstallLocation.length - 1) === "/")? "" : "/";
            //Make any direct references to the bundle paths such as file:///android_asset point to the installed location without redirecting
            //{BUNDLE_WWW} in the regex is automatically replaced by the appBundle component
            return aliasUri("^{BUNDLE_WWW}.*", "^{BUNDLE_WWW}", wwwLocation, false /* redirect */)
            .then(function(){
                //For cordova serve apps, we additionally have to redirect requests to the original cordova.js to a modified cordova.js we have locally
                if(appEntry.Source === "serve"){
                    var regexWWWLoc = getRegex(wwwLocation);
                    var regex = "^" + regexWWWLoc + "cordova.js(\\?|#.*)?";
                    return aliasUri(regex, regex, appInstallLocation + "cordova.js", false);
                }
            });
        }, 500 /* Give it a priority */);
    }]);
})();
