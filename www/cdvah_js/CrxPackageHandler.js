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

        AppsService.registerPackageHandler("crx", {
            extractPackageToDirectory : function (fileName, outputDirectory){
                return ResourcesLoader.ensureDirectoryExists(outputDirectory + "/www")
                .then(function(){
                    return ResourcesLoader.extractZipFile(fileName, outputDirectory + "/www");
                })
                .then(function(){
                    return Q.all([
                        copyFile("cdv-app-harness:///direct/cordova.js", outputDirectory + "/www/cordova.js"),
                        copyFile("cdv-app-harness:///direct/crx_files/config.android.xml", outputDirectory + "/config.android.xml"),
                        copyFile("cdv-app-harness:///direct/crx_files/config.ios.xml", outputDirectory + "/config.ios.xml"),
                        copyFile("cdv-app-harness:///direct/crx_files/www/cordova_plugins.json", outputDirectory + "/www/cordova_plugins.json"),
                        copyFile("cdv-app-harness:///direct/crx_files/www/chromeapp.html", outputDirectory + "/www/chromeapp.html"),
                        copyFile("cdv-app-harness:///direct/crx_files/www/chromeappstyles.css", outputDirectory + "/www/chromeappstyles.css"),
                        copyFile("cdv-app-harness:///direct/crx_files/www/chromebgpage.html", outputDirectory + "/www/chromebgpage.html"),
                        copyFile("cdv-app-harness:///direct/crx_files/www/plugins/chrome/api/app/runtime.js", outputDirectory + "/www/plugins/chrome/api/app/runtime.js"),
                        copyFile("cdv-app-harness:///direct/crx_files/www/plugins/chrome/api/app/window.js", outputDirectory + "/www/plugins/chrome/api/app/window.js"),
                        copyFile("cdv-app-harness:///direct/crx_files/www/plugins/chrome/api/bootstrap.js", outputDirectory + "/www/plugins/chrome/api/bootstrap.js"),
                        copyFile("cdv-app-harness:///direct/crx_files/www/plugins/chrome/api/helpers/stubs.js", outputDirectory + "/www/plugins/chrome/api/helpers/stubs.js"),
                        copyFile("cdv-app-harness:///direct/crx_files/www/plugins/chrome/api/mobile.js", outputDirectory + "/www/plugins/chrome/api/mobile.js"),
                        copyFile("cdv-app-harness:///direct/crx_files/www/plugins/chrome/api/runtime.js", outputDirectory + "/www/plugins/chrome/api/runtime.js"),
                        copyFile("cdv-app-harness:///direct/crx_files/www/plugins/chrome.common/events.js", outputDirectory + "/www/plugins/chrome.common/events.js"),
                        copyFile("cdv-app-harness:///direct/crx_files/www/plugins/chrome.fileSystem/fileSystem.js", outputDirectory + "/www/plugins/chrome.fileSystem/fileSystem.js"),
                        copyFile("cdv-app-harness:///direct/crx_files/www/plugins/chrome.i18n/i18n.js", outputDirectory + "/www/plugins/chrome.i18n/i18n.js"),
                        copyFile("cdv-app-harness:///direct/crx_files/www/plugins/chrome.identity/identity.js", outputDirectory + "/www/plugins/chrome.identity/identity.js"),
                        copyFile("cdv-app-harness:///direct/crx_files/www/plugins/chrome.socket/socket.js", outputDirectory + "/www/plugins/chrome.socket/socket.js"),
                        copyFile("cdv-app-harness:///direct/crx_files/www/plugins/chrome.storage/storage.js", outputDirectory + "/www/plugins/chrome.storage/storage.js")
                    ]);
                });
            }
        });

    }]);
})();