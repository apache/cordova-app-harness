(function(){
    "use strict";
    /* global myApp */
    myApp.run(["AppsService", "ResourcesLoader", function(AppsService, ResourcesLoader){

        function isUri(pattern){
            var regexUri = /^(?:([a-z0-9+.-]+:\/\/)((?:(?:[a-z0-9-._~!$&'()*+,;=:]|%[0-9A-F]{2})*)@)?((?:[a-z0-9-._~!$&'()*+,;=]|%[0-9A-F]{2})*)(:(?:\d*))?(\/(?:[a-z0-9-._~!$&'()*+,;=:@\/]|%[0-9A-F]{2})*)?|([a-z0-9+.-]+:)(\/?(?:[a-z0-9-._~!$&'()*+,;=:@]|%[0-9A-F]{2})+(?:[a-z0-9-._~!$&'()*+,;=:@\/]|%[0-9A-F]{2})*)?)(\?(?:[a-z0-9-._~!$&'()*+,;=:\/?@]|%[0-9A-F]{2})*)?(#(?:[a-z0-9-._~!$&'()*+,;=:\/?@]|%[0-9A-F]{2})*)?$/i;
            var ret = (pattern.search(regexUri) !== -1);
            return ret;
        }

        function grabExtensionFromUri(uri) {
            var lastSegment = uri.split("#")[0].split("?")[0].split("/").pop();
            var dotLocation = lastSegment.lastIndexOf(".");
            var extension = (dotLocation !== -1)? lastSegment.substring(dotLocation + 1) : "";
            return extension;
        }

        // Note the priority given has no meaning in and of itself. It is used solely to compare if any other component has higher priority.
        AppsService.registerPatternDownloader({
            canHandleSourcePattern : function (pattern) {
                var canHandle = false;
                if(isUri(pattern)) {
                    var currentExtension = grabExtensionFromUri(pattern);
                    if(currentExtension) {
                        var knownExtensions = AppsService.getKnownExtensions();
                        if(knownExtensions.indexOf(currentExtension) !== -1){
                            canHandle = true;
                        }
                    }
                }
                return canHandle;
            },

            downloadFromPattern : function (appName, pattern, tempDirectory) {
                var extension = grabExtensionFromUri(pattern);
                var fileName = tempDirectory + appName + "." + extension;
                return ResourcesLoader.downloadFromUrl(pattern, fileName);
            }
        }, 500 /* assign a priority */);

    }]);
})();
