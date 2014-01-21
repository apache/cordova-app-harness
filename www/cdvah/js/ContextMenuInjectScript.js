(function() {
    'use strict';
    /* global myApp */
    /* global appIndexPlaceHolder */
    myApp.factory('ContextMenuInjectScript', [ function () {
        var toInject = function() {
            if (window.__cordovaAppHarnessData) return; // Short-circuit if I've run on this page before.
            console.log('Menu script injected.');
            var contextScript = document.createElement('script');
            contextScript.setAttribute('src', 'app-harness:///cdvahcm/ContextMenu.js');
            window.__cordovaAppHarnessData = {
                'appIndex': appIndexPlaceHolder,
                'appName': 'appNamePlaceHolder'
            };
            document.getElementsByTagName('head')[0].appendChild(contextScript);
        };

        return {
            getInjectString : function(appName, appIndex) {
                var string = '\n(' + toInject.toString() + ')();';
                string = string.replace('appNamePlaceHolder', appName);
                string = string.replace('appIndexPlaceHolder', appIndex);
                return string;
            }
        };
    }]);
})();
