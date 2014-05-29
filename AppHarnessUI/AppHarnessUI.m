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

@interface AppHarnessUI : CDVPlugin {
    AHUIViewController* _slaveCordovaViewController;
    NSString* _eventsCallbackId;
    BOOL _slaveVisible;
}
- (void)sendEvent:(NSString*)event;
@end

#pragma mark AHUIViewController

@implementation AHUIViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    UITapGestureRecognizer *tapRecognizer =
        [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(handleTap:)];

    // Two-finger double-tap.
    tapRecognizer.numberOfTapsRequired = 2;
    tapRecognizer.numberOfTouchesRequired = 2;
    tapRecognizer.delegate = self;
 
    // Add the tap gesture recognizer to the view
    [self.view addGestureRecognizer:tapRecognizer];
}

- (BOOL)gestureRecognizer:(UIGestureRecognizer *)gestureRecognizer shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)otherGestureRecognizer {
    // Required for tap gesture recognizer to work with UIWebView.
    return YES;
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
        [self setVisibleHelper:YES];
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
        [self setVisibleHelper:NO];
        _slaveCordovaViewController = nil;
        [self sendEvent:@"destroyed"];
    }
    CDVPluginResult* pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:_eventsCallbackId]; // Close events channel.
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)setVisibleHelper:(BOOL)value {
    if (value == _slaveVisible) {
        return;
    }
    _slaveVisible = value;
    if (_slaveCordovaViewController == nil) {
        NSLog(@"AppHarnessUI.setVisible: slave doesn't exist");
    } else {
        UIView* newView = value ? _slaveCordovaViewController.view : self.viewController.view;
        UIView* oldView = !value ? _slaveCordovaViewController.view : self.viewController.view;
        UIView* superView = oldView.superview;
        [oldView removeFromSuperview];
        [superView addSubview:newView];
    }
}

- (void)setVisible:(CDVInvokedUrlCommand*)command {
    BOOL value = [[command argumentAtIndex:0] boolValue];
    [self setVisibleHelper:value];
    CDVPluginResult* pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

@end

