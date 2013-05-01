(function(){
    "use strict";
    /* global myApp */
    myApp.run(["AppsService", "ResourcesLoader", function(AppsService, ResourcesLoader){

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
                return ResourcesLoader.extractZipFile(fileName, outputDirectory)
                .then(function(){
                    return Q.all([
                        copyFile("app-bundle:///cordova.js", outputDirectory + "/www/cordova.js"),
                        copyFile("app-bundle:///cdvh_files/www/cordova_plugins.json", outputDirectory + "/www/cordova_plugins.json")
                    ]);
                });
            }
        });

    }]);
})();