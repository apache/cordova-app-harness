/*
       Licensed to the Apache Software Foundation (ASF) under one
       or more contributor license agreements.  See the NOTICE file
       distributed with this work for additional information
       regarding copyright ownership.  The ASF licenses this file
       to you under the Apache License, Version 2.0 (the
       "License"); you may not use this file except in compliance
       with the License.  You may obtain a copy of the License at

         http://www.apache.org/licenses/LICENSE-2.0

       Unless required by applicable law or agreed to in writing,
       software distributed under the License is distributed on an
       "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
       KIND, either express or implied.  See the License for the
       specific language governing permissions and limitations
       under the License.
*/
package org.apache.cordova.appbundle;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaInterface;
import org.apache.cordova.CordovaPlugin;
import android.net.Uri;
import android.net.Uri.Builder;
import android.util.Log;

public class AppBundle extends CordovaPlugin {

    /*
    This plugin allows any uri's that are loaded to be replaced with modified uri's
    These include uri's being loaded by the browser such as page navigation, script tags, as well as file uris being opened by file api etc.
    There are 4 parameters here that affect the replacement.
    The matchRegex, replaceRegex, replacerString, shouldRedirect

    The algorithm operates as follows

    currently loading 'url'
    if(url matches matchRegex){
        newUrl = url.replace(replaceRegex, replacerString)
        if(this is topLevelRequest){
            stopLoadingUrl()
            loadUrl(newUrl)
            return
        } else {
            url = newUrl
        }
    }
    continue loading 'url'

    There are some implementation details involved here such as the ability to distinguish between top level requests and other requests.
    Please see the code for details regarding this.

    There is an array of {matchRegex, replaceRegex, replacerString, shouldRedirect} stored referred to as the reroute map

    "app-bundle:" uri's are absolute uri's that point to your bundle.
    By default the rerouteMap contains the parameters required to redirect
        app-bundle:///blah -> file:///android_asset/www/blah

    The rerouteMap can be modified from javascript by calling the addAlias and clearAlias methods

    Recursive replacements are supported by this plugin as well.
    Consider the reroute map contains
         1) http://mysite.com/ -> file:///android_asset/www/
         2) file:///android_asset/www/blah -> file:///storage/www/
         3) http://mysite.com/ -> http:///mysiteproxy.com/
         4) http://mysiteproxy.com/ -> http:///mysiteproxy2.com/
    A request to http://mysite.com/blah should give http:///mysiteproxy2.com/blah
    Also note that the recursive replacements apply the rules last to first.

    CAVEAT: Recursive replacements to app-bundle: should not occur
    For example lets say the we have the rerouteParams set up as
         1) app-bundle:/// -> file:///android_asset/www/
         2) file:///android_asset/www/ -> file:///storage/www/
    A request to app-bundle:///blah should give file:///android_asset/www/ NOT file:///storage/www/
    This requirement is required by the definition of app-bundle: uris.
    */
    private static final String LOG_TAG = "AppBundle";
    private static final String APP_BUNDLE_REPLACED = "AppBundleReplaced";

    private static class RouteParams {
        public String matchRegex;
        public String replaceRegex;
        public String replacer;
        public boolean redirectToReplacedUrl;

        public RouteParams(String matchRegex, String replaceRegex, String replacer, boolean redirectToReplacedUrl){
            this.matchRegex = matchRegex;
            this.replaceRegex = replaceRegex;
            this.replacer = replacer;
            this.redirectToReplacedUrl = redirectToReplacedUrl;
        }
    }

    private final String BUNDLE_PATH = "file:///android_asset/www/";
    // Have a default replacement path that redirects app-bundle: uri's to the bundle
    private final RouteParams appBundleParams = new RouteParams("^app-bundle:///.*", "^app-bundle:///", BUNDLE_PATH, true);
    private List<RouteParams> rerouteParams = new ArrayList<RouteParams>();

    @Override
    public void initialize(CordovaInterface cordova, CordovaWebView webView) {
        super.initialize(cordova, webView);
        resetMap();
    }
    private void resetMap(){
        rerouteParams.clear();
        rerouteParams.add(appBundleParams);
    }

    @Override
    public boolean execute(String action, CordovaArgs args, final CallbackContext callbackContext) {
        if ("addAlias".equals(action)) {
            addAlias(args, callbackContext);
            return true;
        } else if ("clearAllAliases".equals(action)) {
            clearAllAliases(args, callbackContext);
            return true;
        }
        return false;
    }

    private void addAlias(CordovaArgs args, CallbackContext callbackContext) {
        try {
            String sourceUrlMatchRegex = args.getString(0).replace("{BUNDLE_WWW}", getRegex(BUNDLE_PATH));
            String sourceUrlReplaceRegex = args.getString(1).replace("{BUNDLE_WWW}", getRegex(BUNDLE_PATH));
            String replaceString = args.getString(2).replace("{BUNDLE_WWW}", BUNDLE_PATH);
            boolean redirectToReplacedUrl = args.getBoolean(3);
            if(replaceString.matches(sourceUrlMatchRegex)){
                callbackContext.error("The replaceString cannot match the match regex. This would lead to recursive replacements.");
            } else {
                rerouteParams.add(new RouteParams(sourceUrlMatchRegex, sourceUrlReplaceRegex, replaceString, redirectToReplacedUrl));
                callbackContext.success();
            }
        } catch(Exception e) {
            callbackContext.error("Could not add alias");
            Log.e(LOG_TAG, "Could not add alias");
        }
    }

    private void clearAllAliases(CordovaArgs args, CallbackContext callbackContext) {
        try {
            resetMap();
            callbackContext.success();
        } catch(Exception e) {
            callbackContext.error("Could not clear aliases");
            Log.e(LOG_TAG, "Could not clear aliases");
        }
    }

    private String getRegex(String string){
        return Pattern.quote(string);
    }

    private RouteParams getChosenParams(String uri){
        if(uri == null) {
            return null;
        } else {
            uri = Uri.parse(uri).toString();
        }
        for(int i = rerouteParams.size() - 1; i >= 0; i--){
            RouteParams param = rerouteParams.get(i);
            if(uri.matches(param.matchRegex)){
                return param;
            }
        }
        return null;
    }

    @Override
    public Object onMessage(String id, Object data) {
        // Look for top level navigation changes
        if("onPageStarted".equals(id)){
            String url = data == null? null: data.toString();
            RouteParams params = getChosenParams(url);
            // Check if we need to replace the url
            if(params != null && params.redirectToReplacedUrl) {
                Uri uri = Uri.parse(url);
                // Check that the APP_BUNDLE_REPLACED query param doesn't exist.
                // If it exists this means a previous app-bundle uri was rerouted to 'uri'. So we shouldn't reroute further.
                if(uri.getQueryParameter(APP_BUNDLE_REPLACED) == null){
                    String newPath = url.replaceAll(params.replaceRegex, params.replacer);
                    //We need to special case app-bundle: uri's to make sure they aren't redirected when we load the modified url
                    if(params.equals(appBundleParams)){
                        // Throw in a APP_BUNDLE_REPLACED query parameter
                        Builder builder = Uri.parse(newPath).buildUpon();
                        builder.appendQueryParameter(APP_BUNDLE_REPLACED, "true");
                        newPath = builder.build().toString();
                    }
                    webView.stopLoading();
                    webView.loadUrl(newPath);
                }
            }
        }
        return null;
    }

    @Override
    public Uri remapUri(Uri uri) {
        String uriAsString = uri.toString();
        RouteParams params = getChosenParams(uriAsString);
        if (params != null){
            // Just send data as we can't tell if this is top level or not.
            // If this is a top level request, it will get trapped in the onPageStarted event handled above.
            String newUri = uriAsString.replaceAll(params.replaceRegex, params.replacer);
            return webView.getResourceApi().remapUri(Uri.parse(newUri));
        } else {
            return uri;
        }
    }
}
