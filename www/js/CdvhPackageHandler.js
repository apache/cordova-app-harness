(function(){
    "use strict";
    /* global myApp */
    myApp.run(["AppsService", function(AppsService){
        AppsService.registerPackageHandler("cdvh", {
            extractPackageToDirectory : function (fileName, outputDirectory){
                var deferred = Q.defer();

                //will throw an exception if the zip plugin is not loaded
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
        });
    }]);

})();