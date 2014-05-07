// Copyright (c) 2013 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package org.apache.appharness;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaArgs;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.PluginResult;
import org.json.JSONException;
import org.json.JSONObject;

import android.annotation.SuppressLint;
import android.os.Build;
import android.util.Log;
import fi.iki.elonen.NanoHTTPD;

public class Push extends CordovaPlugin {

    private static final String LOG_TAG = "HarnessPush";
    private static final int PORT = 2424;
    
    private PushServer server;
    private boolean listening;
    private CallbackContext pendingCallbackContext;

    @Override
    public boolean execute(String action, CordovaArgs args, final CallbackContext callbackContext) throws JSONException {
        if ("listen".equals(action)) {
            listen(callbackContext);
            return true;
        } else if ("pending".equals(action)) {
            pendingCallbackContext = callbackContext;
            return true;
        }

        return false;
    }

    private void listen(CallbackContext callbackContext) {
        // First, check that we're not already listening.
        if (listening) {
            callbackContext.success();
            return;
        }

        // Create the NanoHTTPD server.
        try {
            server = new PushServer();
            server.start();
            listening = true;
            callbackContext.success();
        } catch (IOException ioe) {
            Log.w(LOG_TAG, "Error launching web server", ioe);
            callbackContext.error("Could not launch server");
        }
    }

    private void sendMessage(String messageType, JSONObject opts) {
        if (pendingCallbackContext != null) {
            JSONObject message = new JSONObject();
            try {
                message.put("type", messageType);
                message.put("extra", opts);
            } catch (JSONException e) {
                e.printStackTrace();
            }
            PluginResult p = new PluginResult(PluginResult.Status.OK, message);
            p.setKeepCallback(true);
            pendingCallbackContext.sendPluginResult(p);
        }
    }
    
    private void injectJS(final String toInject) {
        this.cordova.getActivity().runOnUiThread(new Runnable() {
            @SuppressLint("NewApi")
            @Override
            public void run() {
                final AppHarnessUI ui = ((AppHarnessUI)webView.pluginManager.getPlugin("AppHarnessUI"));
                if (ui.getSlave() == null) {
                    Log.w(LOG_TAG, "Not evaluating JS since no app is active");
                } else {
                    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.KITKAT) {
                        ui.getSlave().loadUrl("javascript:" + toInject);
                    } else {
                        ui.getSlave().evaluateJavascript(toInject, null);
                    }
                }
            }
        });
    }

    private class PushServer extends NanoHTTPD {
        public PushServer() {
            super(Push.PORT);
        }

        public Response serve(IHTTPSession session) {
            if (session.getMethod() != Method.POST)
                return new Response(Response.Status.METHOD_NOT_ALLOWED, "text/plain", "Method " + String.valueOf(session.getMethod()) + " not allowed.");

            if (session.getUri().equals("/push")) {
                Map<String, List<String>> params = decodeParameters(session.getQueryParameterString());

                List<String> typeList = params.get("type");
                String type = null;
                if (typeList != null) type = typeList.get(0);
                if (type == null) return new Response(Response.Status.BAD_REQUEST, "text/plain", "No push type specified");

                if ("serve".equals(type)) {
                    // Create the latestPush value from the parameters.
                    try {
                        JSONObject payload = new JSONObject();
                        payload.put("name", params.get("name").get(0));
                        payload.put("type", "serve");
                        payload.put("url", params.get("url").get(0));
                        sendMessage("updateApp", payload);
                        return new Response(Response.Status.OK, "text/plain", "Push successful");
                    } catch (JSONException je) {
                        Log.w(LOG_TAG, "JSONException while building 'serve' mode push data", je);
                        return new Response(Response.Status.INTERNAL_ERROR, "text/plain", "Error building JSON result");
                    }
                } else {
                    Log.w(LOG_TAG, "Unrecognized application type: " + type);
                }

                return new Response(Response.Status.BAD_REQUEST, "text/plain", "Push type '" + type + "' unknown");
            } else if (session.getUri().equals("/exec")) {
                Map<String, List<String>> params = decodeParameters(session.getQueryParameterString());
                for (String code : params.get("code")) {
                    injectJS(code);
                }
                return new Response(Response.Status.OK, "text/plain", "Executed successfully");
            } else if (session.getUri().equals("/menu")) {
                final AppHarnessUI ui = ((AppHarnessUI)webView.pluginManager.getPlugin("AppHarnessUI"));
                ui.sendEvent("quitApp");
            	return new Response(Response.Status.OK, "text/plain", "Returning to main menu");
            } else {
                return new Response(Response.Status.NOT_FOUND, "text/plain", "URI " + String.valueOf(session.getUri()) + " not found");
            }
        }
    }
}
