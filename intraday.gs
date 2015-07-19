// VERSION 0.1 July 19 2015
// Simon Bromberg (http://sbromberg.com)
// You are free to use, modify, copy any of the code in this script for your own purposes, as long as it's not for evil
// If you do anything cool with it, let me know!
// Note: there are minor improvements/cleanups still to be made in this file, but it should work as is if everything is setup properly
// See readme on github repo for more information

//Script based on post here http://quantifiedself.com/2014/09/download-minute-fitbit-data/ by Ernesto Ramirez
/*
* Do not change these key names. These are just keys to access these properties once you set them up by running the Setup function from the Fitbit menu
*/
// Key of ScriptProperty for Firtbit consumer key.
var CONSUMER_KEY_PROPERTY_NAME = "fitbitConsumerKey";
// Key of ScriptProperty for Fitbit consumer secret.
var CONSUMER_SECRET_PROPERTY_NAME = "fitbitConsumerSecret";
// Key of project (inside File > Project Properties)
var PROJECT_KEY_PROPERTY_NAME = "projectKey";

var SERVICE_IDENTIFIER = 'fitbit';

var DataTypes = {"interday":0, "intraday":1};
var dataType = DataTypes.intraday;

function onOpen() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
  var menuEntries = [
    {
      name: "Setup",
      functionName: "setup"
    },
  {
        name: "Authorize",
        functionName: "showSidebar"
  },
  {
    name: "Reset",
    functionName: "clearService"
  },
  {
        name: "Download data",
    functionName: "refreshTimeSeries"
  }];
    ss.addMenu("Fitbit", menuEntries);
}


function isConfigured() {
    return getConsumerKey() != "" && getConsumerSecret() != "" && getProjectKey() != "";
}

function setConsumerKey(key) {
    ScriptProperties.setProperty(CONSUMER_KEY_PROPERTY_NAME, key);
}

function getConsumerKey() {
    var key = ScriptProperties.getProperty(CONSUMER_KEY_PROPERTY_NAME);
    if (key == null) {
        key = "";
    }
    return key;
}

function setLoggables(loggable) {
    ScriptProperties.setProperty("loggables", loggable);
}

function getLoggables() {
    var loggable = ScriptProperties.getProperty("loggables");
    if (loggable == null) {
        loggable = LOGGABLES;
    } else {
        loggable = loggable.split(',');
    }
    return loggable;
}


function setProjectKey(key) {
  ScriptProperties.setProperty(PROJECT_KEY_PROPERTY_NAME, key);
}

function getProjectKey() {
  var key = ScriptProperties.getProperty(PROJECT_KEY_PROPERTY_NAME);
  if (key == null) {
    key = "";
  }
  return key;
}

function setConsumerSecret(secret) {
    ScriptProperties.setProperty(CONSUMER_SECRET_PROPERTY_NAME, secret);
}

function getConsumerSecret() {
    var secret = ScriptProperties.getProperty(CONSUMER_SECRET_PROPERTY_NAME);
    if (secret == null) {
        secret = "";
    }
    return secret;
}

// function saveSetup saves the setup params from the UI
function saveSetup(e) {
    setConsumerKey(e.parameter.consumerKey);
    setConsumerSecret(e.parameter.consumerSecret);
    setProjectKey(e.parameter.projectKey);
    setLoggables(e.parameter.loggables);
    setFirstDate(e.parameter.firstDate);
    setLastDate(e.parameter.lastDate);
    var app = UiApp.getActiveApplication();
    app.close();
    return app;
}

function setFirstDate(firstDate) {
    ScriptProperties.setProperty("firstDate", firstDate);
}

function getFirstDate() {
    var firstDate = ScriptProperties.getProperty("firstDate");
    if (firstDate == null) {
        firstDate = "2012-01-01";
    }
    return firstDate;
}

function setLastDate(lastDate) {
    ScriptProperties.setProperty("lastDate", lastDate);
}

function getLastDate() {
    var lastDate = ScriptProperties.getProperty("lastDate");
    if (lastDate == null) {
      var today = new Date();
      lastDate = Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(),"yyyy-mm-dd");
    }
    return lastDate;
}

// function setup accepts and stores the Consumer Key, Consumer Secret, Project Key, firstDate, and list of Data Elements
function setup() {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var app = UiApp.createApplication().setTitle("Setup Fitbit Download");
    app.setStyleAttribute("padding", "10px");

    var consumerKeyLabel = app.createLabel("Fitbit OAuth 2.0 Client ID:*");
    var consumerKey = app.createTextBox();
    consumerKey.setName("consumerKey");
    consumerKey.setWidth("100%");
    consumerKey.setText(getConsumerKey());
  
    var consumerSecretLabel = app.createLabel("Fitbit OAuth Consumer Secret:*");
    var consumerSecret = app.createTextBox();
    consumerSecret.setName("consumerSecret");
    consumerSecret.setWidth("100%");
    consumerSecret.setText(getConsumerSecret());
  
    var projectKeyLabel = app.createLabel("Project key:*");
    var projectKey = app.createTextBox();
    projectKey.setName("projectKey");
    projectKey.setWidth("100%");
    projectKey.setText(getProjectKey());
  
    var firstDate = app.createTextBox().setId("firstDate").setName("firstDate");
    firstDate.setName("firstDate");
    firstDate.setWidth("100%");
    firstDate.setText(getFirstDate());

    var lastDate = app.createTextBox().setId("lastDate").setName("lastDate");
    lastDate.setName("lastDate");
    lastDate.setWidth("100%");
    lastDate.setText(getLastDate());
    // create the save handler and button
    var saveHandler = app.createServerClickHandler("saveSetup");
    var saveButton = app.createButton("Save Setup", saveHandler);

    // put the controls in a grid
    var listPanel = app.createGrid(8, 3);
    listPanel.setWidget(1, 0, consumerKeyLabel);
    listPanel.setWidget(1, 1, consumerKey);
    listPanel.setWidget(2, 0, consumerSecretLabel);
    listPanel.setWidget(2, 1, consumerSecret);
    listPanel.setWidget(3, 0, app.createLabel(" * (obtain these at dev.fitbit.com, use OAuth2.0)"));
    listPanel.setWidget(4, 0, projectKeyLabel);
    listPanel.setWidget(4, 1, projectKey);
    listPanel.setWidget(5, 0, app.createLabel("Start Date for download (yyyy-mm-dd)"));
    listPanel.setWidget(5, 1, firstDate);
    listPanel.setWidget(6, 0, app.createLabel("End date for download (yyyy-mm-dd)"));
    listPanel.setWidget(6, 1, lastDate);
    listPanel.setWidget(7, 0, app.createLabel("Very long intervals will not work; exceed Fitbit rate limit and/or function will timeout"));
    
    // Ensure that all controls in the grid are handled
    saveHandler.addCallbackElement(listPanel);
    // Build a FlowPanel, adding the grid and the save button
    var dialogPanel = app.createFlowPanel();
    dialogPanel.add(listPanel);
    dialogPanel.add(saveButton);
    app.add(dialogPanel);
    doc.show(app);
}

function getFitbitService() {
  // Create a new service with the given name. The name will be used when
  // persisting the authorized token, so ensure it is unique within the
  // scope of the property store
  Logger.log(PropertiesService.getUserProperties());
  return OAuth2.createService(SERVICE_IDENTIFIER)

      // Set the endpoint URLs, which are the same for all Google services.
      .setAuthorizationBaseUrl('https://www.fitbit.com/oauth2/authorize')
      .setTokenUrl('https://api.fitbit.com/oauth2/token')

      // Set the client ID and secret, from the Google Developers Console.
      .setClientId(getConsumerKey())
      .setClientSecret(getConsumerSecret())

      // Set the name of the callback function in the script referenced
      // above that should be invoked to complete the OAuth flow.
      .setCallbackFunction('authCallback')

      // Set the property store where authorized tokens should be persisted.
      .setPropertyStore(PropertiesService.getUserProperties())

      .setScope('activity')
      .setParam('redirect_uri','https://script.google.com/macros/d/'+getProjectKey()+'/usercallback')
      // Forces the approval prompt every time. This is useful for testing,
      // but not desirable in a production application.
      //.setParam('approval_prompt', 'force')
      .setTokenHeaders({
        'Authorization': 'Basic ' + Utilities.base64Encode(getConsumerKey() + ':' + getConsumerSecret())
      });

}

function clearService(){
  OAuth2.createService(SERVICE_IDENTIFIER)
  .setPropertyStore(PropertiesService.getUserProperties())
  .reset();
}

function showSidebar() {
  var service = getFitbitService();
  if (!service.hasAccess()) {
    var authorizationUrl = service.getAuthorizationUrl();
    var template = HtmlService.createTemplate(
        '<a href="<?= authorizationUrl ?>" target="_blank">Authorize</a>. ' +
        'Reopen the sidebar when the authorization is complete.');
    template.authorizationUrl = authorizationUrl;
    var page = template.evaluate();
    SpreadsheetApp.getUi().showSidebar(page);
  } else {
    Logger.log("Has access!!!!");
  }
}

function authCallback(request) {
  Logger.log("authcallback");
  var service = getFitbitService();
  var isAuthorized = service.handleCallback(request);
  if (isAuthorized) {
    Logger.log("success");
    return HtmlService.createHtmlOutput('Success! You can close this tab.');
  } else {
    Logger.log("denied");
    return HtmlService.createHtmlOutput('Denied. You can close this tab');
  }
}

function getUser() {
  var service = getFitbitService();

  var options = {
          headers: {
      "Authorization": "Bearer " + service.getAccessToken(),
        "method": "GET"
          }};
  var response = UrlFetchApp.fetch("https://api.fitbit.com/1/user/-/profile.json",options);
  var o = Utilities.jsonParse(response.getContentText());
  return o.user;
}

function refreshTimeSeries() {
  if (!isConfigured()) {
    setup();
    return;
  }
    var user = getUser();
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    doc.setFrozenRows(2);
    // two header rows
    doc.getRange("a1").setValue(user.fullName);
    doc.getRange("a1").setComment("DOB:" + user.dateOfBirth)
    doc.getRange("b1").setValue(user.country + "/" + user.state + "/" + user.city);

    var options =
        {headers:{
        "Authorization": 'Bearer ' + getFitbitService().getAccessToken(),
        "method": "GET"
        }};
  	// [wwu]
  	if (dataType == DataTypes.interday) {
  		// get inspired here http://wiki.fitbit.com/display/API/API-Get-Time-Series
   		var activities = ["activities/log/steps", "activities/log/distance", "activities/log/activeScore", "activities/log/calories",
    	"activities/log/minutesSedentary", "activities/log/minutesLightlyActive", "activities/log/minutesFairlyActive", "activities/log/minutesVeryActive",
    	"sleep/timeInBed", "sleep/minutesAsleep", "sleep/awakeningsCount",
    	"foods/log/caloriesIn"];
           var interdays = ['activities-log-steps', 'activities-log-distance', 'activities-log-activeScore', 
                            'activities-log-calories', 'activities-log-minutesSedentary', 'activities-log-minutesLightlyActive', 
                            'activities-log-minutesFairlyActive', 'activities-log-minutesVeryActive', 
                            'sleep-timeInBed', 'sleep-minutesAsleep', 'sleep-awakeningsCount',
                           'foods-log-caloriesIn'];
      
  	}
  	// begin[wwu]
  	else if (dataType == DataTypes.intraday) {
    	var activities = ["activities/log/steps"];
    	var intradays = ["activities-log-steps-intraday"];

  	}
	var lastIndex = 0;
    for (var activity in activities) {
    	var index = 0;
	 	var dateString = getFirstDate();
	 	date = parseDate(dateString);
        var table = new Array();
	    while (1) {
  			// end[wwu]
        	//[wwu] var dateString = Utilities.formatDate(new Date(), "GMT", "yyyy-MM-dd");
        	//[wwu] dateString = "today";
        	var currentActivity = activities[activity];
        	try {
         		// [wwu]
         	 	if (dataType == DataTypes.interday) {
            		var result = UrlFetchApp.fetch("https://api.fitbit.com/1/user/-/" + currentActivity + "/date/" + dateString
                                           + "/" + period + ".json", options); 
        		}
          		else if (dataType == DataTypes.intraday) {
            		var result = UrlFetchApp.fetch("https://api.fitbit.com/1/user/-/" + currentActivity + "/date/" + dateString+ "/" + dateString + ".json", options);
          		}
        	} catch(exception) {
            	Logger.log(exception);
        	}
        	var o = Utilities.jsonParse(result.getContentText());
             // Logger.log(o);
        	var cell = doc.getRange('a3');
        	var titleCell = doc.getRange("a2");
        	titleCell.setValue("Date");
        	var title = currentActivity.split("/");
        	title = title[title.length - 1];
        	titleCell.offset(0, 1 + activity * 1.0).setValue(title);
        	// [wwu] var index = 0;
		
        	//[wwu] for (var i in o) {
            // [wwu] var row = o[i];
          	// begin [wwu]
          //Logger.log(intradays);
    		if (dataType == DataTypes.intraday) {
            	var row = o[intradays[activity]]["dataset"];
        	}
        	else if (dataType == DataTypes.interday) {
            	var row = o[interdays[activity]];
        	}
          	// end [wwu]
    	  	for (var j in row) {
            	var val = row[j];
               var arr = new Array(2);
                // [wwu]
                if (dataType == DataTypes.interday) {
                    cell.offset(index, 0).setValue(val["dateTime"]);
              	}
              else if (dataType == DataTypes.intraday) {
                    arr[0] = dateString + ' ' + val["time"];
//                    cell.offset(index, 0).setValue(dateString + ' ' + val["time"]);
              }
        		// set the date index
  //            cell.offset(index, 1 + activity * 1.0).setValue(val["value"]);
               arr[1] = val["value"];
              table.push(arr);
              // set the value index index
              index++;
            }
          
            if (getFirstDate() == getLastDate()) {
            	break;
            }
            else {
	  			date.setDate(date.getDate()+1);
  				dateString = Utilities.formatDate(date, "GMT", "yyyy-MM-dd");
  				if (dateString > getLastDate()) {
  					break;
  				}
  				//Logger.log(dateString);
			}

        }
      
      // Batch set values of table
          doc.getRange("A3:B"+(table.length+2)).setValues(table);
        // [wwu]}
	}
}
// parse a date in yyyy-mm-dd format
function parseDate(input) {
  var parts = input.match(/(\d+)/g);
  // new Date(year, month [, date [, hours[, minutes[, seconds[, ms]]]]])
  return new Date(parts[0], parts[1]-1, parts[2]); // months are 0-based
}

// parse a date in 2011-10-25T23:57:00.000 format
function parseDate2(input) {
  var parts = input.match(/(\d+)/g);
  return new Date(parts[0], parts[1]-1, parts[2], parts[3], parts[4]);
}