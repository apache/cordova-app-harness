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
#import <Cordova/CDVPlugin.h>

@class RouteParams;

static NSString* const kAppBundlePrefix = @"app-bundle:///";
static NSString* gPathPrefix = nil;
static UIWebView* gWebView = nil;
static NSMutableArray* gRerouteParams = nil;
static RouteParams* gResetUrlParams = nil;

@interface AppBundle : CDVPlugin {}
- (void)addAlias:(CDVInvokedUrlCommand*)command;
- (void)clearAllAliases:(CDVInvokedUrlCommand*)command;
@end

@interface AppBundle() {}
- (void)resetMap;
@end

@interface RouteParams : NSObject {
  @public
    NSRegularExpression* _matchRegex;
    NSRegularExpression* _replaceRegex;
    NSString* _replacer;
    BOOL _redirectToReplacedUrl;
    NSString* _jsToInject;
}
@end

@implementation RouteParams
- (BOOL)matches:(NSString*)uriString {
    NSRange wholeStringRange = NSMakeRange(0, [uriString length]);
    NSInteger numMatches = [_matchRegex numberOfMatchesInString:uriString options:0 range:wholeStringRange];
    return numMatches > 0;
}
@end

@interface AppBundleURLProtocol : NSURLProtocol
+ (RouteParams*)getChosenParams:(NSString*)uriString forInjection:(BOOL)forInjection;
@end


#pragma mark AppBundle

@implementation AppBundle

- (void)resetMap {
    NSError *error = NULL;
    NSRegularExpression* bundleMatchRegex = [NSRegularExpression regularExpressionWithPattern:@"^app-bundle:///.*" options:0 error:&error];
    NSRegularExpression* bundleReplaceRegex = [NSRegularExpression regularExpressionWithPattern:@"^app-bundle:///" options:0 error:&error];
    RouteParams* params = [[RouteParams alloc] init];
    params->_matchRegex = bundleMatchRegex;
    params->_replaceRegex = bundleReplaceRegex;
    params->_replacer = gPathPrefix;
    params->_redirectToReplacedUrl = YES;
    gRerouteParams = [[NSMutableArray alloc] init];
    [gRerouteParams addObject:params];
}

- (void)pluginInitialize {

    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(pageDidLoad) name:CDVPageDidLoadNotification object:self.webView];
    gWebView = self.webView;
    [NSURLProtocol registerClass:[AppBundleURLProtocol class]];
    gPathPrefix = [[NSBundle mainBundle] pathForResource:@"cordova.js" ofType:@"" inDirectory:@"www"];
    gPathPrefix = [gPathPrefix stringByDeletingLastPathComponent];
    gPathPrefix = [[NSURL fileURLWithPath:gPathPrefix] absoluteString];
    [self resetMap];
}

- (void)pageDidLoad {
    if (gResetUrlParams != nil) {
        NSString* url = [self.webView stringByEvaluatingJavaScriptFromString:@"location.href.replace(/#.*/, '')"];
        if ([gResetUrlParams matches:url]) {
            [self resetMap];
        }
    }
}

- (void)addAlias:(CDVInvokedUrlCommand*)command {
    CDVPluginResult* pluginResult = nil;
    NSError* error = nil;
    NSString* sourceUrlMatchRegexString = [[command argumentAtIndex:0] stringByReplacingOccurrencesOfString:@"{BUNDLE_WWW}" withString:[NSRegularExpression escapedPatternForString:gPathPrefix]];
    NSRegularExpression* sourceUrlMatchRegex = [NSRegularExpression regularExpressionWithPattern:sourceUrlMatchRegexString options:0 error:&error];
    if(error) {
        pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Match regex is invalid"];
    } else {
        NSString* sourceUrlReplaceRegexString = [[command argumentAtIndex:1] stringByReplacingOccurrencesOfString:@"{BUNDLE_WWW}" withString:[NSRegularExpression escapedPatternForString:gPathPrefix]];
        NSRegularExpression* sourceUrlReplaceRegex = [NSRegularExpression regularExpressionWithPattern:sourceUrlReplaceRegexString options:0 error:&error];
        if(error) {
            pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Replace regex is invalid"];
        } else {
            NSString* replaceString = [[command argumentAtIndex:2] stringByReplacingOccurrencesOfString:@"{BUNDLE_WWW}" withString:gPathPrefix];

            RouteParams* params = [[RouteParams alloc] init];
            params->_matchRegex = sourceUrlMatchRegex;
            params->_replaceRegex = sourceUrlReplaceRegex;
            params->_replacer = replaceString;
            params->_redirectToReplacedUrl = [[command argumentAtIndex:3] boolValue];
            [gRerouteParams addObject:params];
            pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
        }
    }
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)clearAllAliases:(CDVInvokedUrlCommand*)command {
    [self resetMap];
    CDVPluginResult* pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)injectJs:(CDVInvokedUrlCommand*)command {
    RouteParams* params = [[RouteParams alloc] init];
    params->_matchRegex = [NSRegularExpression regularExpressionWithPattern:[command argumentAtIndex:0] options:0 error:nil];
    params->_jsToInject = [command argumentAtIndex:1];
    [gRerouteParams addObject:params];
    [self.commandDelegate sendPluginResult:[CDVPluginResult resultWithStatus:CDVCommandStatus_OK] callbackId:command.callbackId];
}

- (void)setResetUrl:(CDVInvokedUrlCommand*)command {
    RouteParams* params = [[RouteParams alloc] init];
    params->_matchRegex = [NSRegularExpression regularExpressionWithPattern:[command argumentAtIndex:0] options:0 error:nil];
    gResetUrlParams = params;
    [self.commandDelegate sendPluginResult:[CDVPluginResult resultWithStatus:CDVCommandStatus_OK] callbackId:command.callbackId];
}
@end

#pragma mark AppBundleURLProtocol

@implementation AppBundleURLProtocol

+ (RouteParams*)getChosenParams:(NSString*)uriString forInjection:(BOOL)forInjection {
    for (RouteParams* param in gRerouteParams) {
        if (forInjection != !!param->_jsToInject) {
            continue;
        }
        if ([param matches:uriString]) {
            return param;
        }
    }
    return nil;
}

+ (BOOL)canInitWithRequest:(NSURLRequest*)request {
    NSURL* url = [request URL];
    NSString* urlString = [url absoluteString];
    RouteParams* params = [AppBundleURLProtocol getChosenParams:urlString forInjection:NO];
    return params != nil;
}

+ (NSURLRequest*)canonicalRequestForRequest:(NSURLRequest*)request {
    return request;
}

- (void)issueNotFoundResponse {
    NSURL* url = [[self request] URL];
    NSURLResponse *response = [[NSHTTPURLResponse alloc] initWithURL:url statusCode:404 HTTPVersion:@"HTTP/1.1" headerFields:@{}];
    [[self client] URLProtocol:self didReceiveResponse:response cacheStoragePolicy:NSURLCacheStorageNotAllowed];
    [[self client] URLProtocolDidFinishLoading:self];
}

- (void)issueNSURLResponseForUrl:(NSURL*)url {
    if ([[url scheme] isEqualToString:@"file"]) {
        NSString* path = [url path];
        FILE* fp = fopen([path UTF8String], "r");
        if (fp) {
            NSURLResponse *response = [[NSURLResponse alloc] initWithURL:url MIMEType:@"text/html" expectedContentLength:-1 textEncodingName:@"utf8"];//[[NSHTTPURLResponse alloc] initWithURL:url statusCode:200 HTTPVersion:@"HTTP/1.1" headerFields:@{}];
            [[self client] URLProtocol:self didReceiveResponse:response cacheStoragePolicy:NSURLCacheStorageNotAllowed];

            char* buf = malloc(32768);
            size_t len;
            while ((len = fread(buf,1,32768,fp))) {
                [[self client] URLProtocol:self didLoadData:[NSData dataWithBytes:buf length:len]];
            }
            free(buf);
            fclose(fp);

            [[self client] URLProtocolDidFinishLoading:self];
        } else {
            [self issueNotFoundResponse];
        }
    } else {
        NSLog(@"Cannot redirect to %@. You can only redirect to file: uri's", url);
        [self issueNotFoundResponse];
    }
}

- (void)issueRedirectResponseForUrl:(NSURL*)url {
    if([gWebView isLoading]) {
        [gWebView stopLoading];
    }
    NSURLRequest *request = [NSURLRequest requestWithURL:url];
    [gWebView loadRequest:request];
}

- (void)issueTopLevelRedirect:(NSURL*)url origURL:(NSURL*)origURL {
    // BUG: Using loadData: clears the browser history stack. e.g. history.back() doesn't work.
    [gWebView loadData:[NSData dataWithContentsOfURL:url] MIMEType:@"text/html" textEncodingName:@"utf8" baseURL:origURL];
}

- (void)startLoading {
    NSURLRequest* request = [self request];
    NSString* urlString = [[request URL] absoluteString];
    
    RouteParams* params = [AppBundleURLProtocol getChosenParams:urlString forInjection:NO];
    NSRange wholeStringRange = NSMakeRange(0, [urlString length]);
    NSString* newUrlString = [params->_replaceRegex stringByReplacingMatchesInString:urlString options:0 range:wholeStringRange withTemplate:params->_replacer];
    NSURL* newUrl = [NSURL URLWithString:newUrlString];

    BOOL isTopLevelNavigation = [request.URL isEqual:request.mainDocumentURL];
    
    // iOS 6+ just gives "Frame load interrupted" when you try and feed it data via a URLProtocol.
    // http://stackoverflow.com/questions/12058203/using-a-custom-nsurlprotocol-on-ios-for-file-urls-causes-frame-load-interrup/19432303
    if (isTopLevelNavigation) {
        [self issueTopLevelRedirect:newUrl origURL:[request URL]];
    } else if(params->_redirectToReplacedUrl) {
        [self issueRedirectResponseForUrl:newUrl];
    } else {
        [self issueNSURLResponseForUrl:newUrl];
    }
}

- (void)stopLoading
{}

@end
