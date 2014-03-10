(function(){
    'use strict';
    /* global myApp */
    myApp.run(['$q', 'AppsService', 'ResourcesLoader', 'ContextMenuInjectScript', function($q, AppsService, ResourcesLoader, ContextMenuInjectScript){

        var platformId = cordova.require('cordova/platform').id;

        AppsService.registerPackageHandler('cdvh', {
            extractPackageToDirectory : function (appName, fileName, outputDirectory){
                var dataToAppend = ContextMenuInjectScript.getInjectString(appName);
                var platformDirectory = outputDirectory + '/' + platformId + '/www/';
                var cordovaFile = platformDirectory + 'cordova.js';
                var pluginsFile = platformDirectory + 'cordova_plugins.js';

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
                        return $q.all([
                            ResourcesLoader.appendFileContents(cordovaFile, dataToAppend),
                            ResourcesLoader.downloadFromUrl('app-bundle:///cdvh_files/www/cordova_plugins.js', pluginsFile)
                        ]);
                    } else {
                        throw new Error('The package does not seem to have the files required for the platform: ' + platformId);
                    }
                });
            }
        });

    }]);
})();
