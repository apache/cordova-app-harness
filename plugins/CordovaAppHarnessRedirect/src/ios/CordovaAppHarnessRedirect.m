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
#import "CordovaAppHarnessRedirect.h"

#pragma mark declare

@interface AppHarnessURLProtocol : NSURLProtocol
@end

static NSString* pathPrefix;
static UIWebView* uiwebview;

#pragma mark CordovaAppHarnessRedirect

@implementation CordovaAppHarnessRedirect

- (CDVPlugin*)initWithWebView:(UIWebView*)theWebView
{
    self = [super initWithWebView:theWebView];
    uiwebview = theWebView;
    if (self) {
        [NSURLProtocol registerClass:[AppHarnessURLProtocol class]];
        pathPrefix = [[NSBundle mainBundle] pathForResource:@"chromeapp.html" ofType:@"" inDirectory:@"www"];
        NSRange range = [pathPrefix rangeOfString:@"/www/"];
        pathPrefix = [[pathPrefix substringToIndex:NSMaxRange(range)] stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]];
    }
    return self;
}

@end

#pragma mark AppHarnessURLProtocol

@implementation AppHarnessURLProtocol


+ (BOOL)canInitWithRequest:(NSURLRequest*)request
{
    NSURL* url = [request URL];

    if(![[url scheme] isEqualToString:fileURLScheme]) {
        return NO;
    }

    NSString* fileName = [url lastPathComponent];
    
    if([fileName isEqualToString:@"cordova.js"]
       || [fileName isEqualToString:@"__cordovaappharness_contextMenu_page.html"]
       || [fileName isEqualToString:@"__cordovaappharness_contextMenu_script.js"]
       || [fileName isEqualToString:@"__cordovaappharness_contextMenu_mainmenu"]
       ) {
        return YES;
    }
    return NO;
}

+ (NSURLRequest*)canonicalRequestForRequest:(NSURLRequest*)request
{
    return request;
}

- (void)startLoading
{
    NSURL *url = [[self request] URL];
    NSString *fileName = [url lastPathComponent];
    NSString *pathString = @"";
    BOOL redirect = NO;
    
    if ([fileName isEqualToString:@"cordova.js"]) {
        pathString = @"cordova.js";
    } else if ([fileName isEqualToString:@"__cordovaappharness_contextMenu_page.html"]) {
        pathString = @"contextMenu.html";
    } else if ([fileName isEqualToString:@"__cordovaappharness_contextMenu_script.js"]) {
        pathString = @"js/ContextMenu.js";
    } else if ([fileName isEqualToString:@"__cordovaappharness_contextMenu_mainmenu"]) {
        pathString = @"index.html";
        redirect = YES;
    } else {
        NSString* description = [NSString stringWithFormat:@"url %@ cannot be handled",[url absoluteString]];
        NSAssert(FALSE, description);
    }

    if(redirect) {
        [uiwebview stopLoading];
        NSString *newUrlString = [NSString stringWithFormat:@"file://%@%@", pathPrefix, [pathString stringByAddingPercentEscapesUsingEncoding:NSUTF8StringEncoding]];
        NSURL *newUrl = [NSURL URLWithString:newUrlString];
        NSURLRequest *request = [NSURLRequest requestWithURL:newUrl];
        [uiwebview loadRequest:request];
    } else {
        NSString *path = [NSString stringWithFormat:@"%@%@", pathPrefix, pathString];
        FILE *fp = fopen([path UTF8String], "r");
        if (fp) {
            NSURLResponse *response = [[NSHTTPURLResponse alloc] initWithURL:url statusCode:200 HTTPVersion:@"HTTP/1.1" headerFields:@{}];
            [[self client] URLProtocol:self didReceiveResponse:response cacheStoragePolicy:NSURLCacheStorageNotAllowed];

            char buf[32768];
            size_t len;
            while ((len = fread(buf,1,sizeof(buf),fp))) {
                [[self client] URLProtocol:self didLoadData:[NSData dataWithBytes:buf length:len]];
            }
            fclose(fp);

            [[self client] URLProtocolDidFinishLoading:self];

        } else {
            NSURLResponse *response = [[NSHTTPURLResponse alloc] initWithURL:url statusCode:404 HTTPVersion:@"HTTP/1.1" headerFields:@{}];
            [[self client] URLProtocol:self didReceiveResponse:response cacheStoragePolicy:NSURLCacheStorageNotAllowed];
            [[self client] URLProtocolDidFinishLoading:self];
        }
    }

}

- (void)stopLoading
{
    // do any cleanup here
}

@end
