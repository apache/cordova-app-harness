(function() {
    "use strict";
    /* global myApp */
    myApp.factory("AppsService", [ "ResourcesLoader", "INSTALL_DIRECTORY", "TEMP_DIRECTORY", "APPS_JSON", "$window", function(ResourcesLoader, INSTALL_DIRECTORY, TEMP_DIRECTORY, APPS_JSON, $window) {

        function addNewAppFromUrl(appName, appUrl) {
            var fileName = TEMP_DIRECTORY + appName + ".zip";
            var _fullFilePath;

            return ResourcesLoader.downloadFromUrl(appUrl, fileName)
            .then(function(fullFilePath){
                _fullFilePath = fullFilePath;
                return ResourcesLoader.ensureDirectoryExists(INSTALL_DIRECTORY + appName);
            })
            .then(function(directoryPath){
                return extractZipToDirectory(_fullFilePath, directoryPath);
            })
            .then(function(){
                return registerApp(appName, "urlToZip", appUrl);
            });
        }

        function extractZipToDirectory(fileName, outputDirectory){
            var deferred = Q.defer();

            var onZipDone = function(returnCode) {
                if(returnCode !== 0) {
                    deferred.reject(new Error("Something went wrong during the unzipping of: " + fileName));
                } else {
                    deferred.resolve();
                }
            };

            /* global zip */
            zip.unzip(fileName, outputDirectory, onZipDone);
            return deferred.promise;
        }

        function registerApp(appName, appSource, appUrl) {
            return ResourcesLoader.readJSONFileContents(APPS_JSON)
            .then(function(result){
                result.installedApps = result.installedApps || [];
                result.installedApps.push({
                    "Name" :  appName,
                    "Source" : appSource,
                    "Url" : appUrl
                });
                return ResourcesLoader.writeJSONFileContents(APPS_JSON, result);
            });
        }

        function getAbsoluteUrl(relativeUrl) {
            // Can't use $document from angularJS as it does not provie the create constructor
            /* global document */
            var a = document.createElement("a");
            a.href = relativeUrl;
            return a.href;
        }

        function getAppStartPageFromAppLocation(appLocation) {
            appLocation += (appLocation.substring(appLocation.length - 1) === "/") ? "" : "/";
            var startLocation = appLocation + "www/index.html";
            return startLocation;
        }

        return {
            //return promise with the array of apps
            getAppsList : function() {
                return ResourcesLoader.ensureDirectoryExists(APPS_JSON)
                .then(function() {
                    return ResourcesLoader.readJSONFileContents(APPS_JSON);
                })
                .then(function(result){
                    result.installedApps = result.installedApps || [];
                    var newAppsList = [];

                    for(var i = 0; i < result.installedApps.length; i++){
                        newAppsList.push(result.installedApps[i].Name);
                    }

                    return newAppsList;
                });
            },

            launchApp : function(appName) {
                return ResourcesLoader.getFullFilePath(INSTALL_DIRECTORY + appName)
                .then(function(appLocation) {
                    var startLocation = getAppStartPageFromAppLocation(appLocation);
                    document.location = startLocation;
                });
            },

            addAppFromZipUrl : function(appName, appUrl) {
                return this.getAppsList()
                .then(function(appsList){
                    if(appsList.indexOf(appName) !== -1) {
                        throw new Error("An app with this name already exists");
                    }
                    return addNewAppFromUrl(appName, appUrl);
                });
            }
        };
    }]);
})();