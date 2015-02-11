var _ = require('cloud/libs/underscore.js')
var FeedRead = require('cloud/libs/feed-read/index.js')
var async = require('cloud/libs/async.js')

String.prototype.format = function () {
    var args = arguments;
    return this.replace(/\{\{|\}\}|\{(\d+)\}/g, function (m, n) {
        if (m == "{{") { return "{"; }
        if (m == "}}") { return "}"; }
        return args[n];
    });
};

/*!
A POST Http request.
req.url:
req.headers:
req.body
**/
var _doPOSTRequest = function(req, cb) {
    Parse.Cloud.httpRequest({
      method: 'POST',
      url: req.url,
      headers: req.headers,
      body: req.body,
      success: function(httpResponse) {
          console.log(httpResponse.text);
          var finalRes = JSON.parse(httpResponse.text);
          cb(null, finalRes);
      },
      error: function(httpResponse) {
          console.error('Request failed with response code ' + httpResponse.status);
          cb(httpResponse.status, null);
      }
    });
}

var _doGETRequest = function(req, cb) {
    Parse.Cloud.httpRequest({
      method: 'GET',
      url: req.url,
      headers: req.headers,    
      success: function(httpResponse) {
          console.log(httpResponse.text);
          cb(null, httpResponse.text);
      },
      error: function(httpResponse) {
          console.error('Request failed with response code ' + httpResponse.status);
          cb(httpResponse.status, null);
      }
    });
}

var _fetchFeed = function(feedUrl, cb) {
    Parse.Cloud.httpRequest({
      method: 'GET',
      url: feedUrl,
      success: function(httpResponse) {
          console.log(httpResponse.text);
          cb(null, httpResponse.text);
      },
      error: function(httpResponse) {
          console.error('Request failed with response code ' + httpResponse.status);
          cb(httpResponse.status, null);
      }
    });
}

/*!
Articles is an array with following structure
    [
        {
            title:"July 21, 1861: The First Battle of Bull Run",
            content:"...",
            published: {
                __type: "Date"
                iso: "2014-07-21T04:00:00.000Z"
            },
            link: http://www.history.com/this-day-in-history/the-first-battle-of-bull-run,
            feed: {
            source: ""
            link: http://www.history.com/this-day-in-history
            name: "History.com - This Day in History - Lead Story"
            }
        },
        {...} 
    ]
**/
var fetchAndParseFeed = function(url, cb) {
    _fetchFeed(url, function(err, xml) {
        if(xml) {
            FeedRead.rss(xml, function(err, articles) {
                console.log("articles:"+articles);
                cb(null, articles);
            });
        } else {
            cb(err, null);
        }
    });
}

/*!
Fetches today's content for this day in history. 
Example result format:
        {
            title:"July 21, 1861: The First Battle of Bull Run",
            content:"...",
            published: {
                __type: "Date"
                iso: "2014-07-21T04:00:00.000Z"
            },
            link: http://www.history.com/this-day-in-history/the-first-battle-of-bull-run,
            feed: {
            source: ""
            link: http://www.history.com/this-day-in-history
            name: "History.com - This Day in History - Lead Story"
            }
        }

Note: result will have only single feed entry
**/
var fetchToday = function(options, cb) {
    var url = 'http://www.history.com/this-day-in-history/rss';
    fetchAndParseFeed(url, function(err, articles) {
        if(articles && _.size(articles)) {
            cb(null, _.first(articles));
        } else {
            cb(err, null);
        }
    });
}

/*!
Prepares and updates DB with this day in history content.
**/
var prepareThisDayInHistory = function(options, cb) {
    fetchToday(options, function(err, result) {
        if(result) {
            var content = result.content;
            findLinkedData(content, function(err, linkedData) {
                if(linkedData) {
                    result = _.extend(result, {'linked_data': linkedData})
                    console.log("result:"+JSON.stringify(result));
                    // Save to parse
                    // TODO: See if we should update existing row if any ?
                    var Today = Parse.Object.extend('today');
                    var today = new Today();
                    _.each(result, function(value, key, list) {
                        today.set(key, value);
                    });
                    today.save(null, {
                        success: function(today) {
                            var objectId = today.id;
                            console.log("Saved with objectId:"+objectId);
                            sendPushNotification(today);
                            cb(null, objectId);
                        },
                        error: function(today, error) {
                            console.log("parse save error:"+error);
                            cb(error);
                        } 
                    });
                }
            });
        } else {
            cb(err);
        }
    });
}

/*!
Queries an NPL webservice to get linked data from text.
**/
var findLinkedData =  function(text, cb) {
    var req = {};
    req.url = 'http://access.alchemyapi.com/calls/text/TextGetRankedConcepts';
    req.headers = null;
    req.body = {
        'apikey': 'c0b0db895c91d89ff01d58603472c9d7b7b2e88c',
        'text': text,
        'outputMode': 'json'
    };
    
    
    /*!
    result format
    {
        "status": "OK",
        "usage": "..."
        "url": "",
        "language": "english",
        "concepts": [
            {
                "text": "Confederate States of America",
                "relevance": "0.951249",
                "dbpedia": "http://dbpedia.org/resource/Confederate_States_of_America",
                "freebase": "http://rdf.freebase.com/ns/m.020d5",
                "opencyc": "http://sw.opencyc.org/concept/Mx4rbj86DuyOQdiPW_jMI92rTA",
                "yago": "http://yago-knowledge.org/resource/Confederate_States_of_America"
            },
            {
                "text": "First Battle of Bull Run",
                "relevance": "0.934094",
                "geo": "38.8147 -77.5227",
                "website": "http://thomaslegion.net/manassasbullrunbattlesoffirstandsecondmanassasfirstandsecondbullrun.html",
                "dbpedia": "http://dbpedia.org/resource/First_Battle_of_Bull_Run",
                "freebase": "http://rdf.freebase.com/ns/m.01h9zd",
                "yago": "http://yago-knowledge.org/resource/First_Battle_of_Bull_Run"
            }, ...]
     }
    **/
    _doPOSTRequest(req, function(err, result) {
        if(result && result['status'] === 'OK') {
            var concepts = result.concepts;
            console.log("concepts:"+JSON.stringify(concepts));
            var linkedData = {};

            // Insert dbpedia url in the required order with empty values.
            // Once fetched the result is set as value in the same order. 
            _.each(concepts, function(element, index) {
                var dbpedia = element.dbpedia;
                linkedData[dbpedia] = "";
            });
            
            async.forEach(concepts, function(concept, asycCallback) {
                _fetchLinkedData(concept.dbpedia, function(err, dbpediaResult) {
                    console.log("fetched linkeddata for "+concept.text);
                    if(dbpediaResult) {
                        var dbpedia = dbpediaResult.dbpedia;
                        dbpediaResult = _.extend(concept, dbpediaResult);                        
                        linkedData[dbpedia] = dbpediaResult;
                        console.log("result "+JSON.stringify(dbpediaResult));
                        asycCallback(null);
                    } else {
                      console.log("result is null with error "+JSON.stringify(err));
                      asycCallback(err);
                    }
                });
            }, function(err) {
                console.log("linkeddata:"+JSON.stringify(linkedData));
                if(!err) 
                    cb(null, _.values(linkedData));
                else 
                    cb(err, linkedData);
            });
        } else {
            cb(err, null);
        }
    });
}

/*!
Fetches linked data from dbpedia url.
Result format:
{
    abstract: <abstract about the topic>,
    wiki: <Wikipedia url>,
    dbpedia: <Dbpedia url>,
    thumbnail: <Optional url of thumbnail>
}
**/
var _fetchLinkedData = function(url, cb) {
    // Test console for SPARQL queries http://dbpedia.org/sparql
//    var query = "select str(?abstract) ?thumbnail ?wiki where { <http://dbpedia.org/resource/Steve_Jobs> <http://www.w3.org/2000/01/rdf-schema#comment> ?abstract. FILTER (langMatches(lang(?abstract),\"en\")) <http://dbpedia.org/resource/Steve_Jobs> <http://dbpedia.org/ontology/thumbnail> ?thumbnail.   <http://dbpedia.org/resource/Steve_Jobs> <http://xmlns.com/foaf/0.1/isPrimaryTopicOf> ?wiki}";
    var queryFormat = "select str(?abstract) ?thumbnail ?wiki where { <{0}> <http://www.w3.org/2000/01/rdf-schema#comment> ?abstract. FILTER (langMatches(lang(?abstract),\"en\")) <{1}> <http://dbpedia.org/ontology/thumbnail> ?thumbnail. <{2}> <http://xmlns.com/foaf/0.1/isPrimaryTopicOf> ?wiki}";
    var query = queryFormat.format(url, url, url);
    _doDBPediaQuery(query, function(err, result) {
        if(result) 
            result = _.extend(result, {'dbpedia': url});
        cb(err, result);
    });
}

var _doDBPediaQuery = function(query, cb) {
    Parse.Cloud.httpRequest({
      method: 'POST',
      url: 'http://dbpedia.org/sparql',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'Content-Type': 'application/x-www-form-urlencoded',  
        'Accept': 'application/json'
      },
      body: {
        'query': query
      },
      success: function(httpResponse) {
          console.log(httpResponse.text);
          var finalRes = _parseDbpediaResult(JSON.parse(httpResponse.text));
          cb(null, finalRes);
      },
      error: function(httpResponse) {
          console.error('Request failed with response code ' + httpResponse.status);
          cb(httpResponse.status, null);
      }
    });
}

var _parseDbpediaResult = function(result) {
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

/*!
Sends push notification.
today: The today parse object.
**/
var sendPushNotification = function(today) {
  var pushQuery = new Parse.Query(Parse.Installation);
    pushQuery.equalTo('deviceType', 'ios');
      
    Parse.Push.send({
      where: pushQuery, // Set our Installation query
      data: {
        alert: today.get('title'),
        objectId: today.id
      }
    }, {
      success: function() {
        // Push was successful
      },
      error: function(error) {
        throw "Got an error sending push " + error.code + " : " + error.message;
      }
    });
}

module.exports = {
    //fetchToday: fetchToday
    fetchToday: prepareThisDayInHistory
}

// eof