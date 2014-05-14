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
#import <UIKit/UIKit.h>
#import <Cordova/CDVCommandDelegate.h>
#import <Cordova/CDVPlugin.h>
#import <Cordova/CDVViewController.h>

@class AppHarnessUI;

@interface AHUIViewController : CDVViewController<UIGestureRecognizerDelegate> {
@public
    __weak AppHarnessUI* _parentPlugin;
}
@end

@interface AHUIOverlayPlugin : CDVPlugin {
@public
    __weak AppHarnessUI* _parentPlugin;
}
@end

@interface AppHarnessUI : CDVPlugin {
    AHUIViewController* _slaveCordovaViewController;
    NSString* _eventsCallbackId;
    CDVViewController* _overlayCordovaViewController;
}
- (void)sendEvent:(NSString*)event;
@end


#pragma mark AHUIOverlayPlugin

@implementation AHUIOverlayPlugin

- (void)sendEvent:(CDVInvokedUrlCommand*)command {
    NSString* event = [command argumentAtIndex:0];
    [_parentPlugin sendEvent:event];
}

@end


#pragma mark AHUIViewController

@implementation AHUIViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    UIPinchGestureRecognizer *pinchRecognizer =
        [[UIPinchGestureRecognizer alloc] initWithTarget:self action:@selector(handlePinch:)];
    UITapGestureRecognizer *tapRecognizer =
        [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(handleTap:)];

    // Two-finger double-tap.
    tapRecognizer.numberOfTapsRequired = 2;
    tapRecognizer.numberOfTouchesRequired = 2;

    // Add the tap gesture recognizer to the view
    [self.view addGestureRecognizer:tapRecognizer];
    [self.view addGestureRecognizer:pinchRecognizer];
    tapRecognizer.delegate = self;
}

- (BOOL)gestureRecognizer:(UIGestureRecognizer *)gestureRecognizer shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)otherGestureRecognizer {
    // Required for tap gesture recognizer to work with UIWebView.
    return YES;
}

- (void)handlePinch:(UIPinchGestureRecognizer *)recognizer {
    if (recognizer.enabled && recognizer.scale < 0.3) {
        // Stop callbacks for this gesture.
        recognizer.enabled = NO;
        recognizer.enabled = YES;
        [_parentPlugin sendEvent:@"showMenu"];
    }
}

- (void)handleTap:(UITapGestureRecognizer *)recognizer {
    [_parentPlugin sendEvent:@"showMenu"];
}

@end

#pragma mark AppHarnessUI

@implementation AppHarnessUI

- (void)events:(CDVInvokedUrlCommand*)command {
    _eventsCallbackId = command.callbackId;
}

- (void)sendEvent:(NSString*)event {
    CDVPluginResult* pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsString:event];
    [pluginResult setKeepCallbackAsBool:YES];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:_eventsCallbackId];
}

- (void)evalJs:(CDVInvokedUrlCommand*)command {
    NSString* code = [command argumentAtIndex:0];
    if (_slaveCordovaViewController == nil) {
        NSLog(@"AppHarnessUI.evalJs: Not evaluating JS since no app is active.");
    } else {
        [_slaveCordovaViewController.webView stringByEvaluatingJavaScriptFromString:code];
    }
    CDVPluginResult* pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)create:(CDVInvokedUrlCommand*)command {
    NSString* url = [command argumentAtIndex:0];
    if (_slaveCordovaViewController == nil) {
        _slaveCordovaViewController = [[AHUIViewController alloc] init];
        _slaveCordovaViewController.startPage = url;
        _slaveCordovaViewController->_parentPlugin = self;
        [self.viewController presentViewController:_slaveCordovaViewController animated:NO completion:nil];
    } else {
        NSLog(@"AppHarnessUI.create: already exists");
    }
    CDVPluginResult* pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)destroy:(CDVInvokedUrlCommand*)command {
    if (_slaveCordovaViewController == nil) {
        NSLog(@"AppHarnessUI.destroy: already destroyed.");
    } else {
        _slaveCordovaViewController = nil;
        _overlayCordovaViewController = nil;
        [self.viewController dismissViewControllerAnimated:NO completion:nil];
    }
    CDVPluginResult* pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:_eventsCallbackId]; // Close events channel.
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)createOverlay:(CDVInvokedUrlCommand*)command {
    NSString* url = [command argumentAtIndex:0];
    if (_slaveCordovaViewController == nil) {
        NSLog(@"AppHarnessUI.createOverlay: slave doesn't exist");
    } else if (_overlayCordovaViewController == nil) {
        _overlayCordovaViewController = [[CDVViewController alloc] init];
        _overlayCordovaViewController.startPage = url;
        AHUIOverlayPlugin* overlayPlugin = [[AHUIOverlayPlugin alloc] init];
        overlayPlugin->_parentPlugin = self;
        [_overlayCordovaViewController registerPlugin:overlayPlugin withPluginName:@"OverlayPlugin"];
        _overlayCordovaViewController.view.opaque = NO;
        _overlayCordovaViewController.view.backgroundColor = [UIColor clearColor];
        _overlayCordovaViewController.webView.opaque = NO;
        _overlayCordovaViewController.webView.backgroundColor = [UIColor clearColor];
        _overlayCordovaViewController.webView.scrollView.scrollEnabled = NO;
        [_slaveCordovaViewController.view addSubview:_overlayCordovaViewController.view];
    } else {
        NSLog(@"AppHarnessUI.createOverlay: already exists");
    }
    CDVPluginResult* pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)destroyOverlay:(CDVInvokedUrlCommand*)command {
    if (_overlayCordovaViewController == nil) {
        NSLog(@"AppHarnessUI.destroyOverlay: already destroyed.");
    } else {
        [_overlayCordovaViewController.view removeFromSuperview];
        _overlayCordovaViewController = nil;
    }
    CDVPluginResult* pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}
@end

