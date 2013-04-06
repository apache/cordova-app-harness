(function(){
    "use strict";
    /* global myApp */
    myApp.controller("AddCtrl", ["$scope", "resourcesLoader", "INSTALL_DIRECTORY", "TEMP_DIRECTORY", function ($scope, resourcesLoader, INSTALL_DIRECTORY, TEMP_DIRECTORY) {

        $scope.addApp = function(appName, appSource, appUrl) {
            if(appSource === "url") {
                if(appUrl) {
                    addAppFromUrl(appName, appUrl);
                } else {
                    alert("Url not specified");
                }
            }
        };

        function addAppFromUrl(appName, appUrl) {
            var gotDirectoriesCallback = function(directoryNames, errorString) {
                if(errorString) {
                    console.error(errorString);
                    alert("There was an error retrieving the list of installed applications. Please try again.");
                } else {
                    if(directoryNames.indexOf(appName) !== -1) {
                        alert("An app with this name already exists");
                    } else {
                        addNewAppFromUrl(appName, appUrl);
                    }
                }
            };

            resourcesLoader.getSubDirectories(INSTALL_DIRECTORY, gotDirectoriesCallback, true);
        }

        function addNewAppFromUrl(appName, appUrl) {
            var fileName = TEMP_DIRECTORY + appName + ".zip";

            var downloadCallback = function(fullFilePath, errorString) {
                if(errorString) {
                    console.error(errorString);
                    alert("There was an error downloading the app. Please try again.");
                } else {
                    alert("Downloaded " + fullFilePath);
                }
            };

            resourcesLoader.downloadFromUrl(appUrl, fileName, downloadCallback);
        }
    }]);
})();