(function(){
    "use strict";
    /* global myApp */
    myApp.run(["AppsService", "ResourcesLoader", "ContextMenuInjectScript", function(AppsService, ResourcesLoader, ContextMenuInjectScript){

        var platformId = cordova.require("cordova/platform").id;

        function copyFile(startUrl, targetLocation){
            /************ Begin Work around for File system bug ************/
            if(targetLocation.indexOf("file://") === 0) {
                targetLocation = targetLocation.substring("file://".length);
            }
            /************ End Work around for File system bug **************/
            return ResourcesLoader.xhrGet(startUrl)
            .then(function(xhr){
                return ResourcesLoader.ensureDirectoryExists(targetLocation)
                .then(function(){
                    return ResourcesLoader.writeFileContents(targetLocation, xhr.responseText);
                });
            });
        }

        AppsService.registerPackageHandler("cdvh", {
            extractPackageToDirectory : function (fileName, outputDirectory){
                var dataToAppend = "\n(" + ContextMenuInjectScript.toString() + ")();";
                var platformDirectory = outputDirectory + "/" + platformId + "/www/";
                var cordovaFile = platformDirectory + "cordova.js";
                var pluginsFile = platformDirectory + "cordova_plugins.json";

                // We need to
                // 1) Modify the cordova.js file
                // 2) Copy the cordova_plugins.json we have, as the app that is being installed may have other plugins included which aren't in the harness.
                // If we allow unavailable plugins to be included in this file, the plugin initialiser breaks
                return ResourcesLoader.extractZipFile(fileName, outputDirectory)
                .then(function(){
                    return ResourcesLoader.doesFileExist(cordovaFile);
                })
                .then(function(fileExists){
                    if(fileExists){
                        return Q.all([
                            ResourcesLoader.appendFileContents(cordovaFile, dataToAppend),
                            copyFile("app-bundle:///cdvh_files/www/cordova_plugins.json", pluginsFile)
                        ]);
                    } else {
                        throw new Error("The package does not seem to have the files required for the platform: " + platformId);
                    }
                });
            }
        });

    }]);
})();