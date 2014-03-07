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
package org.apache.cordova.urlremap;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaArgs;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONException;

import android.net.Uri;

public class UrlRemap extends CordovaPlugin {
    private static class RouteParams {
        Pattern matchRegex;
        Pattern replaceRegex;
        String replacer;
        boolean redirectToReplacedUrl;
        boolean allowFurtherRemapping;
        String jsToInject;
    }

    // Have a default replacement path that redirects app-bundle: uri's to the bundle
    private RouteParams resetUrlParams;
    private List<RouteParams> rerouteParams = new ArrayList<RouteParams>();

    @Override
    public boolean execute(String action, CordovaArgs args, final CallbackContext callbackContext) throws JSONException {
        if ("addAlias".equals(action)) {
            RouteParams params = new RouteParams();
            params.matchRegex = Pattern.compile(args.getString(0));
            params.replaceRegex = Pattern.compile(args.getString(1));
            params.replacer = args.getString(2);
            params.redirectToReplacedUrl = args.getBoolean(3);
            params.allowFurtherRemapping = args.getBoolean(4);
            rerouteParams.add(params);
        } else if ("clearAllAliases".equals(action)) {
            resetMappings();
        } else if ("injectJs".equals(action)) {
            RouteParams params = new RouteParams();
            params.matchRegex = Pattern.compile(args.getString(0));
            params.jsToInject = args.getString(1);
            rerouteParams.add(params);
        } else if ("setResetUrl".equals(action)) {
            resetUrlParams = new RouteParams();
            resetUrlParams.matchRegex = Pattern.compile(args.getString(0));
        } else {
            return false;
        }
        callbackContext.success();
        return true;
    }

    private void resetMappings() {
        resetUrlParams = null;
        rerouteParams.clear();
    }

    private RouteParams getChosenParams(String url, boolean forInjection) {
        for (RouteParams params : rerouteParams) {
            if ((params.jsToInject != null) == forInjection && params.matchRegex.matcher(url).find()) {
                return params;
            }
        }
        return null;
    }

    @Override
    public boolean onOverrideUrlLoading(String url) {
        if (resetUrlParams != null && resetUrlParams.matchRegex.matcher(url).find()) {
            resetMappings();
        }

        RouteParams params = getChosenParams(url, false);
        // Check if we need to replace the url
        if (params != null && params.redirectToReplacedUrl) {
            String newUrl = params.replaceRegex.matcher(url).replaceFirst(params.replacer);

            if (resetUrlParams != null && resetUrlParams.matchRegex.matcher(newUrl).find()) {
                resetMappings();
            }

            webView.loadUrl(newUrl);
            return true;
        }
        return false;
    }

    @Override
    public Object onMessage(String id, Object data) {
        // Look for top level navigation changes
        if ("onPageFinished".equals(id) && data != null) {
            String url = data.toString();
            RouteParams params = getChosenParams(url, true);
            if (params != null) {
                webView.sendJavascript(params.jsToInject);
            }
        }
        return null;
    }

    @Override
    public Uri remapUri(Uri uri) {
        String uriAsString = uri.toString();
        RouteParams params = getChosenParams(uriAsString, false);
        if (params != null && !params.redirectToReplacedUrl) {
            String newUrl = params.replaceRegex.matcher(uriAsString).replaceFirst(params.replacer);
            Uri ret = Uri.parse(newUrl);
            if (params.allowFurtherRemapping) {
                ret = webView.getResourceApi().remapUri(ret);
            }
            return ret;
        }
        return null;
    }
}
