(function() {
    "use strict";
    /* global myApp */
    myApp.factory("AppsService", [ "ResourcesLoader", "INSTALL_DIRECTORY", "TEMP_DIRECTORY", "APPS_JSON", "METADATA_JSON", function(ResourcesLoader, INSTALL_DIRECTORY, TEMP_DIRECTORY, APPS_JSON, METADATA_JSON) {

        var platformId = cordova.require("cordova/platform").id;
        // downloaders that know how to download from certain patterns.
        // Eg: The KnownExtensionDownloader MAY know how to download from any uri's that end in known extensions
        var downloadHandlers = [];
        // handlers that have registered to unpack certain extensions during the installation of an app
        var extensionHandlers = {};
        // functions to run before launching an app
        var preLaunchHooks = [];

        function grabExtensionFromUri(uri) {
            var lastSegment = uri.split("#")[0].split("?")[0].split("/").pop();
            var dotLocation = lastSegment.lastIndexOf(".");
            var extension = (dotLocation !== -1)? lastSegment.substring(dotLocation + 1) : "";
            return extension;
        }

        function addNewAppFromPattern(appName, appSourcePattern) {
            var _fullFilePath;

            return ResourcesLoader.deleteDirectory(INSTALL_DIRECTORY + appName)
            .then(function(){
                for(var i = 0; i < downloadHandlers.length; i++){
                    if(downloadHandlers[i].handler.canHandleSourcePattern(appSourcePattern)){
                        return downloadHandlers[i].handler.downloadFromPattern(appName, appSourcePattern, TEMP_DIRECTORY);
                    }
                }
                throw new Error("App Harness does not know how to install an app from the pattern: " + appSourcePattern);
            })
            .then(function(fullFilePath){
                _fullFilePath = fullFilePath;
                return ResourcesLoader.ensureDirectoryExists(INSTALL_DIRECTORY + appName);
            })
            .then(function(directoryPath){
                var extension = grabExtensionFromUri(appSourcePattern);
                if(!extensionHandlers[extension]) {
                    throw new Error("No handler for extension " + extension + " found");
                }
                return extensionHandlers[extension].extractPackageToDirectory(_fullFilePath, directoryPath);
            })
            .then(function(){
                return registerApp(appName, "pattern", appSourcePattern);
            });
        }

        function registerApp(appName, appSource, appSourcePattern) {
            return ResourcesLoader.readJSONFileContents(APPS_JSON)
            .then(function(result){
                result.installedApps = result.installedApps || [];
                result.installedApps.push({
                    "Name" :  appName,
                    "Source" : appSource,
                    "Data" : appSourcePattern,
                    "Installed" : (new Date()).toLocaleString()
                });
                return ResourcesLoader.writeJSONFileContents(APPS_JSON, result);
            });
        }

        function cleanPath(path){
            if(path.indexOf("file://") === 0){
                path = path.substring("file://".length);
            }
            // remove trailing slash
            return (path.substring(path.length - 1) === "/") ? path.substring(0, path.length - 1) : path;
        }

        function isPathAbsolute(path){
            return (path.match(/^[a-zA-Z0-9]+:/) != null);
        }

        function getAppStartPageFromConfig(configFile, appBaseDirectory) {
            configFile = cleanPath(configFile);
            appBaseDirectory = "file://" + cleanPath(appBaseDirectory);

            return ResourcesLoader.readFileContents(configFile)
            .then(function(contents){
                if(!contents) {
                    throw new Error("Config file is empty. Unable to find a start page for your app.");
                } else {
                    var startLocation = appBaseDirectory + "/index.html";
                    var parser = new DOMParser();
                    var xmlDoc = parser.parseFromString(contents, "text/xml");
                    var els = xmlDoc.getElementsByTagName("content");

                    if(els.length > 0) {
                        // go through all "content" elements looking for the "src" attribute in reverse order
                        for(var i = els.length - 1; i >= 0; i--) {
                            var el = els[i];
                            var srcValue = el.getAttribute("src");
                            if(srcValue) {
                                if(isPathAbsolute(srcValue)) {
                                    startLocation = srcValue;
                                } else {
                                    srcValue = srcValue.charAt(0) === "/" ? srcValue.substring(1) : srcValue;
                                    startLocation = appBaseDirectory + "/" + srcValue;
                                }
                                break;
                            }
                        }
                    }

                    return startLocation;
                }
            });
        }

        function removeApp(appName){
            var entry;
            return ResourcesLoader.ensureDirectoryExists(APPS_JSON)
            .then(function() {
                return ResourcesLoader.readJSONFileContents(APPS_JSON);
            })
            .then(function(result){
                result.installedApps = result.installedApps || [];

                for(var i = 0; i < result.installedApps.length; i++){
                    if(result.installedApps[i].Name === appName) {
                        entry = result.installedApps.splice(i, 1)[0];
                        break;
                    }
                }

                if(!entry) {
                    throw new Error("The app " + appName + " was not found.");
                }

                return ResourcesLoader.writeJSONFileContents(APPS_JSON, result);
            })
            .then(function(){
                return ResourcesLoader.deleteDirectory(INSTALL_DIRECTORY + appName);
            })
            .then(function(){
                return entry;
            });
        }

        return {
            //return promise with the array of apps
            getAppsList : function(getFullEntries) {
                return ResourcesLoader.ensureDirectoryExists(APPS_JSON)
                .then(function() {
                    return ResourcesLoader.readJSONFileContents(APPS_JSON);
                })
                .then(function(result){
                    result.installedApps = result.installedApps || [];
                    var newAppsList = [];

                    for(var i = 0; i < result.installedApps.length; i++){
                        if(getFullEntries) {
                            newAppsList.push(result.installedApps[i]);
                        } else {
                            newAppsList.push(result.installedApps[i].Name);
                        }
                    }

                    return newAppsList;
                });
            },

            launchApp : function(appName) {
                var platformWWWLocation;
                var startLocation;
                return ResourcesLoader.readJSONFileContents(METADATA_JSON)
                .then(function(settings){
                    settings = settings || {};
                    settings.lastLaunched = appName;
                    return ResourcesLoader.writeJSONFileContents(METADATA_JSON, settings);
                })
                .then(function(){
                    return ResourcesLoader.getFullFilePath(INSTALL_DIRECTORY + appName + "/" + platformId);
                })
                .then(function(platformLocation){
                    platformWWWLocation = platformLocation + "/www/";
                    return getAppStartPageFromConfig(platformLocation + "/config.xml", platformWWWLocation);
                })
                .then(function(_startLocation){
                    startLocation = _startLocation;
                    var promises = [];
                    for (var i = preLaunchHooks.length - 1; i >= 0; i--) {
                        promises.push(preLaunchHooks[i](appName, platformWWWLocation));
                    }
                    return Q.all(promises);
                })
                .then(function() {
                    window.location = startLocation;
                });
            },

            addAppFromPattern : function(appName, appSourcePattern) {
                return this.getAppsList(false /* App names only */)
                .then(function(appsList){
                    if(appsList.indexOf(appName) !== -1) {
                        throw new Error("An app with this name already exists");
                    }
                    return addNewAppFromPattern(appName, appSourcePattern);
                });
            },

            uninstallApp : function(appName) {
                return removeApp(appName);
            },

            getLastRunApp : function() {
                return ResourcesLoader.readJSONFileContents(METADATA_JSON)
                .then(function(settings){
                    if(!settings || !settings.lastLaunched) {
                        throw new Error("No App has been launched yet");
                    }
                    return settings.lastLaunched;
                });
            },

            registerPatternDownloader : function(handler, priority){
                if(!handler) {
                    throw new Error("Expected handler");
                }
                if(typeof(handler.canHandleSourcePattern) !== "function") {
                    throw new Error("Expected function for bool handler.canHandleSourcePattern(string pattern) to exist");
                }
                if(typeof(handler.downloadFromPattern) !== "function") {
                    throw new Error("Expected function for (string fullFilePath or QPromise) handler.downloadFromPattern(string appName, string pattern, string tempDirectory) to exist");
                }
                if(!priority) {
                    // Assign a default priority
                    priority = 500;
                }
                var i = 0;
                var objToInsert = { "priority" : priority, "handler" : handler };
                for(i = 0; i < downloadHandlers.length; i++){
                    if(downloadHandlers[i].priority > objToInsert.priority) {
                        break;
                    }
                }
                downloadHandlers.splice(i, 0, objToInsert);
            },

            registerPackageHandler : function(extension, handler) {
                if(!extension) {
                    throw new Error("Expcted extension");
                }
                if(!handler || typeof(handler.extractPackageToDirectory) !== "function") {
                    throw new Error("Expected function for void handler.extractPackageToDirectory(string fullFilePath, string directoryPath) to exist");
                }
                if(handler[extension]) {
                    throw new Error("Handler already exists for the extension: " + extension);
                }
                extensionHandlers[extension] = handler;
            },

            updateApp : function(appName){
                return removeApp(appName)
                .then(function(entry){
                    if(entry.Source === "pattern") {
                        return addNewAppFromPattern(entry.Name, entry.Data);
                    }
                });
            },

            getKnownExtensions : function() {
                return Object.keys(extensionHandlers);
            },

            addPreLaunchHook : function(handler){
                if(!handler || typeof(handler) !== "function") {
                    throw new Error("Expected (QPromise or void) function(appName, wwwLocation) for handler");
                }
                preLaunchHooks.push(handler);
            }
        };
    }]);
})();