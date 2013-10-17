(function() {
    "use strict";
    /* global myApp */
    myApp.factory("ContextMenuInjectScript", [ function () {
        var toInject = function() {
            document.addEventListener('deviceready', function() {
                console.log("Injecting menu script");
                var contextScript = document.createElement("script");
                contextScript.setAttribute("src", "app-bundle:///ContextMenu.js");
                window.__cordovaAppHarnessAppName = "appPlaceHolder";
                document.getElementsByTagName("head")[0].appendChild(contextScript);
            });
        };

        return {
            getInjectString : function(appName){
                var string = "\n(" + toInject.toString() + ")();";
                string = string.replace("appPlaceHolder", appName);
                return string;
            }
        };
    }]);
})();
