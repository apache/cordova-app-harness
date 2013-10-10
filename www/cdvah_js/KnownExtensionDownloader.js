(function(){
    "use strict";
    /* global myApp */
    myApp.run(["AppsService", "ResourcesLoader", function(AppsService, ResourcesLoader){

        function isUri(pattern){
            var regexUri = /^(?:([a-z0-9+.-]+:\/\/)((?:(?:[a-z0-9-._~!$&'()*+,;=:]|%[0-9A-F]{2})*)@)?((?:[a-z0-9-._~!$&'()*+,;=]|%[0-9A-F]{2})*)(:(?:\d*))?(\/(?:[a-z0-9-._~!$&'()*+,;=:@\/]|%[0-9A-F]{2})*)?|([a-z0-9+.-]+:)(\/?(?:[a-z0-9-._~!$&'()*+,;=:@]|%[0-9A-F]{2})+(?:[a-z0-9-._~!$&'()*+,;=:@\/]|%[0-9A-F]{2})*)?)(\?(?:[a-z0-9-._~!$&'()*+,;=:\/?@]|%[0-9A-F]{2})*)?(#(?:[a-z0-9-._~!$&'()*+,;=:\/?@]|%[0-9A-F]{2})*)?$/i;
            var ret = (pattern.search(regexUri) !== -1);
            return ret;
        }

        // Note the priority given has no meaning in and of itself. It is used solely to compare if any other component has higher priority.
        AppsService.registerInstallHandler({
            downloadFromPattern : function (appName, pattern, tempDirectory) {
                var extension = grabExtensionFromUri(pattern);
                var fileName = tempDirectory + appName + "." + extension;
                return ResourcesLoader.downloadFromUrl(pattern, fileName);
            }
        });

    }]);
})();
