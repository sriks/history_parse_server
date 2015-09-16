var express = require('express');
var app = express();
var _ = require('underscore');

var SparqlClient = require('sparql-client');
//var util = require('util');
var endpoint = 'http://dbpedia.org/sparql';

var engine = require('../parse_cloud_code/cloud/controllers/engine.js');

String.prototype.format = function () {
    var args = arguments;
    return this.replace(/\{\{|\}\}|\{(\d+)\}/g, function (m, n) {
        if (m == "{{") { return "{"; }
        if (m == "}}") { return "}"; }
        return args[n];
    });
};


app.post('/testtoday', function(req, res){
    console.log("starting testing today");
    engine.fetchToday(null, function(err, result) {
        if(err) {
            console.log("Error response: "+JSON.stringify(err));
            res.send(err);
        } else {
            console.log("Success response: "+JSON.stringify(result));
            status.success(result);    
        }
    });
});


// app.post('/test', function(req, res){
//     parseFeed();
    
//     // Get the leaderName(s) of the given citys
//     // if you do not bind any city, it returns 10 random leaderNames
//     //var query = "SELECT * FROM <http://dbpedia.org> WHERE { ?city <http://dbpedia.org/property/leaderName> ?leaderName } LIMIT 10";
//     //var query = "select str(?abstract) ?thumbnail ?wiki where { <http://dbpedia.org/resource/Steve_Jobs> <http://www.w3.org/2000/01/rdf-schema#comment> ?abstract. FILTER (langMatches(lang(?abstract),\"en\")) <http://dbpedia.org/resource/Steve_Jobs> <http://dbpedia.org/ontology/thumbnail> ?thumbnail.   <http://dbpedia.org/resource/Steve_Jobs> <http://xmlns.com/foaf/0.1/isPrimaryTopicOf> ?wiki}";

//     var queryFormat = "select str(?abstract) ?wiki where { <{0}> <http://www.w3.org/2000/01/rdf-schema#comment> ?abstract. FILTER (langMatches(lang(?abstract),\"en\"))  <{1}> <http://xmlns.com/foaf/0.1/isPrimaryTopicOf> ?wiki}";
//     var query = queryFormat.format('http://dbpedia.org/resource/Steve_Jobs', 'http://dbpedia.org/resource/Steve_Jobs');
//     var client = new SparqlClient(endpoint);
//     console.log("Query to " + endpoint);
//     console.log("Query: " + query);
//     client.query(query).
//         execute(function(error, results) {
//         if(results != null) {
//               console.log("result:"+JSON.stringify(results));
//               var tmp = parseResult(results);
//               console.log(JSON.stringify(tmp));
//               res.send(tmp);
//         }
//     });
// });

var parseResult = function(result) {
    var finalResult = {};

    var results = result["results"];
    if(results != null && _.has(results, 'bindings')) {
        var binding = results['bindings'];
        console.log("binding" + JSON.stringify(binding));
        binding = _.first(binding);    
        _.each(binding, function(value, key, list) {
            console.log("key:"+key);
            console.log("value:"+JSON.stringify(value['value']));
            if(_.has(value, 'value'))
                finalResult[key] = value['value'];
        });
    }

    if(_.has(finalResult, 'callret-0')) {
        finalResult['abstract'] = finalResult['callret-0'];
        finalResult = _.omit(finalResult, 'callret-0');
    }
    return finalResult;
}

var parseFeed = function() {

    var FeedParser = require('feedparser')
  , request = require('request');

    var req = request('http://www.history.com/this-day-in-history/rss')
  , feedparser = new FeedParser([options]);

    req.on('error', function (error) {
      // handle any request errors
    });
    req.on('response', function (res) {
      var stream = this;

      if (res.statusCode != 200) return this.emit('error', new Error('Bad status code'));

      stream.pipe(feedparser);
    });

    feedparser.on('error', function(error) {
      // always handle errors
    });
    feedparser.on('readable', function() {
      // This is where the action is!
      var stream = this
        , meta = this.meta // **NOTE** the "meta" is always available in the context of the feedparser instance
        , item;

      while (item = stream.read()) {
        console.log(item);
      }
    });
}

var server = app.listen(3000, function() {
    console.log('Listening on port %d', server.address().port);
});