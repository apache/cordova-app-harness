/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var gulp = require('gulp');
var jshint = require('gulp-jshint');
var path = require('path');

/******************************************************************************/
/******************************************************************************/

gulp.task('default', ['lint']);

gulp.task('watch', ['lint'], function() {
  gulp.watch([
      path.join('www', '**', '*'),
    ], ['lint']);
});

gulp.task('lint', ['lint:app', 'lint:harness-push']);

/******************************************************************************/
/******************************************************************************/

gulp.task('lint:app', function() {
  return gulp.src([path.join('www', '**', '*.js'), path.join('!www', 'cdvah', 'js', 'libs', '*.js')])
    .pipe(jshint())
    .pipe(jshint.reporter('default'))
    .pipe(jshint.reporter('fail'));
});

gulp.task('lint:harness-push', function() {
  return gulp.src([path.join('harness-push', '*.js'), path.join('harness-push', 'node_modules', 'cordova-harness-client', '*.js')])
    .pipe(jshint())
    .pipe(jshint.reporter('default'))
    .pipe(jshint.reporter('fail'));
});

