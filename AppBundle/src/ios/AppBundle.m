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
static NSString* gPathPrefix;
static UIWebView* gWebView;
static NSMutableArray* gRerouteParams;
static RouteParams* gAppBundleParams;

@interface AppBundle : CDVPlugin {}
- (void)addAlias:(CDVInvokedUrlCommand*)command;
- (void)clearAllAliases:(CDVInvokedUrlCommand*)command;
@end

@interface AppBundle()
{}
- (void) resetMap;
@end

@interface RouteParams : NSObject
{
@public
    NSRegularExpression* _matchRegex;
    NSRegularExpression* _replaceRegex;
    NSString* _replacer;
    BOOL _redirectToReplacedUrl;
}
- (RouteParams*)initWithMatchRegex:(NSRegularExpression*)matchRegex replaceRegex:(NSRegularExpression*)replaceRegex replacer:(NSString*)replacer shouldRedirect:(BOOL)redirectToReplacedUrl;
@end

@interface AppBundleURLProtocol : NSURLProtocol
+ (RouteParams*) getChosenParams:(NSString*)uriString;
- (void)issueNSURLResponseForFile:(NSString*)file;
- (void)issueRedirectResponseForFile:(NSString*)file;
- (void)issueNotFoundResponse;
@end


#pragma mark AppBundle

@implementation AppBundle

- (void)resetMap
{
    NSError *error = NULL;
    NSRegularExpression* bundleMatchRegex = [NSRegularExpression regularExpressionWithPattern:@"^app-bundle:///.*" options:0 error:&error];
    NSRegularExpression* bundleReplaceRegex = [NSRegularExpression regularExpressionWithPattern:@"^app-bundle:///" options:0 error:&error];
    gAppBundleParams = [[RouteParams alloc] initWithMatchRegex:bundleMatchRegex replaceRegex:bundleReplaceRegex replacer:gPathPrefix shouldRedirect:YES];
    gRerouteParams = [[NSMutableArray alloc] init];
    [gRerouteParams addObject:gAppBundleParams];
}

- (CDVPlugin*)initWithWebView:(UIWebView*)theWebView
{
    self = [super initWithWebView:theWebView];
    gWebView = theWebView;
    if (self) {
        [NSURLProtocol registerClass:[AppBundleURLProtocol class]];
        gPathPrefix = [[NSBundle mainBundle] pathForResource:@"cordova.js" ofType:@"" inDirectory:@"www"];
        gPathPrefix = [gPathPrefix stringByDeletingLastPathComponent];
        gPathPrefix = [[NSURL fileURLWithPath:gPathPrefix] absoluteString];
        [self resetMap];
    }
    return self;
}

- (void)addAlias:(CDVInvokedUrlCommand*)command
{
    CDVPluginResult* pluginResult = nil;
    NSError* error = nil;
    NSString* sourceUrlMatchRegexString = [[command.arguments objectAtIndex:0] stringByReplacingOccurrencesOfString:@"{BUNDLE_WWW}" withString:[NSRegularExpression escapedPatternForString:gPathPrefix]];
    NSRegularExpression* sourceUrlMatchRegex = [NSRegularExpression regularExpressionWithPattern:sourceUrlMatchRegexString options:0 error:&error];
    if(error) {
        pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Match regex is invalid"];
    } else {
        NSString* sourceUrlReplaceRegexString = [[command.arguments objectAtIndex:1] stringByReplacingOccurrencesOfString:@"{BUNDLE_WWW}" withString:[NSRegularExpression escapedPatternForString:gPathPrefix]];
        NSRegularExpression* sourceUrlReplaceRegex = [NSRegularExpression regularExpressionWithPattern:sourceUrlReplaceRegexString options:0 error:&error];
        if(error) {
            pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Replace regex is invalid"];
        } else {
            NSString* replaceString = [[command.arguments objectAtIndex:2] stringByReplacingOccurrencesOfString:@"{BUNDLE_WWW}" withString:gPathPrefix];
            BOOL redirectToReplacedUrl = [[command.arguments objectAtIndex:3] boolValue];

            RouteParams* params = [[RouteParams alloc] initWithMatchRegex:sourceUrlMatchRegex replaceRegex:sourceUrlReplaceRegex replacer:replaceString shouldRedirect:redirectToReplacedUrl];
            [gRerouteParams addObject:params];
            pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
        }
    }
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)clearAllAliases:(CDVInvokedUrlCommand*)command
{
    [self resetMap];
    CDVPluginResult* pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}
@end

#pragma mark RouteParams

@implementation RouteParams

- (RouteParams*)initWithMatchRegex:(NSRegularExpression*)matchRegex replaceRegex:(NSRegularExpression*)replaceRegex replacer:(NSString*)replacer shouldRedirect:(BOOL)redirectToReplacedUrl
{
    self = [super init];
    if(self)
    {
        _matchRegex = matchRegex;
        _replaceRegex = replaceRegex;
        _replacer = replacer;
        _redirectToReplacedUrl = redirectToReplacedUrl;
    }
    return self;
}

@end

#pragma mark AppBundleURLProtocol

@implementation AppBundleURLProtocol

+ (RouteParams*)getChosenParams:(NSString*)uriString
{
    NSRange wholeStringRange = NSMakeRange(0, [uriString length]);
    for(RouteParams* param in gRerouteParams) {
        NSInteger numMatches = [param->_matchRegex numberOfMatchesInString:uriString options:0 range:wholeStringRange];
        if (numMatches > 0) {
            return param;
        }
    }
    return nil;
}

+ (BOOL)canInitWithRequest:(NSURLRequest*)request
{
    NSURL* url = [request URL];
    NSString* urlString = [url absoluteString];
    RouteParams* params = [AppBundleURLProtocol getChosenParams:urlString];
    return params != nil;
}

+ (NSURLRequest*)canonicalRequestForRequest:(NSURLRequest*)request
{
    return request;
}

- (void)issueNotFoundResponse
{
    NSURL* url = [[self request] URL];
    NSURLResponse *response = [[NSHTTPURLResponse alloc] initWithURL:url statusCode:404 HTTPVersion:@"HTTP/1.1" headerFields:@{}];
    [[self client] URLProtocol:self didReceiveResponse:response cacheStoragePolicy:NSURLCacheStorageNotAllowed];
    [[self client] URLProtocolDidFinishLoading:self];
}

- (void)issueNSURLResponseForFile:(NSString*)file
{
    NSURL* uri = [[self request] URL];
    NSString* uriString = [uri absoluteString];
    RouteParams* params = [AppBundleURLProtocol getChosenParams:uriString];
    NSRange wholeStringRange = NSMakeRange(0, [uriString length]);
    NSString* newUrlString = [params->_replaceRegex stringByReplacingMatchesInString:uriString options:0 range:wholeStringRange withTemplate:params->_replacer];
    if ([newUrlString hasPrefix:@"file://"]) {
        NSURL *newUrl = [NSURL URLWithString:newUrlString];
        NSString* path = [newUrl path];
        FILE* fp = fopen([path UTF8String], "r");
        if (fp) {
            NSURLResponse *response = [[NSHTTPURLResponse alloc] initWithURL:uri statusCode:200 HTTPVersion:@"HTTP/1.1" headerFields:@{}];
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
        NSLog(@"Cannot redirect to %@. You can only redirect to file: uri's", newUrlString);
        [self issueNotFoundResponse];
    }
}

- (void)issueRedirectResponseForFile:(NSString*)uriString
{
    RouteParams* params = [AppBundleURLProtocol getChosenParams:uriString];
    if(params != nil && params->_redirectToReplacedUrl)
    {
        if([gWebView isLoading]) {
            [gWebView stopLoading];
        }
        NSRange wholeStringRange = NSMakeRange(0, [uriString length]);
        NSString* newUrlString = [params->_replaceRegex stringByReplacingMatchesInString:uriString options:0 range:wholeStringRange withTemplate:params->_replacer];
        NSURL *newUrl = [NSURL URLWithString:newUrlString];
        NSURLRequest *request = [NSURLRequest requestWithURL:newUrl];
        [gWebView loadRequest:request];
    }
}

- (void)startLoading
{
    NSURL *url = [[self request] URL];
    NSString* urlString = [url absoluteString];
    NSURL* mainUrl = [[self request] mainDocumentURL];
    NSString* mainUrlString = [mainUrl absoluteString];
    
    if([mainUrlString isEqualToString:urlString]){
        [self issueRedirectResponseForFile:urlString];
    } else {
        [self issueNSURLResponseForFile:urlString];
    }
}

- (void)stopLoading
{}

@end
