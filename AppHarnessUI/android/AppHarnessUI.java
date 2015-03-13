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
package org.apache.appharness;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.ConfigXmlParser;
import org.apache.cordova.CordovaActivity;
import org.apache.cordova.CordovaArgs;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CordovaWebView;
import org.apache.cordova.CordovaWebViewEngine;
import org.apache.cordova.CordovaWebViewImpl;
import org.apache.cordova.PluginEntry;
import org.apache.cordova.PluginResult;
import org.apache.cordova.whitelist.WhitelistPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.xmlpull.v1.XmlPullParser;
import org.xmlpull.v1.XmlPullParserException;
import org.xmlpull.v1.XmlPullParserFactory;

import android.annotation.TargetApi;
import android.content.res.XmlResourceParser;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewPropertyAnimator;
import android.view.animation.DecelerateInterpolator;

@TargetApi(Build.VERSION_CODES.HONEYCOMB)
public class AppHarnessUI extends CordovaPlugin {
    private static final String LOG_TAG = "AppHarnessUI";
    ViewGroup contentView;
    CordovaWebView slaveWebView;
    CustomCordovaWebView slaveWebViewEngine;
    boolean slaveVisible;
    CallbackContext eventsCallback;

    @Override
    public void pluginInitialize() {
        contentView = (ViewGroup)cordova.getActivity().findViewById(android.R.id.content);
    }

    public boolean isSlaveVisible() {
        return slaveVisible;
    }

    public boolean isSlaveCreated() {
        return slaveWebView != null && slaveWebView.getView().getParent() != null;
    }

    @Override
    public boolean execute(String action, CordovaArgs args, final CallbackContext callbackContext) throws JSONException {
        if ("create".equals(action)) {
            final String url = args.getString(0);
            final Set<String> pluginIdWhitelistAsSet = jsonArrayToSet(args.getJSONArray(1));
            this.cordova.getActivity().runOnUiThread(new Runnable() {
                public void run() {
                    create(url, pluginIdWhitelistAsSet, callbackContext);
                }
            });
        } else if ("reload".equals(action)) {
            final String url = args.getString(0);
            final Set<String> pluginIdWhitelistAsSet = jsonArrayToSet(args.getJSONArray(1));
            final String webViewType = args.getString(2);
            this.cordova.getActivity().runOnUiThread(new Runnable() {
                public void run() {
                    reload(url, pluginIdWhitelistAsSet, webViewType, callbackContext);
                }
            });
        } else if ("destroy".equals(action)) {
            this.cordova.getActivity().runOnUiThread(new Runnable() {
                public void run() {
                    destroy(callbackContext);
                }
            });
        } else if ("setVisible".equals(action)) {
            final boolean value = args.getBoolean(0);
            this.cordova.getActivity().runOnUiThread(new Runnable() {
                public void run() {
                    setSlaveVisible(value, callbackContext);
                }
            });
        } else if ("evalJs".equals(action)) {
            final String code = args.getString(0);
            this.cordova.getActivity().runOnUiThread(new Runnable() {
                public void run() {
                    evalJs(code, callbackContext);
                }
            });
        } else if ("events".equals(action)) {
            eventsCallback = callbackContext;
        } else {
            return false;
        }
        return true;
    }

    private Set<String> jsonArrayToSet(JSONArray jsonArray) throws JSONException {
        final Set<String> set = new HashSet<String>(jsonArray.length());
        for (int i = 0; i < jsonArray.length(); ++i) {
            set.add(jsonArray.getString(i));
        }
        return set;
    }

    public void sendEvent(String eventName) {
        if (eventsCallback != null) {
            PluginResult pluginResult = new PluginResult(PluginResult.Status.OK, eventName);
            pluginResult.setKeepCallback(true);
            eventsCallback.sendPluginResult(pluginResult );
        }
    }

    private void evalJs(String code, CallbackContext callbackContext) {
        if (slaveWebViewEngine == null) {
            Log.w(LOG_TAG, "Not evaluating JS since no app is active");
        } else {
            slaveWebViewEngine.evaluateJavascript(code);
        }
        callbackContext.success();
    }

    private void create(String url, Set<String> pluginIdWhitelist, CallbackContext callbackContext) {
        CordovaActivity activity = (CordovaActivity)cordova.getActivity();

        if (slaveWebView != null) {
            Log.w(LOG_TAG, "create: already exists");
        } else {
            slaveWebViewEngine = new CustomAndroidWebView(this, activity);
            slaveWebView = new CordovaWebViewImpl(webView.getContext(), (CordovaWebViewEngine)slaveWebViewEngine);
            // A consistent view ID is needed for plugins that utilize the background-activity plugin.
            slaveWebView.getView().setId(200);
            // We'll set the plugin entries in initWebView.
            slaveWebView.init(cordova, new ArrayList<PluginEntry>(), preferences);
        }
        {
            initWebView((CordovaWebViewEngine)slaveWebViewEngine, pluginIdWhitelist);

            slaveWebView.clearCache(true);
            slaveWebView.clearHistory();
            slaveWebView.loadUrl(url);
            contentView.addView(slaveWebView.getView());
            slaveVisible = true;
            // Back button capturing breaks without these:
            webView.getView().setEnabled(false);
            slaveWebView.getView().requestFocus();
        }
        callbackContext.success();
    }

    private void reload(String url, Set<String> pluginIdWhitelist, String webViewType, CallbackContext callbackContext) {
        if (slaveWebView == null) {
            Log.w(LOG_TAG, "reload: no webview exists");
        } else {
            // TODO(maxw): If the webview type has changed, create a new webview.
            setPluginEntries(pluginIdWhitelist);
            slaveWebView.clearCache(true);
            slaveWebView.loadUrl(url);
        }
        callbackContext.success();
    }

    private void destroy(CallbackContext callbackContext) {
        if (slaveWebView == null) {
            Log.w(LOG_TAG, "destroy: already destroyed");
        } else {
            slaveWebView.loadUrl("data:text/plain;charset=utf-8,");
            contentView.removeView(slaveWebView.getView());
            webView.getView().setEnabled(true);
            webView.getView().requestFocus();

            slaveWebView.getView().setScaleX(1.0f);
            slaveWebView.getView().setScaleY(1.0f);
            slaveWebViewEngine.setStealTapEvents(false);
            slaveVisible = false;
            sendEvent("destroyed");
        }
        if (eventsCallback != null) {
            eventsCallback.success("");
            eventsCallback = null;
        }
        callbackContext.success();
    }

    @TargetApi(Build.VERSION_CODES.ICE_CREAM_SANDWICH)
    private void setSlaveVisible(boolean value, CallbackContext callbackContext) {
        if (value == slaveVisible) {
            return;
        }
        if (slaveWebView == null) {
            Log.w(LOG_TAG, "setSlaveVisible: slave not created");
        } else {
            slaveVisible = value;
            ViewPropertyAnimator anim = slaveWebView.getView().animate();
            // Note: Pivot is set in onSizeChanged.
            if (value) {
                anim.scaleX(1.0f).scaleY(1.0f);
                webView.getView().setEnabled(false);
                slaveWebView.getView().setEnabled(true);
                slaveWebView.getView().requestFocus();
            } else {
                anim.scaleX(.25f).scaleY(.25f);
                webView.getView().setEnabled(true);
                slaveWebView.getView().setEnabled(false);
                webView.getView().requestFocus();
            }
            slaveWebViewEngine.setStealTapEvents(!value);
            anim.setDuration(300).setInterpolator(new DecelerateInterpolator(2.0f)).start();
        }
        if (callbackContext != null) {
            callbackContext.success();
        }
    }

    private void setPluginEntries(Set<String> pluginIdWhitelist) {
        CordovaActivity activity = (CordovaActivity)cordova.getActivity();
        ConfigXmlParser parser = new ConfigXmlParser();
        // TODO: Parse the app's config.xml rather than our own config.xml.
        parser.parse(activity);
        ArrayList<PluginEntry> pluginEntries = new ArrayList<PluginEntry>(parser.getPluginEntries());
        for (PluginEntry p : parser.getPluginEntries()) {
            if (!pluginIdWhitelist.contains(p.service)) {
                pluginEntries.remove(p);
            } else if (WhitelistPlugin.class.getCanonicalName().equals(p.pluginClass)) {
                // TODO: pass through path to launching config.xml.
                //p.plugin = createWhitelistPlugin();
            }
        }
        slaveWebView.getPluginManager().setPluginEntries(pluginEntries);
        // This is added by cordova-android in code, so we need to re-add it likewise.
        // Note that we re-route navigator.app.exitApp() in JS to close the webview rather than close the Activity.
        slaveWebView.getPluginManager().addService("CoreAndroid", "org.apache.cordova.CoreAndroid");
    }

    private CordovaPlugin createWhitelistPlugin(Uri configXml) {
        InputStream istr = null;
        try {
            istr = webView.getResourceApi().openForRead(configXml).inputStream;
            XmlPullParserFactory factory = XmlPullParserFactory.newInstance();
            factory.setNamespaceAware(false);
            XmlPullParser parser = factory.newPullParser();
            parser.setInput(istr, "UTF-8");
            return new WhitelistPlugin(parser);
        } catch (XmlPullParserException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        } finally {
            if (istr != null) {
                try {
                    istr.close();
                } catch (IOException e) {
                }
            }
        }
        return null;
    }

    private void initWebView(final CordovaWebViewEngine newWebView, Set<String> pluginIdWhitelist) {
        setPluginEntries(pluginIdWhitelist);

        newWebView.getView().setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        newWebView.getView().setVisibility(View.VISIBLE);
    }
}
