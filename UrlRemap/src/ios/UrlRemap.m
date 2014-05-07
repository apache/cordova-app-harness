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
#import <MobileCoreServices/MobileCoreServices.h>
#import <Cordova/CDVPlugin.h>

// Tricky things:
// With file:// URLs:
//   1. iOS 6+ gives "Frame load interrupted" when you try to handle a top-frame load with a NSURLProtocol.
//     http://stackoverflow.com/questions/12058203/using-a-custom-nsurlprotocol-on-ios-for-file-urls-causes-frame-load-interrup/19432303/
//     To work around this, there are two options:
//     a) Handle it in shouldOverrideLoadWithRequest and change it into a [UIWebView loadData] call.
//     b) Use a NSURLProtocol and serve a redirect (crazily, this works).
//     - We do b) since a) breaks browser history.
//   2. iOS 6+ also has issues with using a NSURLProtocol to load iframes. (error -999)
//     To work around this, we use a redirect as well.
//   Note: We can detect frame loads by recording them in shouldOverrideLoadWithRequest.
// For non-file: URLs:
//   1. Redirects to other schemes are not followed for iframe loads.
//     - We work around this by using a 200 response when the scheme changes (works only for non-file: -> file:).
// Not sure if applies only to file://
//   1. Synchronous XHRs fail with error -111 when if we don't respond to them synchronously.
//     - This came up when we were using NSURLProtocol to sub-load resources (we not longer do this).


@class RouteParams;
@class UrlRemap;

static UrlRemap* gPlugin = nil;

static NSString* mimeTypeForPath(NSString* path) {
    NSString *ret = nil;
    CFStringRef pathExtension = (__bridge_retained CFStringRef)[path pathExtension];
    CFStringRef type = UTTypeCreatePreferredIdentifierForTag(kUTTagClassFilenameExtension, pathExtension, NULL);
    CFRelease(pathExtension);
    if (type != NULL) {
        ret = (__bridge_transfer NSString *)UTTypeCopyPreferredTagWithClass(type, kUTTagClassMIMEType);
        CFRelease(type);
    }
    return ret;
}

@interface UrlRemap : CDVPlugin {
  @package
    RouteParams* _resetUrlParams;
    NSMutableArray* _rerouteParams;
}

- (void)addAlias:(CDVInvokedUrlCommand*)command;
- (void)clearAllAliases:(CDVInvokedUrlCommand*)command;
@end

@interface UrlRemap()
- (RouteParams*)getChosenParams:(NSURL*)url forInjection:(BOOL)forInjection;
@end

@interface RouteParams : NSObject {
  @public
    NSRegularExpression* _matchRegex;
    NSRegularExpression* _replaceRegex;
    NSString* _replacer;
    BOOL _redirectToReplacedUrl;
    BOOL _allowFurtherRemapping;
    NSString* _jsToInject;
}
@end

@implementation RouteParams
- (BOOL)matches:(NSString*)uriString {
    NSRange wholeStringRange = NSMakeRange(0, [uriString length]);
    NSInteger numMatches = [_matchRegex numberOfMatchesInString:uriString options:0 range:wholeStringRange];
    return numMatches > 0;
}

- (NSURL*)applyReplacement:(NSURL*)src {
    NSString* urlString = [src absoluteString];
    NSRange wholeStringRange = NSMakeRange(0, [urlString length]);
    NSString* newUrlString = [_replaceRegex stringByReplacingMatchesInString:urlString options:0 range:wholeStringRange withTemplate:_replacer];
    NSURL* newUrl = [NSURL URLWithString:newUrlString];
    return newUrl;
}

@end

@interface UrlRemapURLProtocol : NSURLProtocol
@end


#pragma mark UrlRemap

@implementation UrlRemap

- (RouteParams*)getChosenParams:(NSURL*)url forInjection:(BOOL)forInjection {
    NSString* uriString = [url absoluteString];
    for (RouteParams* param in _rerouteParams) {
        if (forInjection != !!param->_jsToInject) {
            continue;
        }
        if ([param matches:uriString]) {
            return param;
        }
    }
    return nil;
}

- (void)pluginInitialize {
    if (gPlugin == nil) {
        [NSURLProtocol registerClass:[UrlRemapURLProtocol class]];
    }
    gPlugin = self;
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(pageDidLoad) name:CDVPageDidLoadNotification object:self.webView];

    _rerouteParams = [[NSMutableArray alloc] init];
}

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)pageDidLoad {
    @synchronized (self) {
        NSString* url = [self.webView stringByEvaluatingJavaScriptFromString:@"location.href.replace(/#.*/, '')"];
        RouteParams* params = [self getChosenParams:[NSURL URLWithString:url] forInjection:YES];
        if (params != nil) {
            [self.webView stringByEvaluatingJavaScriptFromString:params->_jsToInject];
        }
    }
}

- (BOOL)shouldOverrideLoadWithRequest:(NSURLRequest*)request navigationType:(UIWebViewNavigationType)navigationType {
    NSURL* newUrl = [request URL];
    RouteParams* lastParams = nil;
    BOOL isTopLevelNavigation = [newUrl isEqual:request.mainDocumentURL];
    @synchronized (self) {
        if (isTopLevelNavigation) {
            RouteParams* params = nil;
            int count = 0;
            do {
                if (_resetUrlParams != nil) {
                    if ([_resetUrlParams matches:[newUrl absoluteString]]) {
                        [_rerouteParams removeAllObjects];
                        break;
                    }
                }

                params = [self getChosenParams:newUrl forInjection:NO];
                if (params != nil) {
                    lastParams = params;
                    count++;
                    newUrl = [params applyReplacement:newUrl];
                }
                if (count == 10) {
                    NSLog(@"Hit infinite redirect in UrlRemap!");
                    break;
                }
            } while (params != nil && params->_allowFurtherRemapping);

            if (lastParams != nil && lastParams->_redirectToReplacedUrl) {
                [self.webView loadRequest:[NSURLRequest requestWithURL:newUrl]];
                return YES;
            }
        }
    }

    return NO;
}

- (void)addAlias:(CDVInvokedUrlCommand*)command {
    CDVPluginResult* pluginResult = nil;
    NSError* error = nil;
    NSString* sourceUrlMatchRegexString = [command argumentAtIndex:0];
    NSRegularExpression* sourceUrlMatchRegex = [NSRegularExpression regularExpressionWithPattern:sourceUrlMatchRegexString options:0 error:&error];
    if(error) {
        pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Match regex is invalid"];
    } else {
        NSString* sourceUrlReplaceRegexString = [command argumentAtIndex:1];
        NSRegularExpression* sourceUrlReplaceRegex = [NSRegularExpression regularExpressionWithPattern:sourceUrlReplaceRegexString options:0 error:&error];
        if(error) {
            pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Replace regex is invalid"];
        } else {
            NSString* replaceString = [command argumentAtIndex:2];

            RouteParams* params = [[RouteParams alloc] init];
            params->_matchRegex = sourceUrlMatchRegex;
            params->_replaceRegex = sourceUrlReplaceRegex;
            params->_replacer = replaceString;
            params->_redirectToReplacedUrl = [[command argumentAtIndex:3] boolValue];
            params->_allowFurtherRemapping = [[command argumentAtIndex:4] boolValue];
            @synchronized (self) {
                [_rerouteParams addObject:params];
            }
            pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
        }
    }
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)clearAllAliases:(CDVInvokedUrlCommand*)command {
    @synchronized (self) {
        [_rerouteParams removeAllObjects];
        _resetUrlParams = nil;
    }
    CDVPluginResult* pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)injectJs:(CDVInvokedUrlCommand*)command {
    RouteParams* params = [[RouteParams alloc] init];
    params->_matchRegex = [NSRegularExpression regularExpressionWithPattern:[command argumentAtIndex:0] options:0 error:nil];
    params->_jsToInject = [command argumentAtIndex:1];
    @synchronized (self) {
        [_rerouteParams addObject:params];
    }
    [self.commandDelegate sendPluginResult:[CDVPluginResult resultWithStatus:CDVCommandStatus_OK] callbackId:command.callbackId];
}

- (void)setResetUrl:(CDVInvokedUrlCommand*)command {
    RouteParams* params = [[RouteParams alloc] init];
    params->_matchRegex = [NSRegularExpression regularExpressionWithPattern:[command argumentAtIndex:0] options:0 error:nil];
    _resetUrlParams = params;
    [self.commandDelegate sendPluginResult:[CDVPluginResult resultWithStatus:CDVCommandStatus_OK] callbackId:command.callbackId];
}
@end

#pragma mark UrlRemapURLProtocol

@implementation UrlRemapURLProtocol

+ (BOOL)canInitWithRequest:(NSURLRequest*)request {
    if ([request valueForHTTPHeaderField:@"url-remap-ignore"] != nil) {
        return NO;
    }
    NSURL* url = [request URL];
    @synchronized (gPlugin) {
        RouteParams* params = [gPlugin getChosenParams:url forInjection:NO];
        return params != nil;
    }
}

+ (NSURLRequest*)canonicalRequestForRequest:(NSURLRequest*)request {
    return request;
}

- (void)issueNotFoundResponse {
    NSURL* url = [[self request] URL];
    NSURLResponse *response = [[NSHTTPURLResponse alloc] initWithURL:url statusCode:404 HTTPVersion:@"HTTP/1.1" headerFields:@{@"Cache-Control": @"no-cache"}];
    [[self client] URLProtocol:self didReceiveResponse:response cacheStoragePolicy:NSURLCacheStorageNotAllowed];
    [[self client] URLProtocolDidFinishLoading:self];
}

- (void)issueRedirectResponseToURL:(NSURL*)dest {
    NSMutableURLRequest* req = [[self request] mutableCopy];
    [req setURL:dest];
    [req setValue:@"1" forHTTPHeaderField:@"url-remap-ignore"];

    NSURLResponse *response = [[NSHTTPURLResponse alloc] initWithURL:[[self request] URL] statusCode:302 HTTPVersion:@"HTTP/1.1" headerFields:@{ @"Location": [dest absoluteString], @"Cache-Control": @"no-cache" }];

    [[self client] URLProtocol:self wasRedirectedToRequest:req redirectResponse:response];
}

- (void)issueDirectResponseForFileUrl:(NSURL*)url {
    NSURL* origUrl = [self.request URL];
    if ([[url scheme] isEqualToString:@"file"]) {
        NSString* path = [url path];
        FILE* fp = fopen([path UTF8String], "r");
        if (fp) {
            fseek(fp, 0L, SEEK_END);
            long contentLength = ftell(fp);
            fseek(fp, 0L, SEEK_SET);

            NSMutableDictionary* responseHeaders = [[NSMutableDictionary alloc] init];
            responseHeaders[@"Cache-Control"] = @"no-cache";
            responseHeaders[@"Content-Length"] = [[NSNumber numberWithLong:contentLength] stringValue];
            NSString* mimeType = mimeTypeForPath(path);
            if (mimeType != nil) {
                responseHeaders[@"Content-Type"] = mimeType;
            }
            NSURLResponse *response = [[NSHTTPURLResponse alloc] initWithURL:origUrl statusCode:200 HTTPVersion:@"HTTP/1.1" headerFields:responseHeaders];
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

- (void)startLoading {
    NSURL* newUrl = [[self request] URL];
    int count = 0;
    NSString* startScheme = [newUrl scheme];
    if ([[newUrl absoluteString] hasPrefix:@"app-h"]) {
        count = 0;
    }
    UrlRemap* plugin = gPlugin;
    @synchronized (plugin) {
        RouteParams* params = nil;
        do {
            params = [plugin getChosenParams:newUrl forInjection:NO];
            if (params != nil) {
                count++;
                newUrl = [params applyReplacement:newUrl];
            }
            if (count == 10) {
                NSLog(@"Hit infinite redirect in UrlRemap!");
                break;
            }
        } while (params != nil && params->_allowFurtherRemapping);

    }
    // Race condition where params are cleared between canInit and startLoading.
    if (count == 0) {
        [self issueNotFoundResponse];
    } else if (![startScheme isEqualToString:[newUrl scheme]]) {
        // Redirect won't be allowed for iframes if the scheme switches. E.g. from app-harness: -> file:
        [self issueDirectResponseForFileUrl:newUrl];
    } else {
        [self issueRedirectResponseToURL:newUrl];
    }
}

- (void)stopLoading {}

- (NSCachedURLResponse *)connection:(NSURLConnection *)connection
                  willCacheResponse:(NSCachedURLResponse*)cachedResponse {
    return nil;
}

@end

