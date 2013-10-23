(function() {
    "use strict";
    /* global myApp */
    myApp.factory("ContextMenuInjectScript", [ function () {
        var toInject = function() {
            console.log("Menu script injected.");
            var contextScript = document.createElement("script");
            contextScript.setAttribute("src", "app-harness:///cdvahcm/ContextMenu.js");
            window.__cordovaAppHarnessData = {
                'appIndex': appIndexPlaceHolder,
                'appName': 'appNamePlaceHolder'
            };
            document.getElementsByTagName("head")[0].appendChild(contextScript);
        };

        return {
            getInjectString : function(appName, appIndex) {
                var string = "\n(" + toInject.toString() + ")();";
                string = string.replace('appNamePlaceHolder', appName);
                string = string.replace('appIndexPlaceHolder', appIndex);
                return string;
            }
        };
    }]);
})();
