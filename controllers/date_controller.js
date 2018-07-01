// *********************************************************************************
// This file offers a set of routes for sending users to the various html pages
// *********************************************************************************

// Dependencies
// =============================================================
// var path = require("path");
var express = require("express");
var router = express.Router();
var Sequelize = require('sequelize');
// Requiring our models
var Datenow = require("../models").Datenow;
// Requiring googlemaps api
var locations = require("./googlemaps.js");

var googleMapsClient = require('@google/maps').createClient({
  // key: process.env.GOOGLE_KEY
  key: 'AIzaSyBAhNxc8BbsIMC5tFTNUSADF8vhSiNxXmA'
});

// Routes
// =============================================================
// index route loads index.hbs view
router.get("/", function (req, res) {
  res.render("index");
});

// POST route first get data from googleapi then a GET to check for popularity if it exist in database
router.post("/results", function (req, res) {
  // let finalResults = [];
  // call to googlemaps API endpoint with a callback
  // Result is in "results"
  locations(req.body, function (results) {
    // Function get the data needed from the JSON object returned from google

    let initialResults = getData(results);

    // Function gets the popularity of a date place from database and performs a checkPopularityCallBack
    getPopularity(initialResults, function (index, dbData) {
      console.log(dbData);
      (dbData === null) ? initialResults[index].popularity = 0 : initialResults[index].popularity = dbData.popularity;
    });
    // for POST 
    res.end("results");
    // Function that calls GET request to "/result"
    renderResultCallBack(initialResults);
  });
});

// Gets Popularity
function getPopularity(data, checkPopularityCallBack) {
  // Takes in the intial result as data 
  for (let i = 0; i < data.length; i++) {
    // Check for popularity 
    console.log("input id: ", data[i].apiId);
    Datenow.findOne({
      where: {
        apiId: data[i].apiId
      },
    }).then(function (dbDateNow) {
      // Perform a callback
      console.log("response", dbDateNow);
      checkPopularityCallBack(i, dbDateNow);
    });
  }
}

// RESULT.HBS GET REQ Via Post Callback
function renderResultCallBack(results) {
  router.get("/results", function (req, res) {
    console.log(results.length);

    //If null value to results send back to index page for now...
    if (results.length > 0) {

      var hbsPlacesObject = {
        places: results
      };


      console.log(hbsPlacesObject.places[1]);
      res.render("results", hbsPlacesObject);


    } else {
      console.log("No");
      res.render("index");
    }

  });
}

// Get useful data from the googleapi call
function getData(rawData) {
  let formattedData = [];

  for (let i = 1; i < rawData.length - 1; i++) {
    let place = {};

    //Need zipcode, popularity, description,imageurl,type (restaurant, etc), apiType
    place.apiId = rawData[i].place_id;
    place.name = rawData[i].name;
    place.open = rawData[i].opening_hours.open_now;
    place.googleRating = rawData[i].rating;
    place.pricing = rawData[i].price_level;
    place.address = rawData[i].vicinity;
    formattedData.push(place);
  }
  return formattedData;
}

router.post("/go", function (req, res) {
  // UPSERT (i.e insert or update if already exist) a new row
  console.log(req.body);

  Datenow.upsert({
    name: req.body.name,
    zipCode: req.body.zipcode,
    apiType: req.body.apiType,
    apiId: req.body.apiId
  }).then(function (dbDateNow) {
    // Call back to update the newly upserted row
    Datenow.update({
      popularity: Sequelize.literal('popularity + 1')
    },
      {
        where:
          {
            apiId: req.body.apiId
          }
      })

    res.json(dbDateNow);

  });
});

// POST route for incrementing the popularity
router.post("/itinerary", function (req, res) {
  res.end("itinerary");
  renderItineraryCallback(req.body);

});


function renderItineraryCallback(results) {
  router.get("/itinerary", function (req, res) {

    //If null value to results send back to index page for now...
    var hbsItineraryObject = {
      itinerary: results
    };
    res.render("itinerary", hbsItineraryObject);
  });
};

router.post("/location", function (req, res) {

  //Create address search string of user's latitude and longitude for Google Geocode
  var latLngString = (req.body.lat).toString() + "," + (req.body.lng).toString();

  // Reverse Geocode an address.
  googleMapsClient.geocode({
    address: latLngString
  }, function (err, response) {
    
    //Get Vague, but accurate address from Google API response
    var address = response.json.results[4].formatted_address;

    //Send Address back to Index page
    res.send(address);
  });
});


module.exports = router;