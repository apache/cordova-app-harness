(function(){
    "use strict";
    /* global myApp */
    myApp.run(["AppsService", "ResourcesLoader", "ContextMenuInjectScript", function(AppsService, ResourcesLoader, ContextMenuInjectScript){

        AppsService.addPreLaunchHook(function(appEntry, appInstallLocation , wwwLocation) {
            if(appEntry.Source === "serve"){
                return Q.fcall(function(){
                    // We can't inject the context menu script into cordova.js remotely
                    // So we create a local copy of the cordova.js used by the server,
                    //      append the context menu script (requests for cordova.js are routed to it)
                    wwwLocation += (wwwLocation.charAt(wwwLocation.length - 1) === "/")? "" : "/";
                    var cordovaJSPath = wwwLocation + "cordova.js";
                    return ResourcesLoader.xhrGet(cordovaJSPath);
                })
                .then(function(xhr){
                    var dataToAppend = "\n(" + ContextMenuInjectScript.toString() + ")();";
                    var completeText = xhr.responseText + dataToAppend;
                    appInstallLocation += (appInstallLocation.charAt(appInstallLocation.length - 1) === "/")? "" : "/";
                    return ResourcesLoader.writeFileContents(appInstallLocation + "cordova.js", completeText);
                });
            }
        }, 250 /* Give it a priority */);
    }]);
})();
