var gulp = require('gulp');
var jshint = require('gulp-jshint');

/******************************************************************************/
/******************************************************************************/

gulp.task('default', ['lint']);

gulp.task('watch', ['lint'], function() {
  gulp.watch([
      'www/**/*',
    ], ['lint']);
});

gulp.task('lint', ['lint:app', 'lint:harness-push']);

/******************************************************************************/
/******************************************************************************/

gulp.task('lint:app', function() {
  return gulp.src(['www/**/*.js', '!www/cdvah/js/libs/*.js'])
    .pipe(jshint())
    .pipe(jshint.reporter('default'))
    .pipe(jshint.reporter('fail'));
});

gulp.task('lint:harness-push', function() {
  return gulp.src(['harness-push/*.js', 'harness-push/node_modules/cordova-harness-client/*.js'])
    .pipe(jshint())
    .pipe(jshint.reporter('default'))
    .pipe(jshint.reporter('fail'));
});

