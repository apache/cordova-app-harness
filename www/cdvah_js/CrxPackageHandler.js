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

        AppsService.registerPackageHandler("crx", {
            extractPackageToDirectory : function (appName, fileName, outputDirectory){
                console.log('extracting the crx');
                var dataToAppend = ContextMenuInjectScript.getInjectString(appName);
                var platformDirectory = outputDirectory + "/" + platformId + "/";
                var platformWWWDirectory = platformDirectory + "www/";
                var cordovaFile = platformWWWDirectory + "cordova.js";

                // We need to
                // 1) Copy over the files required to convert a crx to a normal web app
                // 2) Modify the cordova.js file
                return ResourcesLoader.extractZipFile(fileName, platformWWWDirectory)
                .then(function(){
                    var plugins = cordova.require('cordova/plugin_list');
                    if (!plugins) {
                        throw new Error('Error loading cordova_plugins.json');
                    }

                    var copies = [
                        copyFile("app-bundle:///cordova.js", cordovaFile),
                        copyFile("app-bundle:///crx_files/config." + platformId + ".xml", platformDirectory + "config.xml"),
                        copyFile("app-bundle:///cordova_plugins.js", platformWWWDirectory + "cordova_plugins.js"),
                        copyFile("app-bundle:///chromeapp.html", platformWWWDirectory + "chromeapp.html"),
                        copyFile("app-bundle:///chromeappstyles.css", platformWWWDirectory + "chromeappstyles.css"),
                        copyFile("app-bundle:///chromebgpage.html", platformWWWDirectory + "chromebgpage.html"),
                        copyFile("app-bundle:///cdvah_js/ContextMenu.js", platformWWWDirectory + "ContextMenu.js")
                    ];

                    for(var i = 0; i < plugins.length; i++) {
                        console.log('copying ' + plugins[i].file);
                        copies.push(copyFile("app-bundle:///" + plugins[i].file, platformWWWDirectory + plugins[i].file));
                    }

                    return Q.all(copies);
                })
                .then(function(){
                    return ResourcesLoader.appendFileContents(cordovaFile, dataToAppend);
                });
            }
        });
    }]);
})();
