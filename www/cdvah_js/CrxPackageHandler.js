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
                var dataToAppend = ContextMenuInjectScript.getInjectString(appName);
                var platformDirectory = outputDirectory + "/" + platformId + "/";
                var platformWWWDirectory = platformDirectory + "www/";
                var cordovaFile = platformWWWDirectory + "cordova.js";

                // We need to
                // 1) Copy over the files required to convert a crx to a normal web app
                // 2) Modify the cordova.js file
                return ResourcesLoader.extractZipFile(fileName, platformWWWDirectory)
                .then(function(){
                    return Q.all([
                        copyFile("app-bundle:///cordova.js", cordovaFile),
                        copyFile("app-bundle:///crx_files/config." + platformId + ".xml", platformDirectory + "config.xml"),
                        copyFile("app-bundle:///crx_files/www/cordova_plugins.json", platformWWWDirectory + "cordova_plugins.json"),
                        copyFile("app-bundle:///crx_files/www/chromeapp.html", platformWWWDirectory + "chromeapp.html"),
                        copyFile("app-bundle:///crx_files/www/chromeappstyles.css", platformWWWDirectory + "chromeappstyles.css"),
                        copyFile("app-bundle:///crx_files/www/chromebgpage.html", platformWWWDirectory + "chromebgpage.html"),
                        copyFile("app-bundle:///crx_files/www/plugins/chrome/api/app/runtime.js", platformWWWDirectory + "plugins/chrome/api/app/runtime.js"),
                        copyFile("app-bundle:///crx_files/www/plugins/chrome/api/app/window.js", platformWWWDirectory + "plugins/chrome/api/app/window.js"),
                        copyFile("app-bundle:///crx_files/www/plugins/chrome/api/bootstrap.js", platformWWWDirectory + "plugins/chrome/api/bootstrap.js"),
                        copyFile("app-bundle:///crx_files/www/plugins/chrome/api/helpers/stubs.js", platformWWWDirectory + "plugins/chrome/api/helpers/stubs.js"),
                        copyFile("app-bundle:///crx_files/www/plugins/chrome/api/mobile.js", platformWWWDirectory + "plugins/chrome/api/mobile.js"),
                        copyFile("app-bundle:///crx_files/www/plugins/chrome/api/runtime.js", platformWWWDirectory + "plugins/chrome/api/runtime.js"),
                        copyFile("app-bundle:///crx_files/www/plugins/chrome.common/events.js", platformWWWDirectory + "plugins/chrome.common/events.js"),
                        copyFile("app-bundle:///crx_files/www/plugins/chrome.fileSystem/fileSystem.js", platformWWWDirectory + "plugins/chrome.fileSystem/fileSystem.js"),
                        copyFile("app-bundle:///crx_files/www/plugins/chrome.i18n/i18n.js", platformWWWDirectory + "plugins/chrome.i18n/i18n.js"),
                        copyFile("app-bundle:///crx_files/www/plugins/chrome.identity/identity.js", platformWWWDirectory + "plugins/chrome.identity/identity.js"),
                        copyFile("app-bundle:///crx_files/www/plugins/chrome.socket/socket.js", platformWWWDirectory + "plugins/chrome.socket/socket.js"),
                        copyFile("app-bundle:///crx_files/www/plugins/chrome.storage/storage.js", platformWWWDirectory + "plugins/chrome.storage/storage.js")
                    ]);
                })
                .then(function(){
                    return ResourcesLoader.appendFileContents(cordovaFile, dataToAppend);
                });
            }
        });
    }]);
})();