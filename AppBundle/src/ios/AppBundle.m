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
#import "AppBundle.h"

// Note: See header for details about this plugin's behaviour

#pragma mark declare

@interface AppBundle()
{}
+ (NSString*) insertFileScheme:(NSString*)path;
- (void) resetMap;
+ (NSString*) getRegex:(NSString*)string;
@end

@interface RouteParams : NSObject
{
}
@property (nonatomic, readwrite, strong) NSRegularExpression* matchRegex;
@property (nonatomic, readwrite, strong) NSRegularExpression* replaceRegex;
@property (nonatomic, readwrite, strong) NSString* replacer;
@property (nonatomic, readwrite, assign) BOOL redirectToReplacedUrl;
- (RouteParams*)initWithMatchRegex:(NSRegularExpression*) matchRegex1 ReplaceRegex:(NSRegularExpression*)replaceRegex1 Replacer:(NSString*) replacer1 ShouldRedirect:(BOOL) redirectToReplacedUrl1;

@end

@interface AppBundleURLProtocol : NSURLProtocol
+ (RouteParams*) getChosenParams:(NSString*)uriString;
- (void)issueNSURLResponseForFile:(NSString*)file;
- (void)issueRedirectResponseForFile:(NSString*)file;
- (void)issueNotFoundResponse;
@end

NSString* const appBundlePrefix = @"app-bundle:///";
static NSString* pathPrefix;
static UIWebView* uiwebview;
static NSMutableArray* rerouteParams;
static RouteParams* appBundleParams;

#pragma mark AppBundle

@implementation AppBundle

+ (NSString*) insertFileScheme:(NSString*)path
{
    NSRange wholeStringRange = NSMakeRange(0, [path length]);
    NSRegularExpression* schemeRegex = [NSRegularExpression regularExpressionWithPattern:@"^[0-9a-zA-Z+.-]+:" options:0 error:nil];
    NSRange range = [schemeRegex rangeOfFirstMatchInString:path options:0 range:wholeStringRange];
    if(NSEqualRanges(range, NSMakeRange(NSNotFound, 0)))
    {
        return [NSString stringWithFormat:@"file://%@", path];
    }
    return path;
}

- (void) resetMap
{
    NSError *error = NULL;
    NSRegularExpression* bundleMatchRegex = [NSRegularExpression regularExpressionWithPattern:@"^app-bundle:///.*" options:0 error:&error];
    NSRegularExpression* bundleReplaceRegex = [NSRegularExpression regularExpressionWithPattern:@"^app-bundle:///" options:0 error:&error];
    appBundleParams = [[RouteParams alloc] initWithMatchRegex:bundleMatchRegex ReplaceRegex:bundleReplaceRegex Replacer:pathPrefix ShouldRedirect:YES];
    rerouteParams = [[NSMutableArray alloc] init];
    [rerouteParams addObject:appBundleParams];
}
+ (NSString*) getRegex:(NSString*)string
{
    return [NSRegularExpression escapedPatternForString:string];
}

- (CDVPlugin*)initWithWebView:(UIWebView*)theWebView
{
    self = [super initWithWebView:theWebView];
    uiwebview = theWebView;
    if (self) {
        [NSURLProtocol registerClass:[AppBundleURLProtocol class]];
        pathPrefix = [[NSBundle mainBundle] pathForResource:@"cordova.js" ofType:@"" inDirectory:@"www"];
        NSRange range = [pathPrefix rangeOfString:@"/www/"];
        pathPrefix = [[pathPrefix substringToIndex:NSMaxRange(range)] stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]];
        pathPrefix = [[AppBundle insertFileScheme:pathPrefix] stringByAddingPercentEscapesUsingEncoding:NSUTF8StringEncoding];
        [self resetMap];
    }
    return self;
}
- (void)addAlias:(CDVInvokedUrlCommand*)command
{
    CDVPluginResult* pluginResult = nil;
    @try {
        NSError* error;
        NSString* sourceUrlMatchRegexString = [[command.arguments objectAtIndex:0] stringByReplacingOccurrencesOfString:@"{BUNDLE_WWW}" withString:[AppBundle getRegex:pathPrefix]];
        NSRegularExpression* sourceUrlMatchRegex = [NSRegularExpression regularExpressionWithPattern:sourceUrlMatchRegexString options:0 error:&error];
        if(error) {
            pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Match regex is invalid"];
            return;
        }
        NSString* sourceUrlReplaceRegexString = [[command.arguments objectAtIndex:1] stringByReplacingOccurrencesOfString:@"{BUNDLE_WWW}" withString:[AppBundle getRegex:pathPrefix]];
        NSRegularExpression* sourceUrlReplaceRegex = [NSRegularExpression regularExpressionWithPattern:sourceUrlReplaceRegexString options:0 error:&error];
        if(error) {
            pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Replace regex is invalid"];
            return;
        }
        NSString* replaceString = [[command.arguments objectAtIndex:2] stringByReplacingOccurrencesOfString:@"{BUNDLE_WWW}" withString:pathPrefix];
        replaceString = [replaceString stringByAddingPercentEscapesUsingEncoding:NSUTF8StringEncoding];
        BOOL redirectToReplacedUrl = [[command.arguments objectAtIndex:3] boolValue];

        NSRange wholeStringRange = NSMakeRange(0, [replaceString length]);
        NSRange range = [sourceUrlMatchRegex rangeOfFirstMatchInString:replaceString options:0 range:wholeStringRange];
        if(!NSEqualRanges(range, NSMakeRange(NSNotFound, 0))) {
            pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"The replaceString cannot match the match regex. This would lead to recursive replacements."];
        } else {
            RouteParams* params = [[RouteParams alloc] initWithMatchRegex:sourceUrlMatchRegex ReplaceRegex:sourceUrlReplaceRegex Replacer:replaceString ShouldRedirect:redirectToReplacedUrl];
            [rerouteParams addObject:params];
            pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
        }
    } @catch(NSException *exception) {
        pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Could not add alias"];
        NSLog(@"Could not add alias - %@", [exception debugDescription]);
    } @finally {
        [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
    }
}
- (void)clearAllAliases:(CDVInvokedUrlCommand*)command
{
    CDVPluginResult* pluginResult = nil;
    @try {
        [self resetMap];
        pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
    }
    @catch (NSException *exception) {
        pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Could not clear aliases"];
        NSLog(@"Could not clear aliases - %@", [exception debugDescription]);
    }
    @finally {
        [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
    }
}
@end

#pragma mark RouteParams

@implementation RouteParams

@synthesize matchRegex;
@synthesize replaceRegex;
@synthesize replacer;
@synthesize redirectToReplacedUrl;

- (RouteParams*)initWithMatchRegex:(NSRegularExpression*) matchRegex1 ReplaceRegex:(NSRegularExpression*)replaceRegex1 Replacer:(NSString*) replacer1 ShouldRedirect:(BOOL) redirectToReplacedUrl1
{
    self = [super init];
    if(self)
    {
        [self setMatchRegex:matchRegex1];
        [self setReplaceRegex:replaceRegex1];
        [self setReplacer:replacer1];
        [self setRedirectToReplacedUrl:redirectToReplacedUrl1];
    }
    return self;
}

@end

#pragma mark AppBundleURLProtocol

@implementation AppBundleURLProtocol

+ (RouteParams*) getChosenParams:(NSString*)uriString
{
    NSRange wholeStringRange = NSMakeRange(0, [uriString length]);
    for(RouteParams* param in rerouteParams) {
        NSRange rangeOfMatch = [param.matchRegex rangeOfFirstMatchInString:uriString options:0 range:wholeStringRange];
        if (NSEqualRanges(rangeOfMatch, wholeStringRange)) {
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
    if(params != nil) {
        NSURL* mainUrl = [request mainDocumentURL];
        NSString* mainUrlString = [mainUrl absoluteString];
        if([mainUrlString isEqualToString:urlString]){
            return params.redirectToReplacedUrl;
        } else {
            return YES;
        }
    }
    return NO;
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
    if(params != nil) {
        NSRange wholeStringRange = NSMakeRange(0, [uriString length]);
        NSString* newUrlString = [params.replaceRegex stringByReplacingMatchesInString:uriString options:0 range:wholeStringRange withTemplate:params.replacer];
        if([newUrlString hasPrefix:@"file://"]) {
            NSURL *newUrl = [NSURL URLWithString:newUrlString];
            NSString* path = [newUrl path];
            FILE* fp = fopen([path UTF8String], "r");
            if (fp) {
                NSURLResponse *response = [[NSHTTPURLResponse alloc] initWithURL:uri statusCode:200 HTTPVersion:@"HTTP/1.1" headerFields:@{}];
                [[self client] URLProtocol:self didReceiveResponse:response cacheStoragePolicy:NSURLCacheStorageNotAllowed];

                char buf[32768];
                size_t len;
                while ((len = fread(buf,1,sizeof(buf),fp))) {
                    [[self client] URLProtocol:self didLoadData:[NSData dataWithBytes:buf length:len]];
                }
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
}

- (void)issueRedirectResponseForFile:(NSString*)uriString
{
    RouteParams* params = [AppBundleURLProtocol getChosenParams:uriString];
    if(params != nil && params.redirectToReplacedUrl)
    {
        if([uiwebview isLoading]) {
            [uiwebview stopLoading];
        }
        NSRange wholeStringRange = NSMakeRange(0, [uriString length]);
        NSString* newUrlString = [params.replaceRegex stringByReplacingMatchesInString:uriString options:0 range:wholeStringRange withTemplate:params.replacer];
        NSURL *newUrl = [NSURL URLWithString:newUrlString];
        NSURLRequest *request = [NSURLRequest requestWithURL:newUrl];
        [uiwebview loadRequest:request];
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
{
    // do any cleanup here
}

@end
