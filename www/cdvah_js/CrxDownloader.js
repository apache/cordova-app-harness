(function(){
    "use strict";
    /* global myApp */
    myApp.run(["AppsService", "ResourcesLoader", function(AppsService, ResourcesLoader){

        function isChromeWebStoreUri(pattern){
            var regexUri = /^https:\/\/chrome.google.com\/webstore\/detail\/.*?\/[a-z]{32}((\?|#|\/).*)?$/;
            var ret = (pattern.search(regexUri) !== -1);
            return ret;
        }

        AppsService.registerPatternDownloader({
            canHandleSourcePattern : isChromeWebStoreUri,

            downloadFromPattern : function (appName, pattern, tempDirectory) {
                var fileName = tempDirectory + appName + ".crx";
                var chromeAppIdRegex = /^https:\/\/chrome\.google\.com\/webstore\/detail\/.*?\/([a-z]{32})/;
                // Two results expected.
                // 1 - the entire match of the regex
                // 2 - the match of the capture group i.e. the app id
                var matches = pattern.match(chromeAppIdRegex);
                if(!matches || matches.length !== 2){
                    throw new Error("Invalid url for chrome web store");
                }
                var sourceUrl = "https://clients2.google.com/service/update2/crx?response=redirect&x=id%3D" + matches[1] + "%26uc";
                return ResourcesLoader.downloadFromUrl(sourceUrl, fileName);
            }
        }, 500 /* assign a priority */);

    }]);
})();