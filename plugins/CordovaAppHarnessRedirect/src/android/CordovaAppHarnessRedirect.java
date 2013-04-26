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
package org.apache.cordova.cordovaappharness;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;

import org.apache.cordova.api.CordovaPlugin;
import org.apache.cordova.FileHelper;

import android.net.Uri;
import android.webkit.WebResourceResponse;

public class CordovaAppHarnessRedirect extends CordovaPlugin {

    // Returns an empty response, so that an error of unknown url is not displayed.
    // Used when we are loading a new url immediately
    private WebResourceResponse getEmptyWebResourceResponse()
    {
        InputStream is = new ByteArrayInputStream(new byte[0]);
        return new WebResourceResponse("text/plain", "UTF-8", is);
    }

    private WebResourceResponse getWebResourceResponseForFile(String assetFile) {
        String mimetype = FileHelper.getMimeType(assetFile, this.cordova);
        String encoding = null;
        if (mimetype != null && mimetype.startsWith("text/")) {
            encoding = "UTF-8";
        }

        InputStream is = null;
        try {
            is = this.cordova.getActivity().getAssets().open("www" + assetFile);
        } catch (IOException ioe) {
            return null;
        }

        return new WebResourceResponse(mimetype, encoding, is);
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(String url) {
        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme();

        if("cdv-app-harness".equals(scheme)) {
            String redirectPrefix = "cdv-app-harness:///redirect";
            String directPrefix = "cdv-app-harness:///direct";

            if(url.startsWith(redirectPrefix)) {
                String path = url.substring(redirectPrefix.length());
                webView.loadUrl("file:///android_asset/www" + path);
                return getEmptyWebResourceResponse();
            } else if(url.startsWith(directPrefix)) {
                String path = url.substring(directPrefix.length());
                return getWebResourceResponseForFile(path);
            }
        }
        return null;
    }
}
