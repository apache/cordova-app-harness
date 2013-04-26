(function () {

    function initialise() {
        var contextHTMLUrl = "cdv-app-harness:///direct/contextMenu.html";
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
    }

    function onInject(stringifiedHtml) {

        document.body.innerHTML += stringifiedHtml;

        var contextDiv = "__cordovaappharness_contextMenu_div";
        // Setup the listeners to toggle the context menu
        document.addEventListener("touchmove", function (event) {
            if(event.touches.length >= 3) {
                document.getElementById(contextDiv).style.display = "inline";
            }
        }, false);

        document.getElementById(contextDiv).onclick = function() {
            document.getElementById(contextDiv).style.display = "none";
        };
    }

    initialise();
})();

