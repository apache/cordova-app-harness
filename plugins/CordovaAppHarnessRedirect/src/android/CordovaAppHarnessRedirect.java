package org.apache.cordova.cordovaappharness;

import java.io.IOException;
import java.io.InputStream;

import org.apache.cordova.api.CordovaPlugin;
import org.apache.cordova.FileHelper;
import android.webkit.WebResourceResponse;

public class CordovaAppHarnessRedirect extends CordovaPlugin {

    // Ensure we we redirect any file:///*/cordova.js uri's to the the cordova.js located in the assets
    // Ensure we redirect any file:///*/__cordovaappharness_contextMenu_{menu_choice} uri's to the correct locations
    @Override
    public WebResourceResponse shouldInterceptRequest(String url) {

        String cleanUrl = url.split("\\?")[0].split("#")[0];
        String[] urlParts = cleanUrl.split("/");
        String fileName = urlParts[urlParts.length - 1];

        if(fileName.equals("cordova.js")) {
            url = "cordova.js";
        } else if(fileName.equals("__cordovaappharness_contextMenu_page.html")) {
            url = "contextMenu.html";
        } else if(fileName.equals("__cordovaappharness_contextMenu_script.js")) {
            url = "js/ContextMenu.js";
        } else if(fileName.equals("__cordovaappharness_contextMenu_mainmenu")) {
            this.webView.loadUrl("file:///android_asset/www/index.html");
            return null;
        } else {
            return null;
        }

        String mimetype = FileHelper.getMimeType(url, this.cordova);
        String encoding = null;
        if (mimetype != null && mimetype.startsWith("text/")) {
            encoding = "UTF-8";
        }

        InputStream is = null;
        try {
            is = this.cordova.getActivity().getAssets().open("www/" + url);
        } catch (IOException ioe) {
            return null;
        }

        return new WebResourceResponse(mimetype, encoding, is);
    }
}
