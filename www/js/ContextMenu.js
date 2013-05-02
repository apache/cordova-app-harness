(function () {

    function initialise() {
        var contextHTMLUrl = "app-bundle:///contextMenu.html";
        var xhr = new window.XMLHttpRequest();
        xhr.onreadystatechange=function()
        {
            if (xhr.readyState==4 && xhr.status==200)
            {
                var stringifiedHtml = xhr.responseText;
                onInject(stringifiedHtml);
            }
        };
        // retrieve the context menu
        xhr.open("GET", contextHTMLUrl, true);
        xhr.send();

        loadFirebug(false);
        attachErrorListener();
    }

    function onInject(stringifiedHtml) {

        document.body.innerHTML += stringifiedHtml;

        var contextDiv = "__cordovaappharness_contextMenu_div";
        var showFirebugButton = "__cordovaappharness_contextMenu_firebug_button";

        // Setup the listeners to toggle the context menu
        document.addEventListener("touchmove", function (event) {
            if(event.touches.length >= 3) {
                document.getElementById(contextDiv).style.display = "inline";
            }
        }, false);

        document.getElementById(contextDiv).onclick = function() {
            document.getElementById(contextDiv).style.display = "none";
        };

        var firstTime = true;
        document.getElementById(showFirebugButton).onclick = function(){
            try {
                if(firstTime){
                    console.warn("Note that messages logged to the console at the app startup may not be visible here.");
                    console.warn("Do not use the close button on Firebug. Your console logs will be cleared. Use minimize instead.");
                    firstTime = false;
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
        };
    }

    function loadFirebug(startOpened){
        var el = document.createElement("script");
        el.setAttribute("id", "FirebugLite");
        el.setAttribute("src", "https://getfirebug.com/firebug-lite.js");
        el.setAttribute("FirebugLite", "4");
        el.innerHTML = el.innerHTML = "{ debug : false, startOpened : "  + startOpened + ", showIconWhenHidden : false, saveCommandLineHistory : true, saveCookies : false }";
        document.head.appendChild(el);
        console.log("test");
    }

    // FirebugLite doesn't catch errors from window.onerror like desktop browser's dev tools do. So we add it manually.
    function attachErrorListener(){
        window.onerror = function(msg, url, line) {
            console.error("Error: " + msg + " on line: " +  line + " in file: " + url);
        };
    }

    initialise();
})();

