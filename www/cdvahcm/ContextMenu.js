(function () {

    function initialise() {
        setupIframe();
        sendAppNameToIframe();
        setupIframeMessaging();
        //loadFirebug(false);
        attachErrorListener();
    }

    var contextMenuIframe = "__cordovaappharness_contextMenu_iframe";
    function setupIframe(){
        var contextHTMLUrl = "app-harness:///cdvahcm/contextMenu.html";
        var el = document.createElement("iframe");
        el.setAttribute("id", contextMenuIframe);
        el.setAttribute("src", contextHTMLUrl);
        el.setAttribute("style", "position: fixed; left : 0px; top : 0px; z-index: 2000; width: 100%; height: 100%; display : none;");
        document.body.appendChild(el);
        // Setup the listeners to toggle the context menu
        document.addEventListener("touchmove", function (event) {
            if(event.touches.length >= 3) {
                document.getElementById(contextMenuIframe).style.display = "inline";
            }
        }, false);
    }

    function sendAppNameToIframe(){
        if(window.__cordovaAppHarnessAppName){
            var el = document.getElementById(contextMenuIframe);
            el.onload = function(){
                el.contentWindow.postMessage("AppHarnessAppName:" + window.__cordovaAppHarnessAppName, "*");
            };
        }
    }

    function onContextMenuUpdateClicked(){
        window.location = "app-harness:///cdvah/index.html#/?updateLastLaunched=true";
    }
    function onContextMenuRestartClicked(){
        window.location = "app-harness:///cdvah/index.html#/?lastLaunched=true";
    }
    var firebugFirstOpen = true;
    function onContextMenuFirebugClicked(){
        try {
            if(firebugFirstOpen){
                console.warn("Note that messages logged to the console at the app startup may not be visible here.");
                console.warn("Do not use the close button on Firebug. Your console logs will be cleared. Use minimize instead.");
                firebugFirstOpen = false;
            }
            window.Firebug.chrome.open();
        } catch(e) {
            // hack - FirebugLite appears to have several bugs. One of which is - open firebug, user shuts down FirebugLite through the UI.
            // FirebugLite is now in a bad state of neither being usable or removable. Any calls to open throw an error.
            // The following lines removes the flags that FirebugLite looks for manually and makes it think it has not loaded it yet
            // Then FirebugLite is loaded into the page again
            // This hack should be revisited when FirebugLite moves from version 1.4
            // Either the hack won't be needed anymore or the hack should be checked too see if it still works.
            var el = document.getElementById("FirebugLite");
            if(el) {
                el.setAttribute("id", "");
            }
            delete console.firebuglite;
            loadFirebug(true);
        }
    }
    function onContextMenuMainMenuClicked(){
        window.location = "app-harness:///cdvah/index.html";
    }
    function onContextMenuHideClicked(){
        document.getElementById(contextMenuIframe).style.display = "none";
    }
    function onContextMenuWeinreNameChanged(newName){
        var el = document.createElement("script");
        el.setAttribute("src", "http://debug.phonegap.com/target/target-script-min.js#" + newName);
        document.head.appendChild(el);
    }

    var messageHandler = {
        "ContextMenuUpdate" : onContextMenuUpdateClicked,
        "ContextMenuRestart" : onContextMenuRestartClicked,
        "ContextMenuFirebug" : onContextMenuFirebugClicked,
        "ContextMenuMainMenu" : onContextMenuMainMenuClicked,
        "ContextMenuHide" : onContextMenuHideClicked,
        "ContextMenuWeinre" : onContextMenuWeinreNameChanged
    };
    function setupIframeMessaging(){
        window.addEventListener("message", function(e){
            if (!e || !e.data || typeof e.data !== 'string') {
                return;
            }

            var messageParts = [ e.data ];
            var loc = e.data.indexOf(":");
            if(loc !== -1){
                messageParts = [ e.data.substring(0, loc),
                    e.data.substring(loc + 1)
                ];
            }
            if(messageHandler[messageParts[0]]){
                messageHandler[messageParts[0]](messageParts[1]);
            }
        } , false);
    }

    function loadFirebug(startOpened){
        var el = document.createElement("script");
        el.setAttribute("id", "FirebugLite");
        el.setAttribute("src", "https://getfirebug.com/firebug-lite-beta.js");
        el.setAttribute("FirebugLite", "4");
        el.innerHTML = el.innerHTML = "{ debug : false, startOpened : "  + startOpened + ", showIconWhenHidden : false, saveCommandLineHistory : true, saveCookies : false }";
        document.head.appendChild(el);
    }

    // FirebugLite doesn't catch errors from window.onerror like desktop browser's dev tools do. So we add it manually.
    function attachErrorListener(){
        window.onerror = function(msg, url, line) {
            console.error("Error: " + msg + " on line: " +  line + " in file: " + url);
        };
    }

    initialise();
})();

