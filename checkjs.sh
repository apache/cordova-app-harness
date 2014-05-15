#!/bin/bash
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

# Runs jshint with the required parameters
#
# USAGE
#   ./checkjs
#

if ! which jshint; then
  echo "jshint not installed. Install it with: npm install -g jshint"
  exit 1
fi
echo "Running jsHint"
cd $(dirname "$0")
jshint www/ --exclude www/cdvah/js/libs --verbose --show-non-errors
