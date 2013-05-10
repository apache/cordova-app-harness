(function () {

    function initialise() {
        setupIframe();
        setupIframeMessaging();
        loadFirebug(false);
        attachErrorListener();
    }

    var contextMenuIframe = "__cordovaappharness_contextMenu_iframe";
    function setupIframe(){
        var contextHTMLUrl = "app-bundle:///cdvah_contextMenu.html";
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

    function setupIframeMessaging(){
        window.addEventListener("message", function(e){
            if(e.data === "ContextMenuUpdate"){
                onContextMenuUpdateClicked();
            } else if(e.data === "ContextMenuRestart"){
                onContextMenuRestartClicked();
            } else if(e.data === "ContextMenuFirebug"){
                onContextMenuFirebugClicked();
            } else if(e.data === "ContextMenuMainMenu"){
                onContextMenuMainMenuClicked();
            }else if(e.data === "ContextMenuHide"){
                onContextMenuHideClicked();
            }
        } , false);
    }

    function onContextMenuUpdateClicked(){
        window.location = "app-bundle:///cdvah_index.html#/?updateLastLaunched=true";
    }
    function onContextMenuRestartClicked(){
        window.location = "app-bundle:///cdvah_index.html#/?lastLaunched=true";
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
        window.location = "app-bundle:///cdvah_index.html";
    }
    function onContextMenuHideClicked(){
        document.getElementById(contextMenuIframe).style.display = "none";
    }

    function loadFirebug(startOpened){
        var el = document.createElement("script");
        el.setAttribute("id", "FirebugLite");
        el.setAttribute("src", "https://getfirebug.com/firebug-lite.js");
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

