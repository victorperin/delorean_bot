var _s = require('underscore.string');
var _ = require('lodash');
var config = require('./config');
var cache = require('pcacher')({redis: config.redis});
var request = require('request');
var promise = require('bluebird');
var dot = require('dot-object');
var timezoner = require('timezoner');

promise.promisifyAll(request);

module.exports = function (query) {
  if (_.isArray(query)) {
    query = query.join(',');
  } else if (_.isObject(query)) {
    query = query.longitude + ',' + query.latitude;
  }
  query = _s.trim(query).toLowerCase();
  return cache.memoize('geocode:' + query, '30d').then(function () {
    return request.getAsync('https://geocode-maps.yandex.ru/1.x/', {
      qs: {
        geocode: query,
        results: 1,
        sco: 'longlat',
        format: 'json',
        lang: 'en',
        key: config.yandexMapsKey
      }
    }).get('body').then(function (body) {
      return JSON.parse(body)
        .response
        .GeoObjectCollection
        .featureMember[0]
        .GeoObject
        .Point
        .pos
        .split(' ')
        .map(Number);
    });
  }).then(function (ll) {
    return cache.memoize('timezone:' + ll.join(','), function () {
      return promise.fromNode(function (cb) {
        timezoner.getTimeZone(ll[1], ll[0], cb);
      }).get('timeZoneId');
    });
  });
}