(function() {
    "use strict";
    /* global myApp */
    myApp.factory("AppsService", [ "ResourcesLoader", "INSTALL_DIRECTORY", "TEMP_DIRECTORY", "APPS_JSON", function(ResourcesLoader, INSTALL_DIRECTORY, TEMP_DIRECTORY, APPS_JSON) {

        var platformId = cordova.require("cordova/platform").id;

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

            try {
                var onZipDone = function(returnCode) {
                    if(returnCode !== 0) {
                        deferred.reject(new Error("Something went wrong during the unzipping of: " + fileName));
                    } else {
                        deferred.resolve();
                    }
                };

                /* global zip */
                zip.unzip(fileName, outputDirectory, onZipDone);
            } catch(e) {
                deferred.reject(e);
            } finally {
                return deferred.promise;
            }
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

        function getAppStartPageFromAppLocation(appLocation) {
            appLocation += (appLocation.substring(appLocation.length - 1) === "/") ? "" : "/";
            var configFile = appLocation + "config." + platformId + ".xml";

            return ResourcesLoader.readFileContents(configFile)
            .then(function(contents){
                if(!contents) {
                    throw new Error("config.xml for your platform is empty. Check if the zip package contains config.xml for your platform");
                } else {
                    var startLocation = appLocation + "www/index.html";
                    var parser = new DOMParser();
                    var xmlDoc = parser.parseFromString(contents, "text/xml");
                    var els = xmlDoc.getElementsByTagName("content");

                    if(els.length > 0) {
                        // go through all "content" elements looking for the "src" attribute in reverse order
                        for(var i = els.length - 1; i >= 0; i--) {
                            var el = els[i];
                            var srcValue = el.getAttribute("src");
                            if(srcValue) {
                                startLocation = appLocation + "www/" + srcValue;
                                break;
                            }
                        }
                    }

                    return startLocation;
                }
            });
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
                return getAppStartPageFromAppLocation(INSTALL_DIRECTORY + appName + "/")
                .then(function(startLocation) {
                    return ResourcesLoader.getFullFilePath(startLocation);
                })
                .then(function(fullStartLocation){
                    document.location = fullStartLocation;
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