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
// 1. iOS 6+ gives "Frame load interrupted" when you try to handle a top-frame load with a NSURLProtocol.
//   http://stackoverflow.com/questions/12058203/using-a-custom-nsurlprotocol-on-ios-for-file-urls-causes-frame-load-interrup/19432303/
//   To work around this, we detect the nav in shouldOverrideLoadWithRequest and change it into a [UIWebView loadData] call,
// 2. iOS 6+ also has issues with using a NSURLProtocol to load iframes.
//   To work around this, we do a 302 redirect instead.


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
    BOOL _giveFreePassToNextLoad;
    NSMutableArray* _rerouteParams;
    NSMutableSet* _frameUris;
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

@interface UrlRemapURLProtocol : NSURLProtocol {
    NSURLConnection* _activeConnection;
}
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
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(pageDidLoad) name:CDVPageDidLoadNotification object:self.webView];
    gPlugin = self;
    [NSURLProtocol registerClass:[UrlRemapURLProtocol class]];
    _rerouteParams = [[NSMutableArray alloc] init];
    _frameUris = [[NSMutableSet alloc] init];
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
    NSURL* url = [request URL];
    BOOL isTopLevelNavigation = [url isEqual:request.mainDocumentURL];
    if (isTopLevelNavigation) {
        RouteParams* params = nil;
        @synchronized (self) {
            // Prevents infinite loop from the loadData call below.
            if (_giveFreePassToNextLoad) {
                _giveFreePassToNextLoad = NO;
                return NO;
            }
            if (_resetUrlParams != nil) {
                if ([_resetUrlParams matches:[url absoluteString]]) {
                    [_rerouteParams removeAllObjects];
                }
            }
            params = [self getChosenParams:url forInjection:NO];
        }
        // For top-level navigations where we need to do a sub-resource load.
        if (params != nil) {
            NSURL* newUrl = [params applyReplacement:url];
            // Note: Using loadData: clears the browser history stack. e.g. history.back() doesn't work.
            NSData* body = nil;
            if (params->_allowFurtherRemapping) {
                body = [NSData dataWithContentsOfURL:newUrl];
            } else {
                body = [NSData dataWithContentsOfFile:[newUrl path]];
            }
            _giveFreePassToNextLoad = YES;
            [self.webView loadData:body MIMEType:@"text/html" textEncodingName:@"utf8" baseURL:url];
            return YES;
        }
    } else {
        RouteParams* params = [self getChosenParams:url forInjection:NO];
        if (params != nil) {
            [_frameUris addObject:url];
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
    if ([request valueForHTTPHeaderField:@"fo"] != nil) {
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
    NSURLResponse *response = [[NSHTTPURLResponse alloc] initWithURL:url statusCode:404 HTTPVersion:@"HTTP/1.1" headerFields:@{}];
    [[self client] URLProtocol:self didReceiveResponse:response cacheStoragePolicy:NSURLCacheStorageNotAllowed];
    [[self client] URLProtocolDidFinishLoading:self];
}

- (void)issueRedirectToURL:(NSURL*)dest {
    NSMutableURLRequest* req = [[self request] mutableCopy];
    [req setURL:dest];
    [req setValue:@"FOO" forHTTPHeaderField:@"fo"];

    NSURLResponse *response = [[NSHTTPURLResponse alloc] initWithURL:[[self request] URL] statusCode:302 HTTPVersion:@"HTTP/1.1" headerFields:@{ @"Location": [dest absoluteString] }];

    [[self client] URLProtocol:self wasRedirectedToRequest:req redirectResponse:response];
    //[[self client] URLProtocolDidFinishLoading:self];
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

- (void)doLoadURL:(NSURL*)url {
    NSMutableURLRequest* req = [[self request] mutableCopy];
    [req setURL:url];
    _activeConnection = [[NSURLConnection alloc] initWithRequest:req delegate:self];
}

- (void)startLoading {
    NSURLRequest* request = [self request];
    int action = 0;
    NSURL* newUrl = nil;

    @synchronized (gPlugin) {
        RouteParams* params = [gPlugin getChosenParams:[request URL] forInjection:NO];

        // Race condition where params are cleared between canInit and startLoading.
        if (params == nil) {
            [self issueNotFoundResponse];
            return;
        }
        newUrl = [params applyReplacement:[request URL]];

        BOOL isTopLevelNavigation = [request.URL isEqual:request.mainDocumentURL];

        if (isTopLevelNavigation) {
            NSLog(@"Uh oh! Unexpected Top-Level Resource Request in UrlRemap.");
        } else if (params->_redirectToReplacedUrl) {
            // Note: we could support this, but Android can't.
            NSLog(@"Uh oh! UrlRemap doesn't currently support redirectToReplacedUrl (plus these should be top-level navs).");
        } else if ([gPlugin->_frameUris containsObject:[request URL]]) {
            // Frame loads must use redirects for iOS to be happy.
            int count = 0;
            // This further remapping doesn't play well with extern NSURLProtocols. Hopefully that's okay.
            while (params != nil && params->_allowFurtherRemapping) {
                params = [gPlugin getChosenParams:newUrl forInjection:NO];
                if (params != nil) {
                    newUrl = [params applyReplacement:newUrl];
                }
                if (++count > 10) {
                    NSLog(@"Hit infinite redirect in UrlRemap!");
                    break;
                }
            }
            action = 1;
        } else if (params->_allowFurtherRemapping) {
            action = 2;
        } else {
            action = 3;
        }
    }
    switch (action) {
        case 1: [self issueRedirectToURL:newUrl]; break;
        case 2: [self doLoadURL:newUrl]; break;
        case 3: [self issueDirectResponseForFileUrl:newUrl]; break;
    }
}

- (void)stopLoading {
    [_activeConnection cancel];
}

- (void)connection:(NSURLConnection *)connection didReceiveResponse:(NSURLResponse *)response {
    // NOTE: response's URL is wrong here since it's the actual URL's response. Doesn't seem to hurt for now...
    NSURLResponse* resp = [[NSURLResponse alloc] initWithURL:[self.request URL] MIMEType:[response MIMEType] expectedContentLength:[response expectedContentLength] textEncodingName:[response textEncodingName]];
    [[self client] URLProtocol:self didReceiveResponse:resp cacheStoragePolicy:NSURLCacheStorageNotAllowed];
}

- (void)connection:(NSURLConnection *)connection didReceiveData:(NSData *)data {
    [[self client] URLProtocol:self didLoadData:data];
}

- (NSCachedURLResponse *)connection:(NSURLConnection *)connection
                  willCacheResponse:(NSCachedURLResponse*)cachedResponse {
    return nil;
}

- (void)connectionDidFinishLoading:(NSURLConnection *)connection {
    [[self client] URLProtocolDidFinishLoading:self];
}

- (void)connection:(NSURLConnection *)connection didFailWithError:(NSError *)error {
    [[self client] URLProtocol:self didFailWithError:error];
}

@end

