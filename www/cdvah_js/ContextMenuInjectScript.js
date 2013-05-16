(function() {
    "use strict";
    /* global myApp */
    myApp.factory("ContextMenuInjectScript", [ function () {
        return function() {
            console.log("Injecting menu script");
            var contextScript = document.createElement("script");
            contextScript.setAttribute("type","text/javascript");
            contextScript.setAttribute("src", "app-bundle:///cdvah_js/ContextMenu.js");
            document.getElementsByTagName("head")[0].appendChild(contextScript);
        };
    }]);
})();