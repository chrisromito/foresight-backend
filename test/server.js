/**
 * @module test/server.js - Run tests that live in /server/src/*
 */
import chai from 'chai'
chai.config.includeStack = true
import '../server/src/models/client/test/client.spec'
import '../server/src/models/client/test/page.spec'
import '../server/src/models/tracking/test/page_view.spec'
import '../server/src/models/tracking/test/action.spec'
import '../server/src/models/jwt/test/jwt.spec'
import '../server/src/controllers/public_api/test/test_public_api_controller'
import '../server/src/controllers/public_api/test/test_public_api_socket'
import '../server/src/models/stats/test'
