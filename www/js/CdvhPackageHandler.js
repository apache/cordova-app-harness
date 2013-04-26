(function(){
    "use strict";
    /* global myApp */
    myApp.run(["AppsService", "ResourcesLoader", function(AppsService, ResourcesLoader){

        AppsService.registerPackageHandler("cdvh", {
            extractPackageToDirectory : function (fileName, outputDirectory){
                return ResourcesLoader.extractZipFile(fileName, outputDirectory)
                .then(function(){
                    return ResourcesLoader.xhrGet("cdv-app-harness:///direct/cordova.js");
                })
                .then(function(xhr){
                    var cordovaJSPath = outputDirectory + "/www/cordova.js";
                    /************ Begin Work around for File system bug ************/
                    if(cordovaJSPath.indexOf("file://") === 0) {
                        cordovaJSPath = cordovaJSPath.substring("file://".length);
                    }
                    /************ End Work around for File system bug **************/
                    return ResourcesLoader.writeFileContents(cordovaJSPath, xhr.responseText);
                });
            }
        });

    }]);
})();