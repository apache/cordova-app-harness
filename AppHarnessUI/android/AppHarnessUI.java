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

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.ConfigXmlParser;
import org.apache.cordova.CordovaActivity;
import org.apache.cordova.CordovaArgs;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.LinearLayoutSoftKeyboardDetect;
import org.apache.cordova.PluginEntry;
import org.apache.cordova.PluginResult;
import org.json.JSONArray;
import org.json.JSONException;

import android.annotation.TargetApi;
import android.os.Build;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewPropertyAnimator;
import android.view.animation.DecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.LinearLayout;

@TargetApi(Build.VERSION_CODES.HONEYCOMB)
public class AppHarnessUI extends CordovaPlugin {
    private static final String LOG_TAG = "AppHarnessUI";
    ViewGroup contentView;
    View origMainView;
    CustomCordovaWebView slaveWebView;
    boolean slaveVisible;
    CallbackContext eventsCallback;
    LinearLayoutSoftKeyboardDetect layoutView;

    public boolean isSlaveVisible() {
        return slaveVisible;
    }

    public boolean isSlaveCreated() {
        return slaveWebView != null && slaveWebView.getView().getParent() != null && ((ViewGroup)slaveWebView.getView().getParent()).getParent() != null;
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
        if (slaveWebView == null) {
            Log.w(LOG_TAG, "Not evaluating JS since no app is active");
        } else {
            slaveWebView.evaluateJavascript(code);
        }
        callbackContext.success();
    }

    private void create(String url, Set<String> pluginIdWhitelist, CallbackContext callbackContext) {
        CordovaActivity activity = (CordovaActivity)cordova.getActivity();

        if (slaveWebView != null) {
            Log.w(LOG_TAG, "create: already exists");
        } else {
            slaveWebView = new CustomAndroidWebView(this, activity);
            // We'll set the plugin entries in initWebView.
            slaveWebView.init(cordova, new ArrayList<PluginEntry>(), webView.getWhitelist(), webView.getExternalWhitelist(), preferences);
        }
        {
            initWebView(slaveWebView, pluginIdWhitelist);
            if (preferences.getBoolean("DisallowOverscroll", false)) {
                slaveWebView.getView().setOverScrollMode(View.OVER_SCROLL_NEVER);
            }
            slaveWebView.clearCache(true);
            slaveWebView.clearHistory();
            slaveWebView.loadUrl(url);
            View newView = (View)slaveWebView.getView().getParent();
            contentView.addView(newView);
            slaveVisible = true;
            // Back button capturing breaks without these:
            webView.getView().setEnabled(false);
            newView.requestFocus();
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
            contentView.removeView((View)slaveWebView.getView().getParent());
            webView.getView().setEnabled(true);
            origMainView.requestFocus();

            slaveWebView.getView().setScaleX(1.0f);
            slaveWebView.getView().setScaleY(1.0f);
            slaveWebView.setStealTapEvents(false);
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
                ((View)slaveWebView.getView().getParent()).requestFocus();
            } else {
                anim.scaleX(.25f).scaleY(.25f);
                webView.getView().setEnabled(true);
                slaveWebView.getView().setEnabled(false);
                origMainView.requestFocus();
            }
            slaveWebView.setStealTapEvents(!value);
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
            }
        }
        slaveWebView.getPluginManager().setPluginEntries(pluginEntries);
    }

    private void initWebView(final CustomCordovaWebView newWebView, Set<String> pluginIdWhitelist) {
        setPluginEntries(pluginIdWhitelist);

        CordovaActivity activity = (CordovaActivity)cordova.getActivity();
        if (contentView == null) {
            contentView = (ViewGroup)activity.findViewById(android.R.id.content);
            origMainView = contentView.getChildAt(0);
        }

        if(layoutView == null) {
            layoutView = new LinearLayoutSoftKeyboardDetect(activity, contentView.getWidth(), contentView.getHeight());
            layoutView.addView(newWebView.getView());
        }
        layoutView.setOrientation(LinearLayout.VERTICAL);

//        layoutView.setBackground(origRootView.getBackground());
        layoutView.setLayoutParams(new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT, Gravity.BOTTOM | Gravity.LEFT));

        newWebView.getView().setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
                1.0F));
        newWebView.getView().setVisibility(View.VISIBLE);
    }
}
